import Redis from "ioredis";

const memoryStore = new Map();

function now() {
  return Date.now();
}

function isExpired(entry) {
  return typeof entry.expiresAt === "number" && entry.expiresAt <= now();
}

function getMemoryEntry(key) {
  const entry = memoryStore.get(key);
  if (!entry) {
    return null;
  }
  if (isExpired(entry)) {
    memoryStore.delete(key);
    return null;
  }
  return entry;
}

function setMemoryEntry(key, value, ttlMs = null) {
  memoryStore.set(key, {
    value,
    expiresAt: ttlMs ? now() + ttlMs : null
  });
}

function deleteByPattern(pattern) {
  const prefix = pattern.endsWith("*") ? pattern.slice(0, -1) : pattern;
  const deleted = [];
  for (const key of memoryStore.keys()) {
    if (key.startsWith(prefix)) {
      memoryStore.delete(key);
      deleted.push(key);
    }
  }
  return deleted.length;
}

const memoryRedis = {
  get(key) {
    const entry = getMemoryEntry(key);
    return entry ? entry.value : null;
  },
  set(key, value, ...args) {
    let ttlMs = null;
    let nx = false;

    for (let index = 0; index < args.length; index += 1) {
      const flag = String(args[index] || "").toUpperCase();
      if (flag === "NX") {
        nx = true;
      } else if (flag === "EX") {
        ttlMs = Number(args[index + 1]) * 1000;
        index += 1;
      } else if (flag === "PX") {
        ttlMs = Number(args[index + 1]);
        index += 1;
      }
    }

    if (nx && getMemoryEntry(key)) {
      return null;
    }

    setMemoryEntry(key, value, ttlMs);
    return "OK";
  },
  incr(key) {
    const entry = getMemoryEntry(key);
    const nextValue = entry ? Number(entry.value) + 1 : 1;
    setMemoryEntry(key, String(nextValue), entry?.expiresAt ? entry.expiresAt - now() : null);
    return nextValue;
  },
  expire(key, seconds) {
    const entry = getMemoryEntry(key);
    if (!entry) {
      return 0;
    }
    entry.expiresAt = now() + Number(seconds) * 1000;
    memoryStore.set(key, entry);
    return 1;
  },
  pexpire(key, ms) {
    const entry = getMemoryEntry(key);
    if (!entry) {
      return 0;
    }
    entry.expiresAt = now() + Number(ms);
    memoryStore.set(key, entry);
    return 1;
  },
  del(...keys) {
    let count = 0;
    for (const key of keys) {
      if (memoryStore.delete(key)) {
        count += 1;
      }
    }
    return count;
  },
  exists(key) {
    return getMemoryEntry(key) ? 1 : 0;
  },
  keys(pattern) {
    const prefix = pattern.endsWith("*") ? pattern.slice(0, -1) : pattern;
    return [...memoryStore.keys()].filter((key) => key.startsWith(prefix));
  },
  ttl(key) {
    const entry = getMemoryEntry(key);
    if (!entry) {
      return -2;
    }
    if (!entry.expiresAt) {
      return -1;
    }
    return Math.max(0, Math.ceil((entry.expiresAt - now()) / 1000));
  },
  setnx(key, value) {
    const entry = getMemoryEntry(key);
    if (entry) {
      return 0;
    }
    setMemoryEntry(key, value);
    return 1;
  }
};

let redisClient;
if (process.env.REDIS_URL) {
  redisClient = new Redis(process.env.REDIS_URL);
  redisClient.on("error", () => {});
} else {
  redisClient = memoryRedis;
}

export const redis = redisClient;
export const redisIsMemory = !process.env.REDIS_URL;
export const redisMemoryStore = memoryStore;
export const redisDeletePattern = deleteByPattern;
