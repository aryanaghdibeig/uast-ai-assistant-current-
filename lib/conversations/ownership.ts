// lib/conversations/ownership.ts
// Stage 2 — thin ownership helpers for Conversations module.
// Routes keep HTTP status/text; this only centralizes the ownership query.

import type { createSupabaseServerClient } from "@/lib/supabase/server";

type SupabaseServerClient = Awaited<
  ReturnType<typeof createSupabaseServerClient>
>;

type OwnershipQueryResult<T> = {
  conversation: T | null;
  error: { message: string } | null;
};

/**
 * Load a conversation that belongs to the given user.
 * Never trust client-supplied organization or ownership claims.
 */
export async function getOwnedConversation<T = Record<string, unknown>>(input: {
  supabase: SupabaseServerClient;
  userId: string;
  conversationId: string;
  select?: string;
}): Promise<OwnershipQueryResult<T>> {
  const conversationId = input.conversationId.trim();

  if (!conversationId) {
    return {
      conversation: null,
      error: null,
    };
  }

  const { data, error } = await input.supabase
    .from("conversations")
    .select(input.select ?? "id, title, user_id")
    .eq("id", conversationId)
    .eq("user_id", input.userId)
    .maybeSingle();

  return {
    conversation: (data as T | null) ?? null,
    error: error ? { message: error.message } : null,
  };
}

/**
 * Latest conversation for a user (by updated_at).
 */
export async function getLatestOwnedConversation<T = Record<string, unknown>>(input: {
  supabase: SupabaseServerClient;
  userId: string;
  select?: string;
}): Promise<OwnershipQueryResult<T>> {
  const { data, error } = await input.supabase
    .from("conversations")
    .select(input.select ?? "id, title, user_id")
    .eq("user_id", input.userId)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return {
    conversation: (data as T | null) ?? null,
    error: error ? { message: error.message } : null,
  };
}
