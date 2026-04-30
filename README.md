# VotePath AI 🗳️

**An AI-powered assistant simplifying elections and voting processes.**

[![Deployed on Cloud Run](https://img.shields.io/badge/Deployed_on-Google_Cloud_Run-blue?logo=googlecloud)](https://votepath-ai-505150354601.us-central1.run.app/)

---

## 1. Problem
Many citizens, especially first-time voters or those in rural areas, find the election process confusing. The lack of easily accessible, multi-lingual, and simplified information about voting eligibility, required documents, and polling locations often leads to lower voter turnout.

## 2. Solution
**VotePath AI** is an intelligent, voice-enabled assistant designed to demystify the election process. It provides real-time, structured, and easy-to-understand answers to voting queries, ensuring that every citizen has the confidence and knowledge to cast their ballot.

## 3. Features
- **🤖 Smart AI Chat:** Powered by Gemini AI with strict guardrails to stay on election topics.
- **🌐 Multilingual Support:** Real-time translation and voice input/output in English, Hindi, Marathi, and Tamil.
- **🎙️ Voice & Text-to-Speech:** Accessible voice interactions using the Web Speech API.
- **🧠 Adaptive Tone:** Users can switch between "Standard", "Simplified (ELI5)", and "Deep Dive" explanations.
- **✅ Actionable Output:** Returns structured JSON containing steps, tips, and source references rather than just plain text walls.
- **♿ Accessibility Built-in:** Keyboard navigation, screen-reader friendly aria-labels, and high contrast UI.

## 4. Tech Stack
- **Frontend:** React, Vite, Tailwind CSS, Framer Motion, Lucide Icons
- **Backend:** Node.js, Express
- **AI Model:** Google Gemini API (via `@google/genai`)
- **Deployment:** Docker, Google Cloud Run

## 5. Architecture
1. **Frontend (React):** Manages UI state, captures voice/text input, and displays structured JSON responses from the backend.
2. **Backend (Express):** Acts as a secure proxy. Constructs strict system prompts, sends them to the Gemini API, and enforces JSON schema outputs.
3. **Gemini API:** Processes the prompt, determines relevance using context guardrails, and returns structured data (Title, Steps, Tips, Simple Explanation).

## 6. How It Works
1. User asks a question (e.g., "What documents do I need to vote?") via text or voice.
2. The React frontend sends the query and user preferences (language, tone) to the Express backend.
3. The backend appends strict system instructions and queries the **Google Gemini API**.
4. The backend validates the structured JSON response and sends it back to the client.
5. The frontend renders the response into an interactive, readable UI card with optional text-to-speech playback.

## 7. Environment Variables
To run this project locally, create a `.env` file in the root directory:

```env
VITE_GEMINI_API_KEY=your_google_gemini_api_key_here
```

*(Note: API keys are strictly kept out of the frontend and are not committed to version control).*

## 8. Testing & Validation
Test cases for core functionality, edge cases (off-topic queries), and accessibility can be found in `/src/utils/testCases.md`.
