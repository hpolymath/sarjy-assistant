import { NextResponse } from 'next/server';

/**
 * Estimates a maximum search radius in meters based on travel mode and time constraints.
 */
function calculateSearchRadius(mode: string, timeLimitMinutes: number): number {
  const estimatedSpeeds: Record<string, number> = {
    'WALK': 100,     // ~6 km/h
    'DRIVE': 1333,   // ~80 km/h
    'TRANSIT': 666   // ~40 km/h
  };

  const speedMetersPerMinute = estimatedSpeeds[mode] || estimatedSpeeds['DRIVE'];
  const radiusMeters = speedMetersPerMinute * timeLimitMinutes;

  return Math.min(radiusMeters, 50000); 
}

export async function POST(req: Request) {
  let toolCallId = null;

  try {
    const body = await req.json();

    // 1. Payload Parsing (Supports Vapi Webhook & Local Fallback)
    let args = body;
    
    if (body.message?.toolCalls?.[0]) {
      const toolCall = body.message.toolCalls[0];
      toolCallId = toolCall.id;
      args = toolCall.function?.arguments || {};
      
      if (typeof args === 'string') {
        args = JSON.parse(args);
      }
    }

    const { query, origin, travelMode = 'DRIVE', maxTimeMinutes } = args;

    if (!query || !origin) {
      const errorPayload = { 
        status: "error", 
        message: "Both 'query' and 'origin' parameters are required." 
      };
      
      if (toolCallId) {
        return NextResponse.json({ results: [{ toolCallId, result: errorPayload }] });
      }
      return NextResponse.json(errorPayload, { status: 400 });
    }

    const apiKey = process.env.GOOGLE_MAPS_API_KEY as string;

    // 2. Geocoding
    const geocodeUrl = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(origin)}&key=${apiKey}`;
    const geocodeRes = await fetch(geocodeUrl);
    const geocodeData = await geocodeRes.json();

    let location = null;
    if (geocodeData.status === "OK") {
      location = geocodeData.results[0].geometry.location; 
    }

    // 3. Discovery (Places API)
    const searchRadius = maxTimeMinutes 
      ? calculateSearchRadius(travelMode, maxTimeMinutes) 
      : 5000;
      
    const placesBody: any = { textQuery: query };
    if (location) {
      placesBody.locationBias = {
        circle: {
          center: { latitude: location.lat, longitude: location.lng },
          radius: searchRadius
        }
      };
    }

    const placesRes = await fetch('https://places.googleapis.com/v1/places:searchText', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': apiKey,
        'X-Goog-FieldMask': 'places.displayName,places.formattedAddress,places.id,places.rating'
      },
      body: JSON.stringify(placesBody)
    });

    const placesData = await placesRes.json();
    const candidates = placesData.places?.slice(0, 10) || [];

    if (candidates.length === 0) {
      const noResultsPayload = { 
        status: "success", 
        message: `No locations found for '${query}' near '${origin}'. Please suggest an alternative.` 
      };

      if (toolCallId) {
        return NextResponse.json({ results: [{ toolCallId, result: noResultsPayload }] });
      }
      return NextResponse.json(noResultsPayload);
    }

    // 4. Routing Validation (Routes API)
    const results = await Promise.all(candidates.map(async (place: any) => {
      try {
        const futureDepartureTime = new Date(Date.now() + 10000).toISOString();

        const routingBody: any = {
          origin: location ? { location: { latLng: { latitude: location.lat, longitude: location.lng } } } : { address: origin },
          destination: { placeId: place.id },
          travelMode: travelMode,
        };

        if (travelMode === 'DRIVE') {
          routingBody.routingPreference = "TRAFFIC_AWARE";
          routingBody.departureTime = futureDepartureTime; 
        } else if (travelMode === 'TRANSIT') {
          routingBody.departureTime = futureDepartureTime;
          routingBody.transitPreferences = {
            routingPreference: "LESS_WALKING",
            allowedTravelModes: ["BUS", "TRAIN"]
          };
        }

        const routeRes = await fetch('https://routes.googleapis.com/directions/v2:computeRoutes', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Goog-Api-Key': apiKey,
            'X-Goog-FieldMask': 'routes.duration,routes.distanceMeters' 
          },
          body: JSON.stringify(routingBody)
        });

        const routeData = await routeRes.json();

        if (routeData.error) {
          console.error(`Google Routes API Error [${place.displayName?.text}]:`, routeData.error.message);
          throw new Error("Routing parameters rejected.");
        }

        const route = routeData.routes?.[0];
        let durationMinutes: number | null = null;
        let isWithinConstraint = true;

        if (route && route.duration) {
          const durationSeconds = parseInt(route.duration.replace('s', ''));
          durationMinutes = Math.max(1, Math.ceil(durationSeconds / 60));
          
          if (maxTimeMinutes) {
            isWithinConstraint = durationMinutes <= maxTimeMinutes;
          }
        } else {
          isWithinConstraint = true;
        }

        return {
          name: place.displayName?.text || "Unknown Name",
          address: place.formattedAddress,
          rating: place.rating || "No rating",
          travelTimeMinutes: durationMinutes !== null ? durationMinutes : "No mapped route available for this mode",
          isWithinConstraint
        };
      } catch (e) {
        return {
          name: place.displayName?.text,
          address: place.formattedAddress,
          rating: place.rating,
          travelTimeMinutes: "Routing Error",
          isWithinConstraint: true
        };
      }
    }));

    // 5. Formatting & Filtering
    const validOptions = results.filter(r => r.isWithinConstraint);

    validOptions.sort((a, b) => {
      const timeA = typeof a.travelTimeMinutes === 'number' ? a.travelTimeMinutes : 999;
      const timeB = typeof b.travelTimeMinutes === 'number' ? b.travelTimeMinutes : 999;
      return timeA - timeB;
    });
    
    const finalOptions = validOptions.slice(0, 3).map(({ isWithinConstraint, ...rest }) => rest);
    
    const finalPayload = {
      status: "success",
      context: {
        origin_used: origin,
        mode: travelMode,
        search_radius_meters: Math.round(searchRadius),
        time_limit_applied: maxTimeMinutes ? `${maxTimeMinutes} mins` : "None"
      },
      options: finalOptions.length > 0 ? finalOptions : "The identified locations exceed the specified time limit. Modify the search parameters to try again."
    };

    // 6. Final Vapi / Fallback Return
    if (toolCallId) {
      return NextResponse.json({
        results: [{
          toolCallId: toolCallId,
          result: finalPayload
        }]
      });
    }

    return NextResponse.json(finalPayload);

  } catch (error) {
    console.error("Maps Integration Error:", error);
    
    const serverErrorPayload = { 
      status: "error", 
      message: "The evening planner service encountered an internal issue." 
    };

    if (toolCallId) {
      return NextResponse.json({ results: [{ toolCallId, result: serverErrorPayload }] });
    }
    
    return NextResponse.json(serverErrorPayload, { status: 500 });
  }
}