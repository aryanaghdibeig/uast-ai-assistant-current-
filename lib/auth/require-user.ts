// lib/auth/require-user.ts
//
// Language-agnostic server authentication helper.
// Validates the Supabase cookie session only.
// Does not contain UI copy, prompts, or product language assumptions.

import type {
  User,
  AuthError,
} from "@supabase/supabase-js";

import {
  NextResponse,
} from "next/server";

import {
  createSupabaseServerClient,
} from "@/lib/supabase/server";


type SupabaseServerClient =
  Awaited<
    ReturnType<
      typeof createSupabaseServerClient
    >
  >;


export type AuthenticatedContext = {
  supabase:
    SupabaseServerClient;

  user:
    User;
};


export type RequireUserUnauthorizedFormat =
  | "json"
  | "text";


type RequireUserOptions = {
  /**
   * Preserves existing route 401 contracts:
   * - "json"  → NextResponse.json({ ok: false, message: "Unauthorized" }, { status: 401 })
   * - "text"  → new Response("Unauthorized", { status: 401 })  (e.g. /api/chat)
   */
  unauthorizedFormat?:
    RequireUserUnauthorizedFormat;
};


export type RequireUserResult =
  | ({
      ok:
        true;
    } & AuthenticatedContext)
  | {
      ok:
        false;

      error:
        AuthError | null;

      response:
        Response;
    };


/**
 * Builds the unauthorized HTTP response matching the calling route's
 * historical contract. Message body is intentional protocol text, not UI.
 */
export function createUnauthorizedResponse(
  format:
    RequireUserUnauthorizedFormat =
      "json"
):
  Response {
  if (
    format ===
    "text"
  ) {
    return new Response(
      "Unauthorized",

      {
        status:
          401,
      }
    );
  }

  return NextResponse.json(
    {
      ok:
        false,

      message:
        "Unauthorized",
    },

    {
      status:
        401,
    }
  );
}


/**
 * Validates the current Supabase server session.
 *
 * On success: returns supabase client + authenticated user.
 * On failure: returns a ready-made 401 Response using the requested format.
 */
export async function requireUser(
  options:
    RequireUserOptions =
      {}
):
  Promise<
    RequireUserResult
  > {
  const unauthorizedFormat =
    options.unauthorizedFormat ??
    "json";


  const supabase =
    await createSupabaseServerClient();


  const {
    data: {
      user,
    },

    error,
  } =
    await supabase
      .auth
      .getUser();


  if (
    error ||
    !user
  ) {
    return {
      ok:
        false,

      error:
        error ??
        null,

      response:
        createUnauthorizedResponse(
          unauthorizedFormat
        ),
    };
  }


  return {
    ok:
      true,

    supabase,

    user,
  };
}
