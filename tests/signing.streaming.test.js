import request from "supertest";
import { createHmac, randomUUID } from "crypto";
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";

const mockGenerate = vi.fn();
const mockGenerateStream = vi.fn();

vi.mock("@google/generative-ai", () => {
  return {
    GoogleGenerativeAI: function () {
      return {
        getGenerativeModel: () => ({
          generateContent: mockGenerate,
          generateContentStream: mockGenerateStream
        })
      };
    }
  };
});

import { app, clearRequestLog } from "../server.js";

const originalNodeEnv = process.env.NODE_ENV;
const originalSecurityMode = process.env.SECURITY_MODE;
const originalSigningSecret = process.env.SIGNING_SECRET;
const originalApiKey = process.env.API_KEY_MAIN;

beforeEach(() => {
  process.env.NODE_ENV = "production";
  process.env.SECURITY_MODE = "strict";
  process.env.SIGNING_SECRET = "test-signing-secret";
  process.env.API_KEY_MAIN = "test-api-key";
  clearRequestLog();
  mockGenerate.mockReset();
  mockGenerateStream.mockReset();
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
  mockGenerateStream.mockResolvedValue({
    stream: (async function* () {
      yield { text: () => "Go " };
      yield { text: () => "vote" };
    })()
  });
});

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
  if (originalApiKey === undefined) {
    delete process.env.API_KEY_MAIN;
  } else {
    process.env.API_KEY_MAIN = originalApiKey;
  }
});

async function getSignedHeaders(body, path = "/api/ask") {
  const bodyString = JSON.stringify(body);
  const nonce = randomUUID();
  const signResponse = await request(app)
    .post("/security/sign")
    .send({
      method: "POST",
      path,
      body: bodyString,
      timestamp: String(Date.now()),
      nonce
    });

  expect(signResponse.status).toBe(200);
  return {
    "x-api-key": process.env.API_KEY_MAIN,
    "x-signature": signResponse.body.data.signature,
    "x-timestamp": signResponse.body.data.timestamp,
    "x-nonce": signResponse.body.data.nonce,
    "x-csrf-token": ""
  };
}

function signLocally({ body, path, timestamp, nonce }) {
  return createHmac("sha256", process.env.SIGNING_SECRET)
    .update(`POST${path}${body}${timestamp}${nonce}`)
    .digest("hex");
}

describe("request signing and streaming", () => {
  it("rejects requests without signing headers", async () => {
    const res = await request(app)
      .post("/api/ask")
      .set("x-api-key", process.env.API_KEY_MAIN)
      .send({ prompt: "How to vote" });

    expect(res.status).toBe(401);
    expect(res.body.errorType).toBe("MISSING_SIGNATURE");
  });

  it("rejects replayed nonces", async () => {
    const body = { prompt: "How to vote" };
    const headers = await getSignedHeaders(body);

    const first = await request(app)
      .post("/api/ask")
      .set(headers)
      .send(body);

    expect(first.status).toBe(200);

    const second = await request(app)
      .post("/api/ask")
      .set(headers)
      .send(body);

    expect(second.status).toBe(401);
    expect(second.body.errorType).toBe("REPLAY_DETECTED");
  });

  it("rejects expired timestamps", async () => {
    const body = { prompt: "How to vote" };
    const timestamp = String(Date.now() - (10 * 60 * 1000));
    const nonce = "expired-nonce";
    const bodyString = JSON.stringify(body);
    const signature = signLocally({ body: bodyString, path: "/api/ask", timestamp, nonce });

    const res = await request(app)
      .post("/api/ask")
      .set("x-api-key", process.env.API_KEY_MAIN)
      .set("x-signature", signature)
      .set("x-timestamp", timestamp)
      .set("x-nonce", nonce)
      .send(body);

    expect(res.status).toBe(401);
    expect(res.body.errorType).toBe("TIMESTAMP_EXPIRED");
  });

  it("streams chunks and completion events", async () => {
    const body = { prompt: "How to vote" };
    const headers = await getSignedHeaders(body, "/api/ask/stream");

    const res = await request(app)
      .post("/api/ask/stream")
      .set(headers)
      .send(body);

    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toContain("text/event-stream");
    expect(res.text).toContain("event: message");
    expect(res.text).toContain("event: end");
    expect(res.text).toContain("Go vote");
  });
});
