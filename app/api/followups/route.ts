// app/api/followups/route.ts

import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOpenRouterStream } from "@/lib/chatService";
import type { AssistantModeId, Message } from "@/types/chat";
import { isValidAssistantModeId } from "@/lib/assistant/prompts";
import {
  getSmartFollowUpActions,
  type SmartFollowUpAction,
} from "@/lib/assistant/followups";

type FollowUpRequestBody = {
  modeId?: string;
  topic?: string;
  conversationTitle?: string;
  lastUserMessage?: string;
  lastAssistantMessage?: string;
};

function cleanText(value: unknown, maxLength = 2500) {
  if (typeof value !== "string") return "";

  return value.replace(/\s+/g, " ").trim().slice(0, maxLength);
}

function getSafeModeId(value: unknown): AssistantModeId {
  if (typeof value === "string" && isValidAssistantModeId(value)) {
    return value;
  }

  return "general";
}

function getModeLabel(modeId: AssistantModeId) {
  switch (modeId) {
    case "official_letter":
      return "مکاتبات اداری";
    case "curriculum":
      return "برنامه‌درسی و مهارتی";
    case "research":
      return "پژوهش و فناوری";
    case "content":
      return "تولید محتوا";
    case "planning":
      return "برنامه‌ریزی و مدیریت";
    case "analysis":
      return "تحلیل اسناد";
    case "general":
    default:
      return "عمومی";
  }
}

function getFallbackActions(body: FollowUpRequestBody) {
  const modeId = getSafeModeId(body.modeId);

  return getSmartFollowUpActions({
    modeId,
    topic: cleanText(body.topic, 300),
    conversationTitle: cleanText(body.conversationTitle, 300),
    lastUserMessage: cleanText(body.lastUserMessage, 800),
    lastAssistantMessage: cleanText(body.lastAssistantMessage, 1200),
  });
}

function buildFollowUpPrompt(body: FollowUpRequestBody) {
  const modeId = getSafeModeId(body.modeId);

  const modeLabel = getModeLabel(modeId);
  const topic = cleanText(body.topic, 300) || "موضوع گفتگو";
  const conversationTitle =
    cleanText(body.conversationTitle, 300) || "بدون عنوان";
  const lastUserMessage = cleanText(body.lastUserMessage, 1000);
  const lastAssistantMessage = cleanText(body.lastAssistantMessage, 2200);

  return `
تو باید برای یک دستیار هوشمند دانشگاهی، اقدام‌های پیشنهادی بعدی تولید کنی.

اطلاعات گفتگو:
- حالت کاری: ${modeLabel}
- موضوع اصلی: ${topic}
- عنوان گفتگو: ${conversationTitle}
- آخرین پیام کاربر: ${lastUserMessage || "نامشخص"}
- آخرین پاسخ دستیار: ${lastAssistantMessage || "نامشخص"}

وظیفه:
۶ اقدام پیشنهادی بعدی تولید کن که دقیقاً متناسب با موضوع گفتگو، آخرین پیام کاربر و آخرین پاسخ دستیار باشد.

قواعد:
- زبان همه خروجی‌ها فارسی باشد.
- اقدام‌ها باید کاربردی، دقیق و قابل کلیک باشند.
- عنوان‌ها کوتاه باشند.
- توضیح‌ها کوتاه و روشن باشند.
- prompt باید دستور کامل برای ادامه گفتگو باشد.
- prompt باید طوری نوشته شود که وقتی کاربر آن را ارسال کرد، دستیار دقیقاً همان ادامه کار را انجام دهد.
- از پیشنهادهای خیلی عمومی و بی‌ربط پرهیز کن.
- خروجی فقط JSON معتبر باشد.
- هیچ توضیح اضافی، markdown، code fence یا متن بیرون JSON ننویس.

فرمت دقیق خروجی:
{
  "actions": [
    {
      "title": "عنوان کوتاه",
      "description": "توضیح کوتاه",
      "icon": "یک ایموجی مناسب",
      "prompt": "دستور کامل برای ادامه گفتگو"
    }
  ]
}
`.trim();
}

