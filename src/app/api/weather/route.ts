import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  let toolCallId = null; 

  try {
    const body = await req.json();

    // 1. Payload Parsing (Supports Vapi Webhook & Local Fallback)
    let args = body;
    if (body.message?.toolCalls?.[0]) {
      const toolCall = body.message.toolCalls[0];
      toolCallId = toolCall.id; // Capture ID for the response
      args = toolCall.function?.arguments || {};
      
      if (typeof args === 'string') {
        args = JSON.parse(args);
      }
    }

    const city = args.city;
    if (!city || city.trim() === "") {
      const errorMsg = "Error: No city name was provided. Ask the user: 'أي مدينة تقصد؟'";
      if (toolCallId) {
        return NextResponse.json({ results: [{ toolCallId, result: errorMsg }] });
      }
      return NextResponse.json({ status: "error", message: errorMsg }, { status: 400 });
    }

    const state = args.state || "";
    const country = args.country || "";
    const query = [city, state, country].filter(Boolean).join(',');

    const apiKey = process.env.OPENWEATHER_API_KEY;
    const url = `https://api.openweathermap.org/data/2.5/weather?q=${query}&appid=${apiKey}&units=metric`;

    let response = await fetch(url);
    let data = await response.json();

    // Fallback 01: Try searching just the city name
    if (data.cod !== 200 && (state || country)) {
      const fallbackUrl = `https://api.openweathermap.org/data/2.5/weather?q=${city}&appid=${apiKey}&units=metric`;
      response = await fetch(fallbackUrl);
      data = await response.json();
    }

    // Fallback 02: Remove Hyphens
    if (data.cod !== 200 && city.includes('-')) {
      const cleanCity = city.replace(/-/g, ' ');
      const cleanUrl = `https://api.openweathermap.org/data/2.5/weather?q=${cleanCity}&appid=${apiKey}&units=metric`;
      response = await fetch(cleanUrl);
      data = await response.json();
    }

    if (data.cod !== 200) {
      const errorMsg = data.cod == 404 
        ? `Error: The city '${city}' was not found.` 
        : "Error: Weather service unavailable.";
      
      if (toolCallId) {
        return NextResponse.json({ results: [{ toolCallId, result: errorMsg }] });
      }
      return NextResponse.json({ status: "error", message: errorMsg }, { status: 500 });
    }

    const weatherData = {
      temperature: Math.round(data.main.temp),
      condition: data.weather[0].description,
      location_found: data.name
    };

    // Return for Vapi
    if (toolCallId) {
      return NextResponse.json({
        results: [{
          toolCallId: toolCallId,
          result: JSON.stringify(weatherData)
        }]
      });
    }

    // Return for local testing
    return NextResponse.json(weatherData);

  } catch (error) {
    console.error("Weather Tool Error:", error);
    const crashMsg = "Error: Internal system failure. Gracefully apologize to the user in Arabic.";
    
    // Now toolCallId is accessible here!
    if (toolCallId) {
      return NextResponse.json({
        results: [{
          toolCallId: toolCallId,
          result: crashMsg
        }]
      });
    }
    return NextResponse.json({ status: "error", message: crashMsg }, { status: 500 });
  }
}