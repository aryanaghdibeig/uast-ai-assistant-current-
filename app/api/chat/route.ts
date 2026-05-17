// ---------------------------
// ✅ تنظیم محیط اجرا برای Node.js
// ---------------------------
export const runtime = "nodejs";

import { NextRequest } from "next/server";
import { buildFilesContext } from "../../../lib/file-utils"; // مسیر نسبی را مطمئن چک کن

type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: any;
};

// ---------------------------
// ✅ هندلر اصلی
// ---------------------------
export async function POST(req: NextRequest) {
  try {
    // ---------------------------
    // ✴️ API Key
    // ---------------------------
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
      console.error("❌ Missing OpenRouter API Key");
      return new Response("Missing OpenRouter API Key", { status: 500 });
    }

    // ---------------------------
    // ✴️ خواندن داده‌ها از فرم
    // ---------------------------
    const formData = await req.formData();
    const message = formData.get("message") as string;
    const historyRaw = formData.get("history") as string | null;
    const files = formData.getAll("files") as File[];

    // ---------------------------
    // ✴️ پارس امن تاریخچه گفتگو
    // ---------------------------
    let history: ChatMessage[] = [];
    try {
      history = historyRaw ? JSON.parse(historyRaw) : [];
    } catch (err) {
      console.warn("⚠️ Invalid history JSON:", err);
      history = [];
    }

    // ---------------------------
    // ✴️ آماده‌سازی فایل‌ها
    // ---------------------------
    const { textContext, images } = await buildFilesContext(files);

    // ---------------------------
    // ✴️ ساخت پیام نهایی برای مدل
    // ---------------------------
    const currentDate = new Date().toISOString();
    const messages: ChatMessage[] = [
      {
        role: "system",
        content: `Assistant of University of Applied Science. Date: ${currentDate}`,
      },
      ...history,
      {
        role: "user",
        content: [
          { type: "text", text: message },
          ...textContext,
          ...images,
        ],
      },
    ];

    // ---------------------------
    // ✴️ درخواست به مدل از طریق OpenRouter
    // ---------------------------
    const response = await fetch("https://api.openai.com/v1/models", {
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`
      }
    });

    // ---------------------------
    // ✴️ هندلِ استریم خروجی به مرورگر
    // ---------------------------
    if (!response.ok || !response.body) {
      console.error("❌ Model response failed:", response.status, await response.text());
      return new Response("Model response error", { status: 500 });
    }

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        const reader = response.body!.getReader();
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          controller.enqueue(value);
        }
        controller.close();
      },
    });

    return new Response(stream, { headers: { "Content-Type": "text/plain; charset=utf-8" } });

  } catch (err) {
    // ---------------------------
    // ✴️ خطای کلی سرور (برای دیباگ)
    // ---------------------------
    console.error("🚨 Internal Server Error:", err);
    return new Response("Internal server error", { status: 500 });
  }
}
