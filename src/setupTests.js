import '@testing-library/jest-dom';

process.env.GEMINI_API_KEY = process.env.GEMINI_API_KEY || 'test-gemini-key';
process.env.ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS || 'http://localhost:5173';
process.env.API_KEY_MAIN = process.env.API_KEY_MAIN || 'test-api-key';
process.env.API_KEY_METRICS = process.env.API_KEY_METRICS || 'test-metrics-key';
