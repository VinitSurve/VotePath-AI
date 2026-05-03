import request from "supertest";
import { describe, it, expect, afterEach } from "vitest";
import { app } from "../server.js";

const originalApiKey = process.env.API_KEY;

afterEach(() => {
  if (originalApiKey === undefined) {
    delete process.env.API_KEY;
  } else {
    process.env.API_KEY = originalApiKey;
  }
});

describe("GET /ready", () => {
  it("reports readiness based on GEMINI_API_KEY presence", async () => {
    delete process.env.API_KEY;

    const res = await request(app).get("/ready");
    const expectedStatus = process.env.GEMINI_API_KEY ? 200 : 500;

    expect(res.status).toBe(expectedStatus);
    expect(res.body).toHaveProperty("ready");
    expect(res.body.ready).toBe(Boolean(process.env.GEMINI_API_KEY));
  });
});
