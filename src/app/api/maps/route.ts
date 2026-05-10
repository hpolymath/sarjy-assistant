import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const { query, origin, travelMode = 'DRIVE', maxTimeMinutes } = await req.json();

    // Step 0: Validation
    if (!query || !origin) {
      return NextResponse.json({ 
        status: "error", 
        message: "Both 'query' and 'origin' are required." 
      }, { status: 400 });
    }

    const apiKey = process.env.GOOGLE_MAPS_API_KEY as string;

    // --- PHASE 1: GEOCODING (Convert Origin string to Coordinates) ---
    const geocodeUrl = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(origin)}&key=${apiKey}`;
    const geocodeRes = await fetch(geocodeUrl);
    const geocodeData = await geocodeRes.json();

    let location = null;
    if (geocodeData.status === "OK") {
      location = geocodeData.results[0].geometry.location; 
    }

    // --- PHASE 2: DISCOVERY (Places API New) ---
    const placesBody: any = { textQuery: query };
    if (location) {
      placesBody.locationBias = {
        circle: {
          center: { latitude: location.lat, longitude: location.lng },
          radius: 5000.0 // 5km search radius
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
    const candidates = placesData.places?.slice(0, 3) || [];

    if (candidates.length === 0) {
      return NextResponse.json({ 
        status: "success", 
        message: `I couldn't find any locations for '${query}' near '${origin}'. Suggest an alternative?` 
      });
    }

    // --- PHASE 3: ROUTING (Enhanced for Transit) ---
    const results = await Promise.all(candidates.map(async (place: any) => {
    try {
    	const isTransit = travelMode === 'TRANSIT';
    
	const routeRes = await fetch('https://routes.googleapis.com/directions/v2:computeRoutes', {
      	method: 'POST',
      	headers: {
        	 'Content-Type': 'application/json',
        	 'X-Goog-Api-Key': apiKey,
        	 'X-Goog-FieldMask': 'routes.duration,routes.distanceMeters,routes.legs.steps'
      		 },
      body: JSON.stringify({
        origin: location ? { location: { latLng: { latitude: location.lat, longitude: location.lng } } } : { address: origin },
        destination: { placeId: place.id },
        travelMode: travelMode,
        // Transit requires a departure time (ISO string)
        departureTime: new Date().toISOString(), 
        routingPreference: isTransit ? "ROUTING_PREFERENCE_UNSPECIFIED" : "TRAFFIC_AWARE",
        transitPreferences: isTransit ? {
          routingPreference: "LESS_WALKING",
          allowedTravelModes: ["BUS", "TRAIN"]
        } : undefined
      })
    });

    const routeData = await routeRes.json();
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
      // If no transit/walk route is found, we don't hide the place,
      // but we inform the user that a direct path isn't mapped.
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
      travelTimeMinutes: "Routing Error",
      isWithinConstraint: true
    };
  }
}));

    // --- PHASE 4: FILTERING & OUTPUT ---
    const validOptions = results.filter(r => r.isWithinConstraint);

    // Clean up the output so the LLM doesn't see the internal constraint boolean
    const finalOptions = validOptions.map(({ isWithinConstraint, ...rest }) => rest);

    return NextResponse.json({
      status: "success",
      context: {
        origin_used: origin,
        mode: travelMode,
        time_limit_applied: maxTimeMinutes ? `${maxTimeMinutes} mins` : "None"
      },
      options: finalOptions.length > 0 ? finalOptions : "The places I found are too far based on your time limit. Want to see them anyway or try a different search?"
    });

  } catch (error) {
    console.error("Pipeline Error:", error);
    return NextResponse.json({ 
      status: "error", 
      message: "The evening planner service encountered an issue." 
    }, { status: 500 });
  }
}