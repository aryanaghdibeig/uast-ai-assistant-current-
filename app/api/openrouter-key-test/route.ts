// app/api/openrouter-key-test/route.ts

import {
  NextResponse,
} from "next/server";

import {
  createSupabaseServerClient,
} from "@/lib/supabase/server";


export const runtime =
  "nodejs";


export const dynamic =
  "force-dynamic";


export async function GET() {
  try {
    /* ================================================
       1. بررسی ورود کاربر
    ================================================= */

    const supabase =
      await createSupabaseServerClient();


    const {
      data: {
        user,
      },

      error:
        userError,
    } =
      await supabase
        .auth
        .getUser();


    if (
      userError ||
      !user
    ) {
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


    /* ================================================
       2. خواندن کلید از Environment
    ================================================= */

    const apiKey =
      process
        .env
        .OPENROUTER_API_KEY
        ?.trim();


    if (
      !apiKey
    ) {
      return NextResponse.json(
        {
          ok:
            false,

          message:
            "OPENROUTER_API_KEY is missing from .env.local.",
        },

        {
          status:
            500,
        }
      );
    }


    /* ================================================
       3. بررسی اطلاعات کلید در OpenRouter
    ================================================= */

    const response =
      await fetch(
        "https://openrouter.ai/api/v1/key",

        {
          method:
            "GET",

          headers: {
            Authorization:
              `Bearer ${apiKey}`,

            Accept:
              "application/json",

            "HTTP-Referer":
              "http://localhost:3000",

            "X-OpenRouter-Title":
              "UAST Intelligent Assistant",
          },

          cache:
            "no-store",
        }
      );


    const responseText =
      await response
        .text();


    let responseData:
      unknown;


    try {
      responseData =
        JSON.parse(
          responseText
        );
    } catch {
      responseData = {
        raw:
          responseText,
      };
    }


    /* ================================================
       4. نمایش خطای واقعی OpenRouter
    ================================================= */

    if (
      !response.ok
    ) {
      return NextResponse.json(
        {
          ok:
            false,

          message:
            "OpenRouter rejected the API key.",

          openRouterStatus:
            response.status,

          openRouterResponse:
            responseData,

          keyDetected:
            true,

          keyPrefix:
            `${apiKey.slice(
              0,
              8
            )}...`,
        },

        {
          status:
            response.status,
        }
      );
    }


    /* ================================================
       5. پاسخ موفق
    ================================================= */

    return NextResponse.json({
      ok:
        true,

      message:
        "OpenRouter API key is valid.",

      keyDetected:
        true,

      keyPrefix:
        `${apiKey.slice(
          0,
          8
        )}...`,

      openRouter:
        responseData,
    });
  } catch (
    error
  ) {
    console.error(
      "OpenRouter key test error:",

      error
    );


    return NextResponse.json(
      {
        ok:
          false,

        message:
          "OpenRouter key test failed.",

        error:
          error instanceof
          Error
            ? error.message
            : "Unknown error",
      },

      {
        status:
          500,
        }
      );
  }
}