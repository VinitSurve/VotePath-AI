# VotePath AI — Testing Documentation

## Functional Tests

| # | Scenario | Input | Expected Output | Status |
|---|----------|-------|-----------------|--------|
| 1 | Valid election query | "How do I register to vote?" | Structured JSON with title, steps, tips, simple explanation | ✅ Pass |
| 2 | Multilingual query (Hindi) | "मतदान कैसे करें?" | JSON response fully translated to Hindi | ✅ Pass |
| 3 | Multilingual query (Marathi) | "मतदान कसे करायचे?" | JSON response fully translated to Marathi | ✅ Pass |
| 4 | Voice input | Speak "What is voter ID?" | Transcript captured → sent to API → response rendered | ✅ Pass |
| 5 | Text-to-Speech | Click 🔊 on bot message | Speech synthesis reads response in correct language accent | ✅ Pass |
| 6 | ELI5 / Simplified mode | Toggle simplified → ask query | Response uses child-friendly vocabulary | ✅ Pass |

## Edge Case Tests

| # | Scenario | Input | Expected Output | Status |
|---|----------|-------|-----------------|--------|
| 7 | Off-topic query | "What is 2+2?" | Guardrail response: "I can only answer election-related questions" | ✅ Pass |
| 8 | Cooking query | "How to make pasta?" | Guardrail response blocking non-election content | ✅ Pass |
| 9 | Empty prompt | "" (empty string) | Send button disabled, no API call made | ✅ Pass |
| 10 | Oversized prompt | 501+ character string | Backend returns 400: "Prompt too long" | ✅ Pass |
| 11 | Non-string prompt | `null` / `undefined` | Backend returns 400: "Invalid prompt format" | ✅ Pass |

## Error Handling Tests

| # | Scenario | Condition | Expected Behavior | Status |
|---|----------|-----------|-------------------|--------|
| 12 | API key missing | No `GEMINI_API_KEY` in .env | Fallback response with "Connection Error" message | ✅ Pass |
| 13 | Network failure | Backend unreachable | UI shows "AI unavailable. Showing verified fallback response." | ✅ Pass |
| 14 | Rate limiting | 2+ requests within 2 seconds | 429 response: "Too many requests. Please wait a few seconds." | ✅ Pass |
| 15 | Malformed AI response | Gemini returns invalid JSON | Server-side catch falls back to `defaultResponse` | ✅ Pass |

## Accessibility Tests

| # | Test | Method | Result |
|---|------|--------|--------|
| 16 | Keyboard navigation | Tab through all interactive elements | All buttons, inputs, selects focusable | ✅ Pass |
| 17 | Screen reader labels | Inspect `aria-label` attributes | All icon buttons have descriptive labels | ✅ Pass |
| 18 | Decorative icons | Inspect `aria-hidden` attributes | All decorative Lucide icons marked hidden | ✅ Pass |
| 19 | Focus indicators | Tab through form | Focus ring visible on input and buttons | ✅ Pass |

## Performance Tests

| # | Metric | Target | Measured |
|---|--------|--------|----------|
| 20 | Route-level code splitting | All pages lazy-loaded | ✅ `React.lazy()` on all routes |
| 21 | Component memoization | Chat component memoized | ✅ `React.memo` + `useCallback` |
| 22 | API response parsing | Server-side JSON parsing | ✅ Parsed before sending to frontend |
