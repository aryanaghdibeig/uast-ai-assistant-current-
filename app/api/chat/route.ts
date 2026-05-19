export const runtime = "nodejs";
import { NextRequest } from "next/server";
import { buildFilesContext } from "../../../lib/file-utils";

export async function POST(req: NextRequest) {
  try {
    // ۱. استفاده از کلید اصلی OpenAI
    const apiKey = process.env.OPENAI_API_KEY; 
    if (!apiKey) {
      return new Response("Missing OPENAI_API_KEY", { status: 500 });
    }

    const formData = await req.formData();
    const message = formData.get("message") as string;
    const historyRaw = formData.get("history") as string | null;
    const files = formData.getAll("files") as File[];

    let history = historyRaw ? JSON.parse(historyRaw) : [];
    const { textContext, images } = await buildFilesContext(files);

    // ۲. تنظیم تاریخ شمسی برای هوشمندتر شدن پاسخ‌ها
    const options: any = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    const todayPersian = new Intl.DateTimeFormat('fa-IR', options).format(new Date());

    const messages = [
      {
        role: "system",
        content: `شما دستیار هوشمند دانشگاه جامع علمی کاربردی هستید. امروز ${todayPersian} است. پاسخ‌ها را بسیار کامل، با جزئیات و لحن محترمانه ارائه دهید.`
      },
      ...history,
      {
        role: "user",
        content: [{ type: "text", text: message }, ...textContext, ...images],
      },
    ];

    // ۳. درخواست مستقیم به API رسمی OpenAI
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o", // بهترین مدل برای فارسی. اگر هزینه مهم است از "gpt-4o-mini" استفاده کنید
        messages: messages,
        stream: true,
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      console.error("OpenAI Error:", err);
      return new Response(`OpenAI Error: ${response.status}`, { status: response.status });
    }

    // ۴. تصفیه استریم (مشابه قبل اما سازگار با OpenAI)
    const encoder = new TextEncoder();
    const decoder = new TextDecoder();
    const stream = new ReadableStream({
      async start(controller) {
        const reader = response.body!.getReader();
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const chunk = decoder.decode(value);
          const lines = chunk.split("\n");
          for (const line of lines) {
            const trimmedLine = line.trim();
            if (!trimmedLine || trimmedLine === "data: [DONE]") continue;
            if (trimmedLine.startsWith("data: ")) {
              try {
                const data = JSON.parse(trimmedLine.slice(6));
                const content = data.choices[0]?.delta?.content || "";
                if (content) controller.enqueue(encoder.encode(content));
              } catch (e) {}
            }
          }
        }
        controller.close();
      },
    });

    return new Response(stream, {
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });

  } catch (err) {
    console.error("Server Error:", err);
    return new Response("Internal error", { status: 500 });
  }
}
