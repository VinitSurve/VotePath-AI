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

const originalApiKey = process.env.API_KEY;

beforeEach(() => {
  process.env.API_KEY = "test-api-key";
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
  if (originalApiKey === undefined) {
    delete process.env.API_KEY;
  } else {
    process.env.API_KEY = originalApiKey;
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
    const res = await request(app)
      .post("/api/ask")
      .set("x-api-key", "test-api-key")
      .send({ prompt: "vote" });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.requestId).toBeDefined();
  });
});
