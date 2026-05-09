import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const { message } = await req.json();
    const args = message.toolCalls[0].function.arguments;
    
    // 1. Handle missing city names
    const city = args.city;
    if (!city || city.trim() === "") {
      return NextResponse.json({
        results: [{
          toolCallId: message.toolCalls[0].id,
          result: "Error: No city name was provided. Ask the user: 'أي مدينة تقصد؟' (Which city do you mean?)."
        }]
      });
    }

    const state = args.state || "";
    const country = args.country || "";
    
    const queryParts = [city, state, country].filter(Boolean);
    const query = queryParts.join(',');

    const apiKey = process.env.OPENWEATHER_API_KEY;
    const url = `https://api.openweathermap.org/data/2.5/weather?q=${query}&appid=${apiKey}&units=metric`;

    let response = await fetch(url);
    let data = await response.json();

    // FALLBACK01: If the specific search fails, try searching just the city name
    if (data.cod !== 200 && queryParts.length > 1) {
      const fallbackUrl = `https://api.openweathermap.org/data/2.5/weather?q=${city}&appid=${apiKey}&units=metric`;
      response = await fetch(fallbackUrl);
      data = await response.json();
    }

    // FALLBACK 02: Remove Hyphens
    // If it STILL fails and the city has a hyphen, replace it with a space and try again
    if (data.cod !== 200 && city.includes('-')) {
      const cleanCity = city.replace(/-/g, ' ');
      const cleanUrl = `https://api.openweathermap.org/data/2.5/weather?q=${cleanCity}&appid=${apiKey}&units=metric`;
      response = await fetch(cleanUrl);
      data = await response.json();
    }

    // 2. Error Messages
    if (data.cod !== 200) {
      // If OpenWeather specifically cannot find the city (404)
      const errorMsg = data.cod == 404 
        ? `Error: The city '${city}' was not found. Tell the user you couldn't find it and ask if they meant another place.`
        : "Error: Weather service unavailable. Apologize to the user.";

      return NextResponse.json({
        results: [{
          toolCallId: message.toolCalls[0].id,
          result: errorMsg
        }]
      });
    }

    // 3. Return Clean Data
    const temp = Math.round(data.main.temp);
    const condition = data.weather[0].description; 
    
    const weatherData = {
      temperature: temp,
      condition: condition,
      location_found: data.name
    };

    return NextResponse.json({
      results: [{
        toolCallId: message.toolCalls[0].id,
	result: JSON.stringify(weatherData)
      }]
    });
  } catch (error) {
    console.error("Weather Tool Error:", error);
    // Even if the server crashes, tell the LLM to speak so it isn't silent
    return NextResponse.json({
      results: [{
        toolCallId: message?.toolCalls?.[0]?.id || "unknown",
        result: "Error: Internal system failure. Gracefully apologize to the user in Arabic."
      }]
    });
  }
}