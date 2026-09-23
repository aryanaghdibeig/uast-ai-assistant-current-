// app/api/followups/route.ts

import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/require-user";
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

function shouldPreferTemplateFollowups() {
  const mode =
    process.env.DEMO_FOLLOWUP_ACTIONS_MODE?.trim().toLowerCase();

  return (
    process.env.MOCK_AI === "true" ||
    mode === "template" ||
    mode === "rule" ||
    mode === "rule_based"
  );
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
- حالت دستیار: ${modeLabel}
- موضوع/عنوان: ${topic}
- عنوان گفتگو: ${conversationTitle}
- آخرین پیام کاربر: ${lastUserMessage || "نامشخص"}
- آخرین پاسخ دستیار: ${lastAssistantMessage || "نامشخص"}

قواعد سخت:
1) فقط JSON معتبر برگردان.
2) هیچ متن اضافه‌ای خارج از JSON ننویس.
3) دقیقاً بین 3 تا 6 اقدام بساز.
4) title کوتاه و فارسی باشد.
5) description یک جمله کوتاه فارسی باشد.
6) prompt یک دستور اجرایی کامل برای ادامه گفتگو باشد.
7) از markdown و code fence استفاده نکن.

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

/**
 * Best-effort JSON extraction. Never throws — returns null on failure.
 */
function tryExtractJsonObject(text: string): unknown | null {
  if (!text.trim()) {
    return null;
  }

  const cleaned = text
    .replace(/```json/gi, "")
    .replace(/```/g, "")
    .trim();

  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");

  if (start === -1 || end === -1 || end <= start) {
    return null;
  }

  try {
    return JSON.parse(cleaned.slice(start, end + 1));
  } catch {
    // Attempt a lighter repair: truncate trailing commas before closing braces.
    const candidate = cleaned
      .slice(start, end + 1)
      .replace(/,\s*([}\]])/g, "$1");

    try {
      return JSON.parse(candidate);
    } catch {
      return null;
    }
  }
}

function sanitizeAiActions(value: unknown): SmartFollowUpAction[] {
  if (!value || typeof value !== "object") {
    return [];
  }

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

function okFollowupsResponse(input: {
  source: string;
  modeId?: AssistantModeId;
  actions: SmartFollowUpAction[];
}) {
  return NextResponse.json({
    ok: true,
    source: input.source,
    ...(input.modeId ? { modeId: input.modeId } : {}),
    actions: input.actions,
  });
}

export async function POST(req: NextRequest) {
  let fallbackActions: SmartFollowUpAction[] = [];
  let modeId: AssistantModeId = "general";

  try {
    const auth = await requireUser({
      unauthorizedFormat: "json",
    });

    if (!auth.ok) {
      return auth.response;
    }

    const body = (await req.json().catch(() => ({}))) as FollowUpRequestBody;

    fallbackActions = getFallbackActions(body);
    modeId = getSafeModeId(body.modeId);

    if (shouldPreferTemplateFollowups()) {
      return okFollowupsResponse({
        source: "rule_based_template",
        modeId,
        actions: fallbackActions,
      });
    }

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

    let response: Response;

    try {
      response = await getOpenRouterStream(messages);
    } catch (networkError) {
      console.error("Followups OpenRouter network error:", networkError);

      return okFollowupsResponse({
        source: "fallback_after_network_error",
        modeId,
        actions: fallbackActions,
      });
    }

    if (!response.ok || !response.body) {
      return okFollowupsResponse({
        source: "fallback_after_model_error",
        modeId,
        actions: fallbackActions,
      });
    }

    const modelText = await readOpenRouterStreamText(response.body);
    const parsedJson = tryExtractJsonObject(modelText);

    if (!parsedJson) {
      console.warn(
        "Followups JSON parse skipped: no valid JSON object in model response."
      );

      return okFollowupsResponse({
        source: "fallback_parse_error",
        modeId,
        actions: fallbackActions,
      });
    }

    const aiActions = sanitizeAiActions(parsedJson);

    if (aiActions.length > 0) {
      return okFollowupsResponse({
        source: "ai",
        modeId,
        actions: aiActions,
      });
    }

    return okFollowupsResponse({
      source: "fallback_empty_ai_actions",
      modeId,
      actions: fallbackActions,
    });
  } catch (error) {
    console.error("Followups route error:", error);

    // Never crash the chat UI: always return template actions.
    return okFollowupsResponse({
      source: "fallback_after_route_error",
      modeId,
      actions:
        fallbackActions.length > 0
          ? fallbackActions
          : getSmartFollowUpActions({
              modeId: "general",
              topic: "",
              conversationTitle: "",
              lastUserMessage: "",
              lastAssistantMessage: "",
            }),
    });
  }
}
