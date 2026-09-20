// app/api/subscription-plans/route.ts

import {
  NextResponse,
} from "next/server";

import {
  requireUser,
} from "@/lib/auth/require-user";


export const runtime =
  "nodejs";


export const dynamic =
  "force-dynamic";


type SubscriptionPlanRow = {
  id:
    string;

  code:
    string;

  title:
    string;

  description:
    string | null;

  price_amount:
    number;

  currency:
    string;

  duration_days:
    number;

  monthly_token_limit:
    number;

  allowed_model_tier:
    "free" |
    "main" |
    "advanced" |
    "all";

  is_active:
    boolean;

  sort_order:
    number;

  created_at:
    string;

  updated_at:
    string;
};


function serializeSubscriptionPlan(
  plan:
    SubscriptionPlanRow
) {
  return {
    id:
      plan.id,

    code:
      plan.code,

    title:
      plan.title,

    description:
      plan.description,

    priceAmount:
      plan.price_amount,

    currency:
      plan.currency,

    durationDays:
      plan.duration_days,

    monthlyTokenLimit:
      plan.monthly_token_limit,

    allowedModelTier:
      plan.allowed_model_tier,

    isActive:
      plan.is_active,

    sortOrder:
      plan.sort_order,

    createdAt:
      plan.created_at,

    updatedAt:
      plan.updated_at,
  };
}


export async function GET() {
  try {
    /* ================================================
       1. Authentication
    ================================================= */

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
    } =
      auth;


    /* ================================================
       2. Load active subscription plans
    ================================================= */

    const {
      data:
        plans,

      error:
        plansError,
    } =
      await supabase
        .from(
          "subscription_plans"
        )
        .select(
          `
            id,
            code,
            title,
            description,
            price_amount,
            currency,
            duration_days,
            monthly_token_limit,
            allowed_model_tier,
            is_active,
            sort_order,
            created_at,
            updated_at
          `
        )
        .eq(
          "is_active",
          true
        )
        .order(
          "sort_order",
          {
            ascending:
              true,
          }
        )
        .order(
          "price_amount",
          {
            ascending:
              true,
          }
        );


    if (
      plansError
    ) {
      throw new Error(
        plansError.message
      );
    }


    const serializedPlans =
      (
        plans as
        SubscriptionPlanRow[] |
        null
      )
        ?.map(
          serializeSubscriptionPlan
        ) ||
      [];


    /* ================================================
       3. Final response
    ================================================= */

    return NextResponse.json({
      ok:
        true,

      plans:
        serializedPlans,

      count:
        serializedPlans.length,
    });
  } catch (
    error
  ) {
    console.error(
      "Subscription plans API error:",

      error
    );


    return NextResponse.json(
      {
        ok:
          false,

        message:
          "Could not load subscription plans.",

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