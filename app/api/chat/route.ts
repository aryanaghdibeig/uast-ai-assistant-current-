import { NextRequest, NextResponse } from "next/server";
import { buildFilesContext } from "../../../lib/file-utils";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    // دریافت داده‌ها از فرانت‌اند
    const formData = await req.formData();
    const message = formData.get("message") as string;
    const historyRaw = formData.get("history") as string | null;
    const files = formData.getAll("files") as File[];

    let history = historyRaw ? JSON.parse(historyRaw) : [];

    // پردازش فایل‌ها (متن و تصاویر)
    const { textContext, images } = await buildFilesContext(files);

    // ساخت پیام نهایی
    const messages = [
      {
        role: "system",
        content: `شما دستیار هوشمند دانشگاه جامع علمی کاربردی هستید. امروز ${new Date().toLocaleDateString('fa-IR')} است. با لحن محترمانه، دقیق و کامل پاسخ دهید.`
      },
      ...history,
      {
        role: "user",
        // ساختار صحیح برای ارسال متن و تصویر
        content: [
          { type: "text", text: message + "\n\n" + textContext },
          ...images
        ],
      },
    ];

    // درخواست به OpenRouter
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://my-ai-assistant.ir", // آدرس سایت شما
        "X-Title": "My AI Assistant", // نام سایت شما
      },
      body: JSON.stringify({
        model: "openai/gpt-4o",
        messages: messages,
        stream: true,
        max_tokens: 1000, // این خط را اضافه کنید تا درخواست محدود شود
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      console.error("OpenRouter Error:", err);
      return new Response(`OpenRouter Error: ${err}`, { status: response.status });
    }

    // بازگرداندن استریم پاسخ به فرانت‌اند
    return new Response(response.body, {
      headers: { "Content-Type": "text/event-stream" },
    });

  } catch (err) {
    console.error("Server Error:", err);
    return new Response("Internal error", { status: 500 });
  }
}
