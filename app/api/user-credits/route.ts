// app/api/user-credits/route.ts

import {
  NextResponse,
} from "next/server";

import {
  requireUser,
} from "@/lib/auth/require-user";

import {
  ensureUserAiCredits,
  getEffectiveAccess,
  getRemainingMonthlyTokens,
  getRemainingTrialTokens,
  hasActiveSubscriptionEntitlement,
  hasSubscriptionAccess,
  hasTrialAccess,
} from "@/lib/assistant/userCredits";


export const runtime =
  "nodejs";


export const dynamic =
  "force-dynamic";


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
      return auth.response;
    }


    const {
      supabase,
      user,
    } =
      auth;


    const credits =
      await ensureUserAiCredits({
        supabase,

        userId:
          user.id,
      });


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


    const trialUsagePercent =
      calculatePercent(
        credits.trial_tokens_used,

        credits.trial_token_limit
      );


    const monthlyUsagePercent =
      credits.monthly_token_limit > 0
        ? calculatePercent(
          credits.monthly_tokens_used,

          credits.monthly_token_limit
        )
        : 0;


    return NextResponse.json({
      ok:
        true,

      credits: {
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

        trialUsagePercent,

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

        monthlyUsagePercent,

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
      },
    });
  } catch (
    error
  ) {
    console.error(
      "User credits API error:",

      error
    );


    return NextResponse.json(
      {
        ok:
          false,

        message:
          "Could not load user AI credits.",

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