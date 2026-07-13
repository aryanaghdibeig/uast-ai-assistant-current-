// app/api/conversations/route.ts

import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { AssistantModeId } from "@/types/chat";
import { isValidAssistantModeId } from "@/lib/assistant/prompts";

type DbMessage = {
  id: string;
  conversation_id: string;
  role: "user" | "assistant" | "system";
  content: string;
  created_at: string;
};

type DbConversation = {
  id: string;
  title: string;
  assistant_mode: string;
  created_at: string;
  updated_at: string;
};

async function getAuthenticatedUser() {
  const supabase = await createSupabaseServerClient();

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  return {
    supabase,
    user,
    error,
  };
}

function getSafeAssistantMode(value: unknown): AssistantModeId {
  if (typeof value === "string" && isValidAssistantModeId(value)) {
    return value;
  }

  return "general";
}

export async function GET() {
  try {
    const { supabase, user, error: userError } = await getAuthenticatedUser();

    if (userError || !user) {
      return NextResponse.json(
        {
          ok: false,
          message: "Unauthorized",
        },
        { status: 401 }
      );
    }

    const { data: conversations, error: conversationsError } = await supabase
      .from("conversations")
      .select("id,title,assistant_mode,created_at,updated_at")
      .eq("user_id", user.id)
      .order("updated_at", { ascending: false });

    if (conversationsError) {
      return NextResponse.json(
        {
          ok: false,
          message: "Could not load conversations.",
          error: conversationsError.message,
        },
        { status: 500 }
      );
    }

    const conversationList = (conversations || []) as DbConversation[];
    const conversationIds = conversationList.map((item) => item.id);

    if (conversationIds.length === 0) {
      return NextResponse.json({
        ok: true,
        conversations: [],
      });
    }

    const { data: messages, error: messagesError } = await supabase
      .from("messages")
      .select("id,conversation_id,role,content,created_at")
      .in("conversation_id", conversationIds)
      .eq("user_id", user.id)
      .order("created_at", { ascending: true });

    if (messagesError) {
      return NextResponse.json(
        {
          ok: false,
          message: "Could not load messages.",
          error: messagesError.message,
        },
        { status: 500 }
      );
    }

    const messageList = (messages || []) as DbMessage[];

    const conversationsWithMessages = conversationList.map((conversation) => ({
      id: conversation.id,
      title: conversation.title,
      assistantMode: getSafeAssistantMode(conversation.assistant_mode),
      messages: messageList
        .filter((message) => message.conversation_id === conversation.id)
        .filter(
          (message) => message.role === "user" || message.role === "assistant"
        )
        .map((message) => ({
          role: message.role as "user" | "assistant",
          content: message.content,
        })),
    }));

    return NextResponse.json({
      ok: true,
      conversations: conversationsWithMessages,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        message: "Conversation GET failed.",
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const { supabase, user, error: userError } = await getAuthenticatedUser();

    if (userError || !user) {
      return NextResponse.json(
        {
          ok: false,
          message: "Unauthorized",
        },
        { status: 401 }
      );
    }

    const body = await req.json().catch(() => ({}));

    const title =
      typeof body.title === "string" && body.title.trim()
        ? body.title.trim()
        : "گفتگوی جدید";

    const assistantMode = getSafeAssistantMode(body.assistantMode);

    const { data, error } = await supabase
      .from("conversations")
      .insert({
        user_id: user.id,
        title,
        assistant_mode: assistantMode,
      })
      .select("id,title,assistant_mode,created_at,updated_at")
      .single();

    if (error) {
      return NextResponse.json(
        {
          ok: false,
          message: "Could not create conversation.",
          error: error.message,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      conversation: {
        id: data.id,
        title: data.title,
        assistantMode: getSafeAssistantMode(data.assistant_mode),
        messages: [],
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        message: "Conversation POST failed.",
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const { supabase, user, error: userError } = await getAuthenticatedUser();

    if (userError || !user) {
      return NextResponse.json(
        {
          ok: false,
          message: "Unauthorized",
        },
        { status: 401 }
      );
    }

    const body = await req.json().catch(() => ({}));

    const conversationId =
      typeof body.conversationId === "string"
        ? body.conversationId.trim()
        : "";

    const assistantMode = getSafeAssistantMode(body.assistantMode);

    if (!conversationId) {
      return NextResponse.json(
        {
          ok: false,
          message: "Conversation id is required.",
        },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from("conversations")
      .update({
        assistant_mode: assistantMode,
        updated_at: new Date().toISOString(),
      })
      .eq("id", conversationId)
      .eq("user_id", user.id)
      .select("id,title,assistant_mode,created_at,updated_at")
      .single();

    if (error) {
      return NextResponse.json(
        {
          ok: false,
          message: "Could not update conversation mode.",
          error: error.message,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      conversation: {
        id: data.id,
        title: data.title,
        assistantMode: getSafeAssistantMode(data.assistant_mode),
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        message: "Conversation PATCH failed.",
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { supabase, user, error: userError } = await getAuthenticatedUser();

    if (userError || !user) {
      return NextResponse.json(
        {
          ok: false,
          message: "Unauthorized",
        },
        { status: 401 }
      );
    }

    const conversationId = req.nextUrl.searchParams.get("id");

    if (!conversationId) {
      return NextResponse.json(
        {
          ok: false,
          message: "Conversation id is required.",
        },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from("conversations")
      .delete()
      .eq("id", conversationId)
      .eq("user_id", user.id)
      .select("id");

    if (error) {
      return NextResponse.json(
        {
          ok: false,
          message: "Could not delete conversation.",
          error: error.message,
        },
        { status: 500 }
      );
    }

    if (!data || data.length === 0) {
      return NextResponse.json(
        {
          ok: false,
          message: "Conversation not found or access denied.",
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      ok: true,
      message: "Conversation deleted.",
      deletedConversationId: conversationId,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        message: "Conversation DELETE failed.",
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}