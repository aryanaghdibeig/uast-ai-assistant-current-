// app/api/billing/mock-upgrade/route.ts

import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  requireUser,
} from "@/lib/auth/require-user";

import {
  createSupabaseAdminClient,
} from "@/lib/supabase/admin";

import {
  activateInternalProSubscription,
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


type MockUpgradeBody = {
  plan?:
    "pro";

  amount?:
    number;

  currency?:
    string;

  days?:
    number;

  monthlyTokenLimit?:
    number;

  note?:
    string;
};


function isMockBillingEnabled() {
  /**
   * Production builds never allow mock billing — even if ENABLE_MOCK_BILLING is set.
   * Local/dev/staging may enable via NODE_ENV !== production AND explicit opt-in...
   * Actually: allow non-production without flag for DX, but never production.
   */
  if (
    process.env.NODE_ENV ===
      "production" ||

    process.env.VERCEL_ENV ===
      "production"
  ) {
    return false;
  }

  return true;
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


export async function POST(
  request:
    NextRequest
) {
  try {
    if (
      !isMockBillingEnabled()
    ) {
      return NextResponse.json(
        {
          ok:
            false,

          message:
            "Mock billing is disabled in production.",
        },

        {
          status:
            404,
        }
      );
    }


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


    await ensureUserAiCredits({
      supabase,

      userId:
        user.id,
    });


    const body =
      await request
        .json()
        .catch(
          () => ({})
        ) as
        MockUpgradeBody;


    const days =
      body.days &&
      body.days > 0
        ? Math.min(
          365,

          Math.floor(
            body.days
          )
        )
        : 30;


    const monthlyTokenLimit =
      body.monthlyTokenLimit &&
      body.monthlyTokenLimit > 0
        ? Math.min(
          5_000_000,

          Math.floor(
            body.monthlyTokenLimit
          )
        )
        : 500000;


    const amount =
      body.amount &&
      body.amount > 0
        ? Math.floor(
          body.amount
        )
        : 0;


    const currency =
      body.currency?.trim() ||
      "IRR";


    const paymentReferenceId =
      `mock_${Date.now()}_${user.id.slice(
        0,

        8
      )}`;


    const {
      error:
        paymentInsertError,
    } =
      await createSupabaseAdminClient()
        .from(
          "user_subscription_payments"
        )
        .insert({
          user_id:
            user.id,

          plan:
            "pro",

          amount,

          currency,

          status:
            "paid",

          provider:
            "mock",

          provider_reference_id:
            paymentReferenceId,

          checkout_url:
            null,

          paid_at:
            new Date()
              .toISOString(),
        });


    if (
      paymentInsertError
    ) {
      throw new Error(
        paymentInsertError.message
      );
    }


    const updatedCredits =
      await activateInternalProSubscription({
        supabase,

        userId:
          user.id,

        paymentReferenceId,

        paymentProvider:
          "mock",

        note:
          body.note ||
          "Mock local Pro subscription activated",

        monthlyTokenLimit,

        days,
      });


    return NextResponse.json({
      ok:
        true,

      message:
        "Mock Pro subscription activated.",

      credits:
        serializeCredits(
          updatedCredits
        ),
    });
  } catch (
    error
  ) {
    console.error(
      "Mock upgrade error:",

      error
    );


    return NextResponse.json(
      {
        ok:
          false,

        message:
          "Could not activate mock Pro subscription.",

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