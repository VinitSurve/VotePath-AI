import { randomUUID } from "crypto";

export function createTraceContext(traceId = randomUUID(), parentSpanId = null) {
  return {
    traceId,
    parentSpanId,
    spanId: randomUUID(),
    startedAt: Date.now()
  };
}

export function startSpan(name, context = {}) {
  return {
    name,
    traceId: context.traceId || randomUUID(),
    parentSpanId: context.parentSpanId || null,
    spanId: randomUUID(),
    startedAt: Date.now()
  };
}

export function finishSpan(span, log, meta = {}) {
  const durationMs = Date.now() - span.startedAt;
  log("info", "span.finish", {
    spanName: span.name,
    traceId: span.traceId,
    parentSpanId: span.parentSpanId,
    spanId: span.spanId,
    durationMs,
    ...meta
  });
  return durationMs;
}
