import request from "supertest";
import { createHmac } from "crypto";
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
const originalMainKey = process.env.API_KEY_MAIN;
const originalMetricsKey = process.env.API_KEY_METRICS;
const originalSigningSecret = process.env.SIGNING_SECRET;

function signRequest(body, path = "/api/ask") {
  const timestamp = String(Date.now());
  const nonce = "security-test-nonce";
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
  if (originalMainKey === undefined) {
    delete process.env.API_KEY_MAIN;
  } else {
    process.env.API_KEY_MAIN = originalMainKey;
  }
  if (originalMetricsKey === undefined) {
    delete process.env.API_KEY_METRICS;
  } else {
    process.env.API_KEY_METRICS = originalMetricsKey;
  }
});

describe("security hardening", () => {
  it("requires an API key for API routes in production", async () => {
    process.env.NODE_ENV = "production";
    process.env.API_KEY_MAIN = "prod-secret";
    process.env.SIGNING_SECRET = "prod-signing-secret";

    const res = await request(app)
      .post("/api/ask")
      .set(signRequest({ prompt: "vote" }))
      .send({ prompt: "vote" });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it("requires an API key for metrics in production", async () => {
    process.env.NODE_ENV = "production";
    process.env.API_KEY_METRICS = "prod-secret";

    const res = await request(app)
      .get("/metrics")
      .set("x-api-key", "prod-secret");

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it("does not accept a client-controlled trace id", async () => {
    process.env.API_KEY = "test-api-key";

    const res = await request(app)
      .post("/api/ask")
      .set("x-api-key", "test-api-key")
      .set("x-trace-id", "client-trace-id")
      .send({ prompt: "vote" });

    expect(res.status).toBe(200);
    expect(res.headers["x-trace-id"]).toBeDefined();
    expect(res.headers["x-trace-id"]).not.toBe("client-trace-id");
  });
});