import request from "supertest";
import { describe, it, expect, vi, beforeEach } from "vitest";

const mockGenerate = vi.fn();

// Enable rate limit behavior in tests when explicitly set
process.env.ENABLE_RATE_LIMIT_TEST = 'true';

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

beforeEach(() => {
  mockGenerate.mockReset();
  // ensure requestLog is clean before each test
  try { clearRequestLog(); } catch (e) {}
});

describe("POST /api/ask", () => {

  it("returns valid structured response", async () => {
    mockGenerate.mockResolvedValue({
      response: {
        text: () =>
          JSON.stringify({
            title: "Voting",
            steps: [],
            simple: "Go vote",
            tips: [],
            source: "Election Commission of India"
          })
      }
    });

    const res = await request(app).post("/api/ask").send({
      prompt: "How to vote"
    });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toBeDefined();
    expect(res.body.requestId).toBeDefined();
  });

  it("rejects invalid input", async () => {
    const res = await request(app).post("/api/ask").send({
      prompt: null
    });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.errorType).toBe("INVALID_INPUT");
  });

  it("handles malformed AI response safely", async () => {
    mockGenerate.mockResolvedValue({
      response: { text: () => "{invalid-json" }
    });

    const res = await request(app).post("/api/ask").send({
      prompt: "test"
    });

    expect(res.status).toBe(200);
    expect(res.body.data).toBeDefined();
  });

  it("returns RATE_LIMIT when requests are too frequent", async () => {
    // First request should succeed
    mockGenerate.mockResolvedValueOnce({
      response: { text: () => JSON.stringify({ title: 'T', steps: [], simple: 'S', tips: [], source: 'Election Commission of India' }) }
    });
    const first = await request(app).post("/api/ask").send({ prompt: "vote" });

    // Immediately send the second request to trigger rate limit
    const second = await request(app).post("/api/ask").send({ prompt: "vote" });

    expect(second.body.errorType).toBe("RATE_LIMIT");
  });

  it("always returns consistent response structure", async () => {
    mockGenerate.mockResolvedValueOnce({
      response: { text: () => JSON.stringify({ title: 'T', steps: [], simple: 'S', tips: [], source: 'Election Commission of India' }) }
    });
    const res = await request(app).post("/api/ask").send({ prompt: "How to vote" });

    expect(res.body).toHaveProperty("success");
    expect(res.body).toHaveProperty("data");
    expect(res.body).toHaveProperty("requestId");
  });

  it("always returns valid response contract shape", async () => {
    mockGenerate.mockResolvedValueOnce({
      response: { text: () => JSON.stringify({ title: 'How to vote', steps: [], simple: 'Go vote', tips: [], source: 'Election Commission of India' }) }
    });

    const res = await request(app).post("/api/ask").send({
      prompt: "How to vote"
    });

    // Validate response envelope
    expect(res.body).toHaveProperty("success");
    expect(res.body).toHaveProperty("data");
    expect(res.body).toHaveProperty("errorType");
    expect(res.body).toHaveProperty("statusCode");
    expect(res.body).toHaveProperty("requestId");

    // Validate data shape
    expect(res.body.data).toHaveProperty("title");
    expect(res.body.data).toHaveProperty("steps");
    expect(Array.isArray(res.body.data.steps)).toBe(true);
    expect(res.body.data).toHaveProperty("simple");
    expect(res.body.data).toHaveProperty("tips");
    expect(Array.isArray(res.body.data.tips)).toBe(true);
    expect(res.body.data).toHaveProperty("source");
  });

  it("returns cached response on second request", async () => {
    mockGenerate.mockResolvedValueOnce({
      response: { text: () => JSON.stringify({ title: 'How to vote', steps: [], simple: 'Go vote', tips: [], source: 'Election Commission of India' }) }
    });

    const res1 = await request(app).post("/api/ask").send({
      prompt: "Cache test prompt"
    });

    expect(res1.status).toBe(200);
    expect(res1.body.data._meta.cached).toBe(false);

    // Clear rate limit to avoid hitting it on second request
    clearRequestLog();

    const res2 = await request(app).post("/api/ask").send({
      prompt: "Cache test prompt"
    });

    expect(res2.status).toBe(200);
    expect(res2.body.data._meta.cached).toBe(true);
  });

  it("returns rate limit headers", async () => {
    mockGenerate.mockResolvedValueOnce({
      response: { text: () => JSON.stringify({ title: 'T', steps: [], simple: 'S', tips: [], source: 'Election Commission of India' }) }
    });

    await request(app).post("/api/ask").send({ prompt: "vote" });
    
    const res = await request(app).post("/api/ask").send({ prompt: "vote" });

    expect(res.status).toBe(429);
    expect(res.headers["retry-after"]).toBeDefined();
    expect(res.body.data._meta.retryAfterMs).toBe(2000);
  });

  it("rejects long prompt", async () => {
    const res = await request(app).post("/api/ask").send({
      prompt: "a".repeat(600)
    });

    expect(res.status).toBe(400);
    expect(res.body.errorType).toBe("INVALID_INPUT");
  });

});
