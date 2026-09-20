// app/api/auth-test/route.ts

import {
  NextResponse,
} from "next/server";

import {
  requireUser,
} from "@/lib/auth/require-user";


export async function GET() {
  try {
    const auth =
      await requireUser({
        unauthorizedFormat:
          "json",
      });


    if (
      !auth.ok
    ) {
      if (
        auth.error
      ) {
        return NextResponse.json(
          {
            ok:
              false,

            message:
              "Could not read authenticated user.",

            error:
              auth.error.message,
          },

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
            "No user is logged in.",
        },

        {
          status:
            401,
        }
      );
    }


    return NextResponse.json({
      ok:
        true,

      message:
        "User is logged in.",

      user: {
        id:
          auth.user.id,

        email:
          auth.user.email,
      },
    });
  } catch (
    error
  ) {
    return NextResponse.json(
      {
        ok:
          false,

        message:
          "Auth test failed.",

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
