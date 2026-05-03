import request from "supertest";
import { createHmac, randomUUID } from "crypto";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

const mockGenerate = vi.fn();

vi.mock("@google/generative-ai", () => {
  return {
    GoogleGenerativeAI: function () {
      return {
        getGenerativeModel: () => ({
          generateContent: mockGenerate
        })
      };
    }
  };
});

import { app, clearRequestLog } from "../server.js";

const originalNodeEnv = process.env.NODE_ENV;
const originalApiKey = process.env.API_KEY_MAIN;
const originalSigningSecret = process.env.SIGNING_SECRET;

function signRequest(body, path = "/api/ask") {
  const timestamp = String(Date.now());
  const nonce = randomUUID();
  const bodyString = JSON.stringify(body);
  const signature = createHmac("sha256", process.env.SIGNING_SECRET)
    .update(`POST${path}${bodyString}${timestamp}${nonce}`)
    .digest("hex");

  return {
    "x-api-key": process.env.API_KEY_MAIN,
    "x-signature": signature,
    "x-timestamp": timestamp,
    "x-nonce": nonce
  };
}

beforeEach(() => {
  clearRequestLog();
  process.env.NODE_ENV = "production";
  process.env.API_KEY_MAIN = "test-api-key";
  mockGenerate.mockReset();
  mockGenerate.mockResolvedValue({
    response: {
      text: () => JSON.stringify({
        title: "Voting",
        steps: [],
        simple: "Go vote",
        tips: [],
        source: "Election Commission of India"
      })
    }
  });
});

afterEach(() => {
  process.env.NODE_ENV = originalNodeEnv;
  if (originalSigningSecret === undefined) {
    delete process.env.SIGNING_SECRET;
  } else {
    process.env.SIGNING_SECRET = originalSigningSecret;
  }
  if (originalApiKey === undefined) {
    delete process.env.API_KEY_MAIN;
  } else {
    process.env.API_KEY_MAIN = originalApiKey;
  }
});

describe("API auth middleware", () => {
  it("rejects requests without a valid x-api-key", async () => {
    const res = await request(app).post("/api/ask").send({ prompt: "vote" });
    expect(res.status).toBe(401);
    expect(res.body.errorType).toBe("UNAUTHORIZED");
    expect(res.body.statusCode).toBe(401);
  });

  it("allows requests with the configured x-api-key", async () => {
    process.env.SIGNING_SECRET = "auth-test-signing-secret";
    const res = await request(app)
      .post("/api/ask")
      .set(signRequest({ prompt: "vote" }))
      .send({ prompt: "vote" });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.requestId).toBeDefined();
  });
});
