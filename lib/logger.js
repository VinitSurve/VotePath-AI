export function log(level, message, meta = {}) {
  try {
    const out = {
      level,
      message,
      ...meta,
      timestamp: new Date().toISOString()
    };
    console.log(JSON.stringify(out));
  } catch (e) {
    // fallback
    console.log(level, message, meta);
  }
}
