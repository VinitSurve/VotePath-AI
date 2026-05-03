/**
 * VotePath AI - API Service
 * Centralized API calls for clean architecture and better maintainability.
 */

let securityBootstrapCache = null;

async function getSecurityBootstrap() {
  if (securityBootstrapCache) {
    return securityBootstrapCache;
  }

  const response = await fetch("/security/bootstrap", {
    method: "GET",
    credentials: "include"
  });

  const payload = await response.json();
  if (!payload?.success || !payload?.data) {
    throw new Error("Unable to bootstrap security tokens");
  }

  securityBootstrapCache = payload.data;
  return securityBootstrapCache;
}

async function signRequest({ method, path, body }) {
  const bootstrap = await getSecurityBootstrap();
  const timestamp = String(Date.now());
  const nonce = crypto.randomUUID();

  const response = await fetch("/security/sign", {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      "X-CSRF-Token": bootstrap.csrfToken || ""
    },
    body: JSON.stringify({ method, path, body, timestamp, nonce })
  });

  const payload = await response.json();
  if (!payload?.success || !payload?.data?.signature) {
    throw new Error("Unable to sign request");
  }

  return {
    csrfToken: bootstrap.csrfToken || "",
    timestamp,
    nonce,
    signature: payload.data.signature
  };
}

function parseSseBlock(block) {
  const lines = block.split("\n").map((line) => line.trim()).filter(Boolean);
  const eventLine = lines.find((line) => line.startsWith("event:"));
  const dataLine = lines.find((line) => line.startsWith("data:"));
  const event = eventLine ? eventLine.slice(6).trim() : "message";
  const data = dataLine ? dataLine.slice(5).trim() : "";
  return { event, data };
}

async function readStreamResponse(response, { onChunk, signal } = {}) {
  if (!response.body) {
    throw new Error("Missing stream body");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let completePayload = null;

  while (true) {
    if (signal?.aborted) {
      reader.cancel();
      throw new Error("TIMEOUT");
    }

    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });

    let separatorIndex = buffer.indexOf("\n\n");
    while (separatorIndex >= 0) {
      const block = buffer.slice(0, separatorIndex);
      buffer = buffer.slice(separatorIndex + 2);
      const { event, data } = parseSseBlock(block);

      if (event === "message") {
        try {
          const parsed = JSON.parse(data);
          if (typeof parsed.partial === "string" && onChunk) {
            onChunk(parsed.partial);
          }
        } catch {
          if (onChunk) onChunk(data);
        }
      }

      if (event === "end") {
        completePayload = data ? JSON.parse(data) : null;
      }

      separatorIndex = buffer.indexOf("\n\n");
    }
  }

  return completePayload;
}

export const askVotePathAI = async (prompt, mode, language, context = null, options = {}) => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000);
  const mergedSignal = options.signal || controller.signal;
  const stream = Boolean(options.stream || options.onChunk);
  const endpoint = stream ? "/api/ask/stream" : "/api/ask";
  const body = JSON.stringify({ prompt, mode, language, context });

  try {
    const signed = await signRequest({ method: "POST", path: endpoint, body });

    const headers = {
      "Content-Type": "application/json",
      "X-CSRF-Token": signed.csrfToken,
      "X-Timestamp": signed.timestamp,
      "X-Nonce": signed.nonce,
      "X-Signature": signed.signature
    };

    if (stream) {
      const response = await fetch(endpoint, {
        method: "POST",
        headers,
        body,
        signal: mergedSignal,
        credentials: "include"
      });

      if (!response.ok) {
        const retryAfter = parseInt(response.headers.get("Retry-After") || "2", 10) * 1000;
        const retryableStatus = [408, 429, 500, 502, 503, 504];
        if (retryableStatus.includes(response.status)) {
          throw new Error(`RETRY_AFTER_${retryAfter}`);
        }
      }

      const finalPayload = await readStreamResponse(response, {
        onChunk: options.onChunk,
        signal: mergedSignal
      });
      clearTimeout(timeoutId);

      if (finalPayload?.success === false) {
        console.error("API Error:", finalPayload.errorType, finalPayload.requestId);
        return finalPayload.data;
      }

      return finalPayload?.response || finalPayload?.data || finalPayload;
    }

    const response = await fetch(endpoint, {
      method: "POST",
      headers,
      body,
      signal: mergedSignal,
      credentials: "include"
    });

    clearTimeout(timeoutId);
    const payload = await response.json();

    if (!payload || typeof payload !== "object") {
      throw new Error("Invalid server response");
    }

    if (!response.ok) {
      const retryAfter = parseInt(response.headers.get("Retry-After") || "2", 10) * 1000;
      const retryableStatus = [408, 429, 500, 502, 503, 504];
      if (retryableStatus.includes(response.status)) {
        throw new Error(`RETRY_AFTER_${retryAfter}`);
      }
    }

    if (payload.success === false) {
      console.error("API Error:", payload.errorType, payload.requestId);
      return payload.data;
    }

    return payload.data;
  } catch (error) {
    clearTimeout(timeoutId);

    if (error.name === "AbortError") {
      console.error("API Timeout", { error: error.message });
      throw new Error("TIMEOUT");
    }

    console.error("API Error:", error);
    throw error;
  }
};
