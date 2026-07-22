// app/api/user-credits/access-mode/route.ts

import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  createSupabaseServerClient,
} from "@/lib/supabase/server";

import {
  ensureUserAiCredits,
  getEffectiveAccess,
  getRemainingMonthlyTokens,
  getRemainingTrialTokens,
  hasActiveSubscriptionEntitlement,
  hasSubscriptionAccess,
  hasTrialAccess,
  updateAccessModePreference,
  type AccessModePreference,
} from "@/lib/assistant/userCredits";


export const runtime =
  "nodejs";


export const dynamic =
  "force-dynamic";


function isValidAccessModePreference(
  value:
    unknown
): value is AccessModePreference {
  return (
    value === "auto" ||
    value === "subscription" ||
    value === "free"
  );
}


function calculatePercent(
  used:
    number,

  limit:
    number
) {
  if (
    limit <=
    0
  ) {
    return 0;
  }


  return Math.min(
    100,

    Math.max(
      0,

      Math.round(
        (
          used /
          limit
        ) *
        100
      )
    )
  );
}


function serializeCredits(
  credits:
    Awaited<
      ReturnType<
        typeof ensureUserAiCredits
      >
    >
) {
  const remainingTrialTokens =
    getRemainingTrialTokens(
      credits
    );


  const remainingMonthlyTokens =
    getRemainingMonthlyTokens(
      credits
    );


  const activeSubscriptionEntitlement =
    hasActiveSubscriptionEntitlement(
      credits
    );


  const subscriptionAccess =
    hasSubscriptionAccess(
      credits
    );


  const trialAccess =
    hasTrialAccess(
      credits
    );


  const effectiveAccess =
    getEffectiveAccess(
      credits
    );


  return {
    plan:
      credits.plan,

    accessModePreference:
      credits.access_mode_preference,

    lastAccessModeChangeAt:
      credits.last_access_mode_change_at,

    trialTokenLimit:
      credits.trial_token_limit,

    trialTokensUsed:
      credits.trial_tokens_used,

    remainingTrialTokens,

    trialUsagePercent:
      calculatePercent(
        credits.trial_tokens_used,

        credits.trial_token_limit
      ),

    subscriptionActive:
      credits.subscription_active,

    hasActiveSubscriptionEntitlement:
      activeSubscriptionEntitlement,

    subscriptionStartedAt:
      credits.subscription_started_at,

    subscriptionExpiresAt:
      credits.subscription_expires_at,

    allowedModelTier:
      credits.allowed_model_tier,

    monthlyTokenLimit:
      credits.monthly_token_limit,

    monthlyTokensUsed:
      credits.monthly_tokens_used,

    remainingMonthlyTokens,

    monthlyUsagePercent:
      credits.monthly_token_limit > 0
        ? calculatePercent(
          credits.monthly_tokens_used,

          credits.monthly_token_limit
        )
        : 0,

    monthlyPeriodStartedAt:
      credits.monthly_period_started_at,

    paymentProvider:
      credits.payment_provider,

    paymentReferenceId:
      credits.payment_reference_id,

    subscriptionNote:
      credits.subscription_note,

    warningShown:
      credits.warning_shown,

    lastAutoDowngradeAt:
      credits.last_auto_downgrade_at,

    hasTrialAccess:
      trialAccess,

    hasSubscriptionAccess:
      subscriptionAccess,

    effectiveAccess,
  };
}


export async function PATCH(
  request:
    NextRequest
) {
  try {
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


    const body =
      await request
        .json()
        .catch(
          () => null
        ) as
        | {
            accessModePreference?:
              unknown;
          }
        | null;


    const accessModePreference =
      body?.accessModePreference;


    if (
      !isValidAccessModePreference(
        accessModePreference
      )
    ) {
      return NextResponse.json(
        {
          ok:
            false,

          message:
            "Invalid access mode preference.",
        },

        {
          status:
            400,
        }
      );
    }


    const currentCredits =
      await ensureUserAiCredits({
        supabase,

        userId:
          user.id,
      });


    /**
     * کاربر بدون اشتراک فعال نباید بتواند حالت subscription را انتخاب کند.
     */
    if (
      accessModePreference ===
        "subscription" &&

      !hasActiveSubscriptionEntitlement(
        currentCredits
      )
    ) {
      return NextResponse.json(
        {
          ok:
            false,

          message:
            "Pro subscription is not active for this user.",
        },

        {
          status:
            403,
        }
      );
    }


    const updatedCredits =
      await updateAccessModePreference({
        supabase,

        userId:
          user.id,

        accessModePreference,
      });


    return NextResponse.json({
      ok:
        true,

      message:
        "Access mode preference updated.",

      credits:
        serializeCredits(
          updatedCredits
        ),
    });
  } catch (
    error
  ) {
    console.error(
      "Update access mode preference error:",

      error
    );


    return NextResponse.json(
      {
        ok:
          false,

        message:
          "Could not update access mode preference.",

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