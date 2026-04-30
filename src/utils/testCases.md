# VotePath AI - Test Cases

These test cases validate the core functionality, error handling, and accessibility features of the VotePath AI application.

## Core Features

### 1. Valid Election Query
- **Action:** User types "How do I register to vote?" and clicks Send.
- **Expected Result:** Application makes API call and renders a structured response with a title, steps (if applicable), and simplified explanation.

### 2. Multi-Language Switch
- **Action:** User selects "Hindi" from the language dropdown and asks a question in English or Hindi.
- **Expected Result:** The AI assistant replies with content localized in Hindi, and text-to-speech playback attempts to use the Hindi accent voice.

### 3. Voice Input (Speech Recognition)
- **Action:** User clicks the microphone icon and speaks a query.
- **Expected Result:** The microphone icon flashes red, captures the transcript, places it in the input field, and stops listening when speech ends.

### 4. AI Tone Toggle (Standard vs Simplified)
- **Action:** User changes the context setting to "Simplified" (ELI5 mode).
- **Expected Result:** Subsequent AI responses use simpler vocabulary and more direct explanations compared to the standard tone.

## Error Handling & Edge Cases

### 5. Off-Topic Query Handling
- **Action:** User asks "What is the recipe for a chocolate cake?".
- **Expected Result:** The system block/guardrails trigger, returning a polite fallback message that redirects the user to election and voting topics.

### 6. Missing API Key / Server Down
- **Action:** The `/api/ask` endpoint fails or returns a 500 error.
- **Expected Result:** The frontend gracefully catches the error and displays: "Something went wrong. Please check if the AI server is running." without breaking the UI.

### 7. Unparseable JSON Response
- **Action:** The AI model returns an unparseable or badly formatted string.
- **Expected Result:** The application's `try/catch` logic falls back to a safe text object preventing a white screen crash.

## Accessibility (a11y)

### 8. Keyboard Navigation
- **Action:** User navigates the Chat interface using only the `Tab` key.
- **Expected Result:** Focus styles are visible on the language selector, text input, send button, and read-aloud buttons.

### 9. Screen Reader Labels
- **Action:** User interacts with icon-only buttons (Mic, Send, Text-to-Speech).
- **Expected Result:** `aria-label` attributes provide clear context (e.g., "Start voice input", "Send message").
