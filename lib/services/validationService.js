/**
 * Validation Service Layer
 * Centralized validation with security hardening.
 */

const MAX_PROMPT_LENGTH = 500;
const MAX_CONTEXT_LENGTH = 200;

/**
 * Sanitize context to prevent prompt injection.
 * Must be applied before prompt creation.
 */
export function sanitizeContext(context) {
  return String(context || "")
    .replace(/[\n\r]/g, " ")
    .replace(/IGNORE|RETURN|SYSTEM|PROMPT|INSTRUCTION/gi, "")
    .slice(0, MAX_CONTEXT_LENGTH);
}

/**
 * Validate prompt parameter
 */
export function validatePrompt(prompt) {
  if (!prompt || typeof prompt !== 'string') {
    return { valid: false, error: 'INVALID_INPUT', reason: 'Prompt must be a non-empty string' };
  }

  if (prompt.trim().length < 3) {
    return { valid: false, error: 'INVALID_INPUT', reason: 'Prompt too short' };
  }

  if (prompt.length > MAX_PROMPT_LENGTH) {
    return { valid: false, error: 'INVALID_INPUT', reason: `Prompt exceeds ${MAX_PROMPT_LENGTH} chars` };
  }

  return { valid: true };
}

/**
 * Validate and sanitize context parameter
 * SECURITY FIX: Now sanitizes against injection
 */
export function validateContext(context) {
  if (!context) {
    return { valid: true, value: null };
  }

  if (typeof context !== 'string') {
    return { valid: false, error: 'Context must be a string' };
  }

  const sanitized = sanitizeContext(context);
  const wasSanitized = sanitized !== context;

  return {
    valid: true,
    value: sanitized,
    wasSanitized
  };
}

/**
 * Validate language parameter
 */
export function validateLanguage(language) {
  const validLanguages = ['English', 'Hindi', 'Marathi', 'Tamil'];
  const defaultLanguage = 'English';

  if (!language || !validLanguages.includes(language)) {
    return { valid: true, value: defaultLanguage };
  }

  return { valid: true, value: language };
}

/**
 * Validate request mode
 */
export function validateMode(mode) {
  const validModes = ['normal', 'elis'];
  return validModes.includes(mode) ? mode : 'normal';
}

/**
 * Get validation config for external use
 */
export function getValidationConfig() {
  return {
    maxPromptLength: MAX_PROMPT_LENGTH,
    maxContextLength: MAX_CONTEXT_LENGTH,
    validLanguages: ['English', 'Hindi', 'Marathi', 'Tamil'],
    sanitizeContext
  };
}