async function readOpenRouterStreamText(body: ReadableStream<Uint8Array>) {
  const reader = body.getReader();
  const decoder = new TextDecoder();

  let fullText = "";
  let buffer = "";

  while (true) {
    const { value, done } = await reader.read();

    if (done) break;

    buffer += decoder.decode(value, { stream: true });

    const lines = buffer.split("\n");
    buffer = lines.pop() || "";

    for (const line of lines) {
      const trimmedLine = line.trim();

      if (!trimmedLine.startsWith("data: ")) continue;

      const data = trimmedLine.replace("data: ", "").trim();

      if (!data || data === "[DONE]") continue;

      try {
        const json = JSON.parse(data);
        const content = json.choices?.[0]?.delta?.content || "";

        if (content) {
          fullText += content;
        }
      } catch {
        // بعضی chunkها ممکن است JSON کامل نباشند.
      }
    }
  }

  return fullText.trim();
}

function extractJsonObject(text: string) {
  const cleaned = text
    .replace(/```json/gi, "")
    .replace(/```/g, "")
    .trim();

  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");

  if (start === -1 || end === -1 || end <= start) {
    throw new Error("No JSON object found in model response.");
  }

  return JSON.parse(cleaned.slice(start, end + 1));
}

function sanitizeAiActions(value: unknown): SmartFollowUpAction[] {
  const parsed = value as {
    actions?: unknown;
  };

  const rawActions = Array.isArray(parsed?.actions) ? parsed.actions : [];

  const actions: SmartFollowUpAction[] = [];

  for (const rawAction of rawActions) {
    if (!rawAction || typeof rawAction !== "object") continue;

    const item = rawAction as {
      title?: unknown;
      description?: unknown;
      icon?: unknown;
      prompt?: unknown;
    };

    const title = cleanText(item.title, 70);
    const description = cleanText(item.description, 120);
    const prompt = cleanText(item.prompt, 1200);
    const icon = cleanText(item.icon, 6) || "✨";

    if (!title || !description || !prompt) continue;

    actions.push({
      id: `ai-followup-${actions.length + 1}`,
      title,
      description,
      icon,
      prompt,
    });

    if (actions.length >= 6) break;
  }

  return actions;
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createSupabaseServerClient();

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json(
        {
          ok: false,
          message: "Unauthorized",
        },
        { status: 401 }
      );
    }

    const body = (await req.json().catch(() => ({}))) as FollowUpRequestBody;

    const fallbackActions = getFallbackActions(body);

    if (process.env.MOCK_AI === "true") {
      return NextResponse.json({
        ok: true,
        source: "rule_based_mock",
        actions: fallbackActions,
      });
    }

    const modeId = getSafeModeId(body.modeId);
    const prompt = buildFollowUpPrompt(body);

    const messages: Message[] = [
      {
        role: "system",
        content:
          "تو یک موتور تولید اقدام‌های پیشنهادی برای رابط کاربری دستیار هوشمند هستی. فقط JSON معتبر تولید کن.",
      },
      {
        role: "user",
        content: prompt,
      },
    ];

    const response = await getOpenRouterStream(messages);

    if (!response.ok || !response.body) {
      return NextResponse.json({
        ok: true,
        source: "fallback_after_model_error",
        modeId,
        actions: fallbackActions,
      });
    }

    const modelText = await readOpenRouterStreamText(response.body);

    try {
      const parsedJson = extractJsonObject(modelText);
      const aiActions = sanitizeAiActions(parsedJson);

      if (aiActions.length > 0) {
        return NextResponse.json({
          ok: true,
          source: "ai",
          modeId,
          actions: aiActions,
        });
      }

      return NextResponse.json({
        ok: true,
        source: "fallback_empty_ai_actions",
        modeId,
        actions: fallbackActions,
      });
    } catch (parseError) {
      console.error("Followups JSON parse error:", parseError);

      return NextResponse.json({
        ok: true,
        source: "fallback_parse_error",
        modeId,
        actions: fallbackActions,
      });
    }
  } catch (error) {
    console.error("Followups route error:", error);

    return NextResponse.json(
      {
        ok: false,
        message: "Followups generation failed.",
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}