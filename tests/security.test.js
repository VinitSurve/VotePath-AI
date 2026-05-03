import request from "supertest";
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

import { app } from "../server.js";

const originalNodeEnv = process.env.NODE_ENV;
const originalApiKey = process.env.API_KEY;

beforeEach(() => {
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
  if (originalApiKey === undefined) {
    delete process.env.API_KEY;
  } else {
    process.env.API_KEY = originalApiKey;
  }
});

describe("security hardening", () => {
  it("requires an API key for API routes in production", async () => {
    process.env.NODE_ENV = "production";
    process.env.API_KEY = "prod-secret";

    const res = await request(app).post("/api/ask").send({ prompt: "vote" });

    expect(res.status).toBe(401);
    expect(res.body.errorType).toBe("UNAUTHORIZED");
  });

  it("requires an API key for metrics in production", async () => {
    process.env.NODE_ENV = "production";
    process.env.API_KEY = "prod-secret";

    const res = await request(app).get("/metrics");

    expect(res.status).toBe(401);
    expect(res.body.errorType).toBe("UNAUTHORIZED");
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