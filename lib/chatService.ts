// lib/chatService.ts

import type { Message } from "../types/chat";

import {
  resolveModelPolicy,
} from "./assistant/demoModelPolicy";

import {
  registerLocalProxy,
} from "./server/registerLocalProxy";

registerLocalProxy();

/**
 * مسیر رسمی Chat Completions در OpenRouter
 */
const OPENROUTER_CHAT_COMPLETIONS_URL =
  "https://openrouter.ai/api/v1/chat/completions";


/**
 * دریافت امن کلید OpenRouter
 *
 * کلید فقط از متغیر محیطی سمت سرور خوانده می‌شود
 * و نباید در کد Client قرار گیرد.
 */
function getOpenRouterApiKey(): string {
  const apiKey =
    process.env.OPENROUTER_API_KEY?.trim();

  if (!apiKey) {
    throw new Error(
      "OPENROUTER_API_KEY is not configured."
    );
  }

  return apiKey;
}


/**
 * اطمینان از داشتن پروتکل در URL
 */
function normalizeSiteUrl(
  value: string
): string {
  const cleanValue =
    value.trim();

  if (
    cleanValue.startsWith("http://") ||
    cleanValue.startsWith("https://")
  ) {
    return cleanValue;
  }

  return `https://${cleanValue}`;
}


/**
 * تعیین آدرس سایت
 *
 * ترتیب انتخاب:
 * 1. متغیر اختصاصی پروژه
 * 2. دامنه اصلی پروژه در Vercel
 * 3. دامنه Deployment در Vercel
 * 4. localhost در محیط توسعه
 */
function getApplicationUrl(): string {
  const configuredSiteUrl =
    process.env.OPENROUTER_SITE_URL?.trim();

  if (configuredSiteUrl) {
    return normalizeSiteUrl(
      configuredSiteUrl
    );
  }

  const vercelHost =
    process.env
      .VERCEL_PROJECT_PRODUCTION_URL
      ?.trim() ||
    process.env.VERCEL_URL?.trim();

  if (vercelHost) {
    return normalizeSiteUrl(
      vercelHost
    );
  }

  return "http://localhost:3000";
}


/**
 * عنوان برنامه در OpenRouter
 */
function getApplicationTitle(): string {
  return (
    process.env
      .OPENROUTER_APP_TITLE
      ?.trim() ||
    "UAST AI Assistant"
  );
}


/**
 * ارسال پیام‌ها به مدل انتخاب‌شده در OpenRouter
 *
 * این تابع فقط مسئول ارتباط با OpenRouter است.
 * تصمیم‌گیری درباره مدل در demoModelPolicy انجام می‌شود.
 */
export async function getOpenRouterStream(
  messages: Message[],
  model?: string | null
): Promise<Response> {
  /**
   * جلوگیری از ارسال درخواست خالی
   */
  if (
    !Array.isArray(messages) ||
    messages.length === 0
  ) {
    throw new Error(
      "At least one chat message is required."
    );
  }

  const apiKey =
    getOpenRouterApiKey();

  const modelPolicy =
    resolveModelPolicy(model);

  const applicationUrl =
    getApplicationUrl();

  const applicationTitle =
    getApplicationTitle();

  /**
   * لاگ توسعه‌ای برای کنترل مصرف.
   * در Production هم اطلاعات حساس چاپ نمی‌کند.
   */
  console.log(
    "[model-policy]",
    {
      requestedModel:
        modelPolicy.requestedModel,

      resolvedModel:
        modelPolicy.resolvedModel,

      usageTier:
        modelPolicy.usageTier,

      maxOutputTokens:
        modelPolicy.maxOutputTokens,

      isFree:
        modelPolicy.isFree,

      allowPaidFallback:
        modelPolicy.allowPaidFallback,
    }
  );

  /**
   * درخواست اصلی به OpenRouter
   */
  return fetch(
    OPENROUTER_CHAT_COMPLETIONS_URL,
    {
      method: "POST",

      headers: {
        Authorization:
          `Bearer ${apiKey}`,

        "Content-Type":
          "application/json",

        Accept:
          "text/event-stream",

        /**
         * آدرس و عنوان برنامه برای شناسایی برنامه در OpenRouter
         */
        "HTTP-Referer":
          applicationUrl,

        /**
         * برای سازگاری بیشتر با OpenRouter
         */
        "X-Title":
          applicationTitle,

        "X-OpenRouter-Title":
          applicationTitle,
      },

      body: JSON.stringify({
        /**
         * مدل نهایی و امن‌شده
         */
        model:
          modelPolicy.resolvedModel,

        messages,

        /**
         * کنترل مصرف خروجی
         */
        max_tokens:
          modelPolicy.maxOutputTokens,

        /**
         * پاسخ به‌صورت تدریجی به رابط کاربری ارسال می‌شود
         */
        stream:
          true,
      }),
    }
  );
}