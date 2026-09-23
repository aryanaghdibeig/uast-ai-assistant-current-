// lib/server/request-id.ts
// Correlation id for chat/API requests (Stage 1 leftover / Stage 2 wiring).

import type { NextRequest } from "next/server";

const HEADER_NAME = "x-request-id";
const ALIAS_HEADER = "x-uast-request-id";

export function createRequestId(request?: NextRequest): string {
  const incoming =
    request?.headers.get(HEADER_NAME)?.trim() ||
    request?.headers.get(ALIAS_HEADER)?.trim();

  if (incoming && /^[a-zA-Z0-9._-]{8,128}$/.test(incoming)) {
    return incoming;
  }

  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `req_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

export function withRequestIdHeaders(
  headers: HeadersInit | undefined,
  requestId: string
): Headers {
  const next = new Headers(headers);
  next.set(HEADER_NAME, requestId);
  next.set(ALIAS_HEADER, requestId);
  return next;
}

export function jsonWithRequestId(
  body: unknown,
  init: ResponseInit & { requestId: string }
): Response {
  const { requestId, ...rest } = init;
  return Response.json(body, {
    ...rest,
    headers: withRequestIdHeaders(rest.headers, requestId),
  });
}
