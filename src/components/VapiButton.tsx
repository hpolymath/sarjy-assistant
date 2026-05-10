"use client";

import { useEffect, useState } from "react";
import Vapi from "@vapi-ai/web";

// Initialize Vapi outside the component so it only loads once
const vapi = new Vapi(process.env.NEXT_PUBLIC_VAPI_PUBLIC_KEY!);

export default function VapiButton() {
  const [isCallActive, setIsCallActive] = useState(false);

  useEffect(() => {
    // listeners to update button color when the call actually connects or disconnects
    vapi.on("call-start", () => setIsCallActive(true));
    vapi.on("call-end", () => setIsCallActive(false));

    // Cleanup listeners if the user leaves the page
    return () => {
      vapi.removeAllListeners();
    };
  }, []);

  const toggleCall = () => {
    if (isCallActive) {
      vapi.stop();
    } else {
      // Pass the ID of the Sarjy assistant
      vapi.start(process.env.NEXT_PUBLIC_VAPI_ASSISTANT_ID!);
    }
  };

  return (
    <button
      onClick={toggleCall}
      className={`px-8 py-4 rounded-full text-white font-bold text-lg transition-colors ${
        isCallActive ? "bg-red-500 hover:bg-red-600" : "bg-blue-500 hover:bg-blue-600"
      }`}
    >
      {isCallActive ? "Stop Conversation" : "Talk to Sarjy"}
    </button>
  );
}