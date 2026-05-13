# Sarjy: A Bilingual Voice-Controlled Assistant

Sarjy is a helpful, voice-controlled assistant designed to provide a natural, low-latency conversational experience. Built as an engineering assessment task, the project focuses on robust voice-to-voice interaction, bilingual support, and integration with real-time location and environmental data.

## 🚀 Live Demo
**Link:** [https://sarjy-assistant.vercel.app/](https://sarjy-assistant.vercel.app/)

## ✨ Key Features
* **Bilingual Voice Interaction**: Configured to listen and respond in Arabic (Saudi Arabia) and English using a high-fidelity transcription and synthesis pipeline.
* **Conversational Memory**: Sarjy retains context during conversations, allowing for natural follow-up questions (e.g., "What's my favorite color?").
* **Real-time Data Integration**: Seamlessly connected to external APIs to provide weather, routing, and location-based information.
* **Robust Orchestration**: Utilizes Vapi for real-time WebRTC audio streaming to balance low latency with high interaction fidelity.

## 🛠️ Technical Architecture

### The Voice Pipeline
To ensure robustness and quality, the assistant uses a specialized "Model Cluster" approach:
* **Orchestrator**: [Vapi](https://vapi.ai) for sub-second WebRTC streaming.
* **Transcriber (STT)**: Azure (flux general en) optimized for Saudi Arabic.
* **Intelligence (LLM)**: OpenAI GPT-o4 Mini Cluster for fast, accurate response generation.
* **Voice (TTS)**: ElevenLabs (Eleven Multilingual v2) for realistic, human-like speech.

### API Integrations
* **OpenWeatherMap**: For real-time environmental updates.
* **Google Routes & Geocoding**: For location-aware logic and pathfinding.
* **Places API (New)**: For identifying and describing points of interest.

### Configuration Management
Detailed assistant and tool configurations are stored in the `/vapi_configs/` subdirectory, for clean separation between the logic layer and the frontend interface.

## 🏗️ Architectural Decisions
Issues to Explored:
* **Latency vs. Robustness**: While WebRTC provides the baseline for low latency, This project prioritised the **robustness** of the bilingual model cluster to ensure accurate understanding in diverse conversational contexts.
* **System Design**: Used Next.js (App Router) for the web interface to ensure the project is easily accessible and deployable.

## 🛠️ Installation & Setup
1. Clone the repository: `git clone https://github.com/hpolymath/sarjy-assistant`
2. Install dependencies: `npm install`
3. Configure Environment Variables: Refer to `.env.example` for required keys (Vapi Public Key, etc.).
4. Run locally: `npm run dev`

## 🔮 Future Work
* **Advanced Latency Optimization**: Implementing edge-deployed caching and provider-specific tuning.
* **Calendar Integration**: Connecting with Google/Outlook calendars via custom MCPs.
* **Custom Tooling**: Expanding the model's capabilities to handle extra workflows like note-taking and event planning and scheduling.
