import { createHmac } from "crypto";
import { describe, it, expect, afterEach } from "vitest";
import { createRequestSigningMiddleware, signRequestPayload } from "../lib/middleware/security.js";
import { sanitizeContext } from "../lib/services/validationService.js";

function createMockRes() {
  return {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    }
  };
}

const originalNodeEnv = process.env.NODE_ENV;
const originalSecurityMode = process.env.SECURITY_MODE;
const originalSigningSecret = process.env.SIGNING_SECRET;

function createRedisMock() {
  const store = new Map();
  return {
    async set(key, value, mode, flag, ttl) {
      if (mode === "NX" && store.has(key)) {
        return null;
      }
      store.set(key, value);
      if (ttl) {
        setTimeout(() => store.delete(key), 0);
      }
      return "OK";
    }
  };
}

afterEach(() => {
  process.env.NODE_ENV = originalNodeEnv;
  if (originalSecurityMode === undefined) {
    delete process.env.SECURITY_MODE;
  } else {
    process.env.SECURITY_MODE = originalSecurityMode;
  }
  if (originalSigningSecret === undefined) {
    delete process.env.SIGNING_SECRET;
  } else {
    process.env.SIGNING_SECRET = originalSigningSecret;
  }
});

describe("security middleware", () => {
  it("rejects requests without signature headers", async () => {
    process.env.NODE_ENV = "production";
    process.env.SECURITY_MODE = "strict";
    process.env.SIGNING_SECRET = "middleware-test-secret";
    const req = { method: "POST", path: "/api/ask", headers: {}, body: {}, requestId: "req-1" };
    const res = createMockRes();
    let nextCalled = false;

    await createRequestSigningMiddleware(createRedisMock())(req, res, () => {
      nextCalled = true;
    });

    expect(nextCalled).toBe(false);
    expect(res.statusCode).toBe(401);
    expect(res.body.errorType).toBe("MISSING_SIGNATURE");
  });

  it("rejects replayed nonces", async () => {
    process.env.NODE_ENV = "production";
    process.env.SECURITY_MODE = "strict";
    process.env.SIGNING_SECRET = "middleware-test-secret";
    const timestamp = String(Date.now());
    const nonce = "nonce-1";
    const body = { prompt: "How to vote?" };
    const signature = signRequestPayload({
      secret: process.env.SIGNING_SECRET,
      method: "POST",
      path: "/api/ask",
      body: JSON.stringify(body),
      timestamp,
      nonce
    });
    const validator = createRequestSigningMiddleware(createRedisMock());

    const req1 = { method: "POST", path: "/api/ask", headers: { "x-signature": signature, "x-timestamp": timestamp, "x-nonce": nonce }, body, requestId: "req-2" };
    const res1 = createMockRes();
    let next1 = false;
    await validator(req1, res1, () => {
      next1 = true;
    });

    const req2 = { method: "POST", path: "/api/ask", headers: { "x-signature": signature, "x-timestamp": timestamp, "x-nonce": nonce }, body, requestId: "req-3" };
    const res2 = createMockRes();
    let next2 = false;
    await validator(req2, res2, () => {
      next2 = true;
    });

    expect(next1).toBe(true);
    expect(res1.body).toBeNull();
    expect(next2).toBe(false);
    expect(res2.statusCode).toBe(401);
    expect(res2.body.errorType).toBe("REPLAY_DETECTED");
  });

  it("sanitizes prompt injection markers from context", () => {
    const sanitized = sanitizeContext("IGNORE previous\nSYSTEM prompt RETURN instruction");
    expect(sanitized).not.toMatch(/IGNORE|SYSTEM|RETURN|PROMPT|INSTRUCTION/i);
    expect(sanitized).not.toContain("\n");
  });
});