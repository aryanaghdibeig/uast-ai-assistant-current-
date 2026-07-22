// lib/server/registerLocalProxy.ts

import {
  EnvHttpProxyAgent,
  setGlobalDispatcher,
} from "undici";

/**
 * این فایل فقط برای محیط توسعه محلی است.
 *
 * هدف:
 * وقتی Psiphon یا هر Proxy محلی فعال است،
 * fetchهای سمت سرور Next.js هم از همان مسیر عبور کنند.
 *
 * در Vercel / Production هیچ کاری انجام نمی‌دهد.
 */

let proxyRegistered = false;

export function registerLocalProxy() {
  if (proxyRegistered) {
    return;
  }

  /**
   * در Production فعال نشود.
   */
  if (process.env.NODE_ENV === "production") {
    return;
  }

  const hasProxy =
    Boolean(process.env.HTTP_PROXY) ||
    Boolean(process.env.HTTPS_PROXY) ||
    Boolean(process.env.http_proxy) ||
    Boolean(process.env.https_proxy);

  if (!hasProxy) {
    return;
  }

  const proxyAgent =
    new EnvHttpProxyAgent();

  setGlobalDispatcher(proxyAgent);

  proxyRegistered = true;

  console.log(
    "[local-proxy] Server-side fetch is using local proxy settings."
  );
}