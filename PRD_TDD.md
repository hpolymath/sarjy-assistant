# Sarjy - Technical Design & Product Requirements
## 1. Objective
Build "Sarjy", an ultra-low latency, bilingual (Arabic/English), voice-controlled assistant accessible via the web.
Sarjy will act as a personal assistant capable of executing multistep workflows like planning an evening.

## 2. Architecture & Tech Stack
To achieve sub-500ms latency and native interruption handling, we will utilize an end-to-end WebRTC audio streaming architecture
rather than a sequential Text-to-Speech pipeline.

*   **Frontend/Framework:** Next.js (App Router) deployed on Vercel.
*   **Voice Infrastructure:** Vapi.ai (Handles WebRTC, endpointing, and echo cancellation).
*   **Speech-to-Text (STT):** Gladia (Solaria model). Selected specifically for its superior handling of Arabic dialects and code-switching (mixing English and Arabic mid-sentence).
*   **Text-to-Speech (TTS):** ElevenLabs (Multilingual v2 model for cross-language consistency).
*   **LLM "Brain":** Groq running Llama 3 (Prioritized for extreme token generation speed).

## 3. Core Features
*   **Memory:** Context will be maintained via Vapi's session state, allowing the LLM to recall prior turns in the current conversation.
*   **Multilingual:** Gladia will automatically detect Arabic or English input natively. The system prompt will instruct the LLM to reply in the detected language.
*   **Guardrails:** The system prompt will enforce strict boundaries, instructing the LLM to politely pivot away from restricted topics (politics, explicit content, etc).

## 4. API Integrations & Multistep Workflow
Sarjy will have access to four custom tools via Vapi Server URL function calling:
1.  **Weather API (OpenWeather):** Fetch current conditions for a location.
2.  **Maps API (Google Maps):** Calculate transit times and find nearby locations.
3.  **Flights API:** Retrieve basic flight cost/availability.
4.  **Calendar API (Google Calendar):** Utilize a backend Google Service Account to generate event invites and send them to the user's email as attendees (bypassing the need for complex frontend user OAuth).

**Multistep Workflow:**
The assistant will be programmed to execute the "Evening Planner" flow:
1. Check the weather.
2. Ask the user's preference for the evening.
3. Find a location using the Maps API.
4. Send a calendar invite to block off the time.

## 5. Latency Benchmarking
To prove the efficiency of the WebRTC architecture, latency will be actively benchmarked using two key metrics:
*   **Time to First Audio (TTFA):** The delay between the user finishing a sentence and the AI's audio playback starting.
*   **Barge-in Latency (Interruption Latency):** The delay between the user interrupting the AI mid-sentence and the AI's audio stream halting.
*   Metrics will be pulled directly from the Vapi call logs dashboard and supported by screen-recording frame analysis to demonstrate sub-second response times during the final presentation.

## 6. Cost Considerations & Reduction Strategy
Operating at scale requires monitoring per-minute and per-token costs. The current architecture prioritizes speed and quality over cost.

**Current Pricing (Per Minute):**
*   **Vapi:** ~$0.05
*   **ElevenLabs (TTS):** ~$0.10
*   **Gladia (STT):** ~$0.01
*   **Groq/LLM:** Negligible
*   **Total:** ~$0.16 per minute.

**Base Cost Projection (5 min/user):**
*   **100 users:** $80.00
*   **1,000 users:** $800.00
*   **10,000 users:** $8,000.00

**Strategies for Cost Reduction at Scale:**
If this product scales to 10,000+ users, the $8,000 operating cost is inefficient. We would implement the following optimizations:
1.  **Self-Hosting Open-Source TTS:** Migrate from ElevenLabs to an open-source model hosted on dedicated GPU instances (e.g., AWS/RunPod). Paying a flat hourly rate for compute reduces per-minute costs drastically.
2.  **Audio Caching:** Store generated audio files for common system responses or identical external API queries (e.g., local weather). Serving cached audio bypasses the TTS provider entirely, dropping the generation cost for those requests to $0.
3.  **Tiered Degradation:** Route free-tier users to cheaper, standard TTS models (~$0.01/min) while reserving premium ElevenLabs voices for paid enterprise accounts.
4.  **Enterprise Volume Contracts:** Negotiate committed-use contracts with API providers to secure lower per-minute rates based on guaranteed monthly volume.