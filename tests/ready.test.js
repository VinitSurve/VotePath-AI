import request from "supertest";
import { describe, it, expect } from "vitest";
import { app } from "../server.js";

describe("GET /ready", () => {
  it("reports readiness in the unified response contract", async () => {
    const res = await request(app).get("/ready");

    expect(res.status).toBe(process.env.GEMINI_API_KEY ? 200 : 500);
    expect(res.body).toHaveProperty("success");
    expect(res.body).toHaveProperty("data");
    expect(res.body).toHaveProperty("errorType");
    expect(res.body).toHaveProperty("statusCode");
    expect(res.body).toHaveProperty("requestId");
    expect(res.body.data).toHaveProperty("ready");
    expect(res.body.data.ready).toBe(Boolean(process.env.GEMINI_API_KEY));
  });
});
