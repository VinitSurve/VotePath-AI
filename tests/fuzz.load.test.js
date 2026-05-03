import request from "supertest";
import { describe, it, expect, beforeEach, vi } from "vitest";

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

process.env.ENABLE_RATE_LIMIT_TEST = "true";

import { app, clearRequestLog } from "../server.js";

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

describe("fuzz and load coverage", () => {
  it("handles malformed payloads and random inputs safely", async () => {
    const payloads = [
      { prompt: null },
      { prompt: 123 },
      { prompt: { nested: true } },
      { prompt: "" },
      { prompt: "abc" },
      { prompt: "x".repeat(600) }
    ];

    for (const payload of payloads) {
      const response = await request(app).post("/api/ask").send(payload);
      expect([200, 400, 429]).toContain(response.status);
      expect(typeof response.body.success).toBe("boolean");
    }
  });

  it("survives multiple parallel calls under load", async () => {
    const requests = Array(20).fill().map(() =>
      request(app).post("/api/ask").send({ prompt: "How do I vote?" })
    );

    const responses = await Promise.all(requests);

    expect(responses.some((response) => response.status === 200)).toBe(true);
    expect(responses.every((response) => [200, 429].includes(response.status))).toBe(true);
  });
});