/**
 * Input Validation Module
 * Centralized validators for request parameters
 */

// Configuration
const MAX_PROMPT_LENGTH = 500;
const MAX_CONTEXT_LENGTH = 200;

/**
 * Validate prompt parameter
 * @param {*} prompt - The prompt to validate
 * @returns {object} {valid: boolean, error?: string}
 */
export function validatePrompt(prompt) {
  if (!prompt || typeof prompt !== 'string') {
    return { valid: false, error: 'INVALID_INPUT' };
  }

  if (prompt.length > MAX_PROMPT_LENGTH) {
    return { valid: false, error: 'INVALID_INPUT', reason: 'Prompt too long' };
  }

  return { valid: true };
}

/**
 * Validate and truncate context parameter
 * @param {*} context - The context to validate
 * @returns {object} {valid: boolean, value?: string, trimmed?: boolean}
 */
export function validateContext(context) {
  if (!context) {
    return { valid: true, value: null };
  }

  if (typeof context !== 'string') {
    return { valid: false, error: 'Invalid context type' };
  }

  if (context.length > MAX_CONTEXT_LENGTH) {
    return {
      valid: true,
      value: context.slice(0, MAX_CONTEXT_LENGTH),
      trimmed: true,
      originalLength: context.length
    };
  }

  return { valid: true, value: context };
}

/**
 * Validate language parameter
 * @param {*} language - The language to validate
 * @returns {object} {valid: boolean, value: string}
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
 * Get validation config
 * @returns {object} Validation limits
 */
export function getValidationConfig() {
  return {
    maxPromptLength: MAX_PROMPT_LENGTH,
    maxContextLength: MAX_CONTEXT_LENGTH,
    validLanguages: ['English', 'Hindi', 'Marathi', 'Tamil']
  };
}
