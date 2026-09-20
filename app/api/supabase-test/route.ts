// app/api/supabase-test/route.ts
//
// Diagnostic-only: probes DB with the service-role client.
// Never available anonymously. Blocked in production.
// Local/dev usage requires explicit opt-in: ALLOW_SUPABASE_TEST=true

import {
  NextResponse,
} from "next/server";

import {
  requireUser,
} from "@/lib/auth/require-user";

import {
  createSupabaseAdminClient,
} from "@/lib/supabase/admin";


function isProductionEnvironment() {
  return process.env.NODE_ENV === "production";
}


function isSupabaseTestAllowed() {
  return (
    process.env.ALLOW_SUPABASE_TEST ===
    "true"
  );
}


function notFoundResponse() {
  return new NextResponse(
    "Not Found",

    {
      status:
        404,

      headers: {
        "Cache-Control":
          "no-store",
      },
    }
  );
}


export async function GET() {
  try {
    /* -------------------------------------------------
       1. Production: never expose this diagnostic
          (defense in depth alongside proxy.ts)
    -------------------------------------------------- */

    if (
      isProductionEnvironment()
    ) {
      return notFoundResponse();
    }


    /* -------------------------------------------------
       2. Require an authenticated user session
          before any service-role usage
    -------------------------------------------------- */

    const auth =
      await requireUser({
        unauthorizedFormat:
          "json",
      });


    if (
      !auth.ok
    ) {
      return auth.response;
    }


    /* -------------------------------------------------
       3. Explicit local opt-in flag
    -------------------------------------------------- */

    if (
      !isSupabaseTestAllowed()
    ) {
      return notFoundResponse();
    }


    /* -------------------------------------------------
       4. Service-role connectivity probe
    -------------------------------------------------- */

    const supabase =
      createSupabaseAdminClient();


    const {
      data,

      error,
    } =
      await supabase
        .from(
          "conversations"
        )
        .select(
          "id"
        )
        .limit(
          1
        );


    if (
      error
    ) {
      return NextResponse.json(
        {
          ok:
            false,

          message:
            "Supabase connected, but table query failed.",

          error:
            error.message,
        },

        {
          status:
            500,
        }
      );
    }


    return NextResponse.json({
      ok:
        true,

      message:
        "Supabase client and conversations table are working.",

      data,
    });
  } catch (
    error
  ) {
    return NextResponse.json(
      {
        ok:
          false,

        message:
          "Supabase test failed.",

        error:
          error instanceof Error
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
