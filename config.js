/**
 * Centralized configuration for VotePath-AI
 * Enables easy adjustment without code changes
 */

export const CONFIG = {
  // Rate limiting
  RATE_LIMIT_MS: 2000,
  
  // Cleanup interval (5 minutes)
  CLEANUP_INTERVAL_MS: 300000,
  
  // Caching
  CACHE_TTL: 60000,
  CACHE_MAX_SIZE: 50,
  
  // Input validation
  MAX_PROMPT_LENGTH: 500,
  MAX_CONTEXT_LENGTH: 200,
  
  // Valid languages
  VALID_LANGUAGES: ['English', 'Hindi', 'Marathi', 'Tamil'],
  
  // Server
  PORT: process.env.PORT || 3000,
  NODE_ENV: process.env.NODE_ENV || 'development'
};
