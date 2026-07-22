// components/chat/UserCreditsBadge.tsx

"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

type AccessModePreference =
  | "auto"
  | "subscription"
  | "free";

type EffectiveAccess =
  | "trial"
  | "subscription"
  | "free";

type UserCredits = {
  plan:
    | "trial"
    | "free"
    | "pro"
    | "admin";

  accessModePreference:
    AccessModePreference;

  lastAccessModeChangeAt:
    string | null;

  trialTokenLimit:
    number;

  trialTokensUsed:
    number;

  remainingTrialTokens:
    number;

  trialUsagePercent:
    number;

  subscriptionActive:
    boolean;

  hasActiveSubscriptionEntitlement:
    boolean;

  subscriptionStartedAt:
    string | null;

  subscriptionExpiresAt:
    string | null;

  allowedModelTier:
    | "free"
    | "main"
    | "advanced"
    | "all";

  monthlyTokenLimit:
    number;

  monthlyTokensUsed:
    number;

  remainingMonthlyTokens:
    number | null;

  monthlyUsagePercent:
    number;

  monthlyPeriodStartedAt:
    string | null;

  paymentProvider:
    string | null;

  paymentReferenceId:
    string | null;

  subscriptionNote:
    string | null;

  warningShown:
    boolean;

  lastAutoDowngradeAt:
    string | null;

  hasTrialAccess:
    boolean;

  hasSubscriptionAccess:
    boolean;

  effectiveAccess:
    EffectiveAccess;
};

type UserCreditsResponse = {
  ok:
    boolean;

  credits?:
    UserCredits;

  message?:
    string;
};

type ActionLoading =
  | ""
  | "upgrade"
  | "subscription"
  | "free"
  | "auto";

function formatNumber(
  value:
    number | null | undefined
) {
  if (
    typeof value !== "number" ||
    !Number.isFinite(value)
  ) {
    return "۰";
  }

  return new Intl
    .NumberFormat("fa-IR")
    .format(value);
}

function formatDate(
  value:
    string | null
) {
  if (
    !value
  ) {
    return "نامشخص";
  }

  try {
    return new Intl
      .DateTimeFormat(
        "fa-IR",
        {
          year:
            "numeric",

          month:
            "2-digit",

          day:
            "2-digit",
        }
      )
      .format(
        new Date(value)
      );
  } catch {
    return "نامشخص";
  }
}

export default function UserCreditsBadge() {
  const [
    credits,
    setCredits,
  ] =
    useState<
      UserCredits | null
    >(null);

  const [
    isLoading,
    setIsLoading,
  ] =
    useState(true);

  const [
    actionLoading,
    setActionLoading,
  ] =
    useState<ActionLoading>("");

  const [
    error,
    setError,
  ] =
    useState<string | null>(null);

  const loadCredits =
    useCallback(
      async () => {
        try {
          setIsLoading(true);
          setError(null);

          const response =
            await fetch(
              "/api/user-credits",
              {
                method:
                  "GET",

                cache:
                  "no-store",
              }
            );

          const json =
            await response.json() as UserCreditsResponse;

          if (
            !response.ok ||
            !json.ok ||
            !json.credits
          ) {
            throw new Error(
              json.message ||
              "وضعیت اعتبار قابل دریافت نیست."
            );
          }

          setCredits(json.credits);
        } catch (loadError) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "خطا در دریافت وضعیت اعتبار"
          );
        } finally {
          setIsLoading(false);
        }
      },
      []
    );

  useEffect(
    () => {
      void loadCredits();

      const interval =
        window.setInterval(
          () => {
            void loadCredits();
          },
          30000
        );

      return () => {
        window.clearInterval(interval);
      };
    },
    [
      loadCredits,
    ]
  );

  const remainingTrialPercent =
    credits
      ? Math.max(
          0,
          100 - credits.trialUsagePercent
        )
      : 0;

  const remainingMonthlyPercent =
    credits?.monthlyTokenLimit
      ? Math.max(
          0,
          100 - credits.monthlyUsagePercent
        )
      : 100;

  const content =
    useMemo(
      () => {
        if (
          isLoading
        ) {
          return {
            title:
              "در حال بررسی اعتبار",

            subtitle:
              "لطفاً چند لحظه صبر کنید",

            label:
              "بررسی",

            tone:
              "neutral" as const,

            percent:
              0,
          };
        }

        if (
          error ||
          !credits
        ) {
          return {
            title:
              "وضعیت اعتبار نامشخص",

            subtitle:
              "پاسخ‌ها همچنان قابل استفاده‌اند",

            label:
              "نامشخص",

            tone:
              "warning" as const,

            percent:
              0,
          };
        }

        if (
          credits.effectiveAccess === "subscription"
        ) {
          return {
            title:
              "اشتراک Pro فعال",

            subtitle:
              `اعتبار ماهانه: ${formatNumber(
                remainingMonthlyPercent
              )}٪ باقی‌مانده`,

            label:
              "اشتراک",

            tone:
              "success" as const,

            percent:
              remainingMonthlyPercent,
          };
        }

        if (
          credits.effectiveAccess === "trial"
        ) {
          return {
            title:
              "مدل اصلی دمو فعال",

            subtitle:
              `اعتبار آزمایشی: ${formatNumber(
                remainingTrialPercent
              )}٪ باقی‌مانده`,

            label:
              "آزمایشی",

            tone:
              remainingTrialPercent <= 15
                ? "warning" as const
                : "success" as const,

            percent:
              remainingTrialPercent,
          };
        }

        return {
          title:
            "مدل رایگان فعال",

          subtitle:
            credits.hasActiveSubscriptionEntitlement
              ? "شما اشتراک دارید، اما حالت رایگان را انتخاب کرده‌اید"
              : "اعتبار مدل اصلی تمام شده است",

          label:
            "رایگان",

          tone:
            credits.hasActiveSubscriptionEntitlement
              ? "warning" as const
              : "danger" as const,

          percent:
            0,
        };
      },
      [
        credits,
        error,
        isLoading,
        remainingMonthlyPercent,
        remainingTrialPercent,
      ]
    );

  const colors =
    useMemo(
      () => {
        if (
          content.tone === "success"
        ) {
          return {
            background:
              "#ecfdf5",

            border:
              "#a7f3d0",

            text:
              "#065f46",

            progress:
              "#10b981",
          };
        }

        if (
          content.tone === "warning"
        ) {
          return {
            background:
              "#fffbeb",

            border:
              "#fde68a",

            text:
              "#92400e",

            progress:
              "#f59e0b",
          };
        }

        if (
          content.tone === "danger"
        ) {
          return {
            background:
              "#fef2f2",

            border:
              "#fecaca",

            text:
              "#991b1b",

            progress:
              "#ef4444",
          };
        }

        return {
          background:
            "#f8fafc",

          border:
            "#e2e8f0",

          text:
            "#334155",

          progress:
            "#94a3b8",
        };
      },
      [
        content.tone,
      ]
    );

  async function updateAccessMode(
    accessModePreference:
      AccessModePreference
  ) {
    try {
      setActionLoading(accessModePreference);
      setError(null);

      const response =
        await fetch(
          "/api/user-credits/access-mode",
          {
            method:
              "PATCH",

            headers: {
              "Content-Type":
                "application/json",
            },

            body:
              JSON.stringify({
                accessModePreference,
              }),
          }
        );

      const json =
        await response.json();

      if (
        !response.ok ||
        !json.ok
      ) {
        throw new Error(
          json.message ||
          "تغییر حالت مصرف انجام نشد."
        );
      }

      await loadCredits();
    } catch (actionError) {
      setError(
        actionError instanceof Error
          ? actionError.message
          : "تغییر حالت مصرف انجام نشد."
      );
    } finally {
      setActionLoading("");
    }
  }

  async function activateMockPro() {
    try {
      setActionLoading("upgrade");
      setError(null);

      const response =
        await fetch(
          "/api/billing/mock-upgrade",
          {
            method:
              "POST",

            headers: {
              "Content-Type":
                "application/json",
            },

            body:
              JSON.stringify({
                days:
                  30,

                monthlyTokenLimit:
                  500000,

                amount:
                  0,

                currency:
                  "IRR",

                note:
                  "Local UI test upgrade",
              }),
          }
        );

      const json =
        await response.json();

      if (
        !response.ok ||
        !json.ok
      ) {
        throw new Error(
          json.message ||
          "ارتقا به Pro انجام نشد."
        );
      }

      await loadCredits();
    } catch (actionError) {
      setError(
        actionError instanceof Error
          ? actionError.message
          : "ارتقا به Pro انجام نشد."
      );
    } finally {
      setActionLoading("");
    }
  }

  const hasProEntitlement =
    Boolean(
      credits?.hasActiveSubscriptionEntitlement
    );

  const isUsingSubscription =
    credits?.effectiveAccess === "subscription";

  const isUsingFree =
    credits?.accessModePreference === "free";

  return (
    <div
      dir="rtl"
      style={{
        width:
          "100%",

        border:
          `1px solid ${colors.border}`,

        background:
          colors.background,

        borderRadius:
          14,

        padding:
          "10px 12px",

        color:
          colors.text,

        boxSizing:
          "border-box",
      }}
    >
      <div
        style={{
          display:
            "flex",

          alignItems:
            "center",

          justifyContent:
            "space-between",

          gap:
            8,
        }}
      >
        <strong
          style={{
            fontSize:
              13,

            fontWeight:
              700,
          }}
        >
          {content.title}
        </strong>

        <span
          style={{
            fontSize:
              12,

            opacity:
              0.85,
          }}
        >
          {content.label}
        </span>
      </div>

      <div
        style={{
          marginTop:
            4,

          fontSize:
            12,

          lineHeight:
            1.7,

          opacity:
            0.9,
        }}
      >
        {content.subtitle}
      </div>

      <div
        style={{
          marginTop:
            8,

          width:
            "100%",

          height:
            6,

          background:
            "rgba(15, 23, 42, 0.08)",

          borderRadius:
            999,

          overflow:
            "hidden",
        }}
      >
        <div
          style={{
            width:
              `${content.percent}%`,

            height:
              "100%",

            background:
              colors.progress,

            borderRadius:
              999,

            transition:
              "width 300ms ease",
          }}
        />
      </div>

      {
        credits?.effectiveAccess === "trial" && (
          <div
            style={{
              marginTop:
                6,

              fontSize:
                11,

              opacity:
                0.8,
            }}
          >
            مصرف‌شده:{" "}
            {formatNumber(
              credits.trialTokensUsed
            )}{" "}
            از{" "}
            {formatNumber(
              credits.trialTokenLimit
            )}{" "}
            توکن
          </div>
        )
      }

      {
        credits?.hasActiveSubscriptionEntitlement && (
          <div
            style={{
              marginTop:
                6,

              fontSize:
                11,

              opacity:
                0.85,
            }}
          >
            سقف ماهانه:{" "}
            {formatNumber(
              credits.monthlyTokensUsed
            )}{" "}
            از{" "}
            {formatNumber(
              credits.monthlyTokenLimit
            )}{" "}
            توکن · اعتبار تا{" "}
            {formatDate(
              credits.subscriptionExpiresAt
            )}
          </div>
        )
      }

      {
        error && (
          <div
            style={{
              marginTop:
                8,

              fontSize:
                11,

              color:
                "#991b1b",

              background:
                "#fee2e2",

              border:
                "1px solid #fecaca",

              borderRadius:
                10,

              padding:
                "6px 8px",
            }}
          >
            {error}
          </div>
        )
      }

      <div
        style={{
          display:
            "flex",

          flexWrap:
            "wrap",

          gap:
            6,

          marginTop:
            10,
        }}
      >
        {
          hasProEntitlement ? (
            <>
              <button
                type="button"
                disabled={
                  actionLoading !== "" ||
                  isUsingSubscription
                }
                onClick={
                  () => {
                    void updateAccessMode(
                      "subscription"
                    );
                  }
                }
                style={{
                  border:
                    "1px solid #10b981",

                  background:
                    isUsingSubscription
                      ? "#10b981"
                      : "#ffffff",

                  color:
                    isUsingSubscription
                      ? "#ffffff"
                      : "#065f46",

                  borderRadius:
                    10,

                  padding:
                    "6px 10px",

                  fontSize:
                    11,

                  cursor:
                    actionLoading
                      ? "wait"
                      : "pointer",
                }}
              >
                {
                  actionLoading === "subscription"
                    ? "در حال تغییر..."
                    : "استفاده از Pro"
                }
              </button>

              <button
                type="button"
                disabled={
                  actionLoading !== "" ||
                  isUsingFree
                }
                onClick={
                  () => {
                    void updateAccessMode(
                      "free"
                    );
                  }
                }
                style={{
                  border:
                    "1px solid #f59e0b",

                  background:
                    isUsingFree
                      ? "#f59e0b"
                      : "#ffffff",

                  color:
                    isUsingFree
                      ? "#ffffff"
                      : "#92400e",

                  borderRadius:
                    10,

                  padding:
                    "6px 10px",

                  fontSize:
                    11,

                  cursor:
                    actionLoading
                      ? "wait"
                      : "pointer",
                }}
              >
                {
                  actionLoading === "free"
                    ? "در حال تغییر..."
                    : "حالت رایگان"
                }
              </button>
            </>
          ) : (
            <button
              type="button"
              disabled={
                actionLoading !== ""
              }
              onClick={
                () => {
                  void activateMockPro();
                }
              }
              style={{
                border:
                  "1px solid #2563eb",

                background:
                  "#2563eb",

                color:
                  "#ffffff",

                borderRadius:
                  10,

                padding:
                  "6px 10px",

                fontSize:
                  11,

                cursor:
                  actionLoading
                    ? "wait"
                    : "pointer",
              }}
            >
              {
                actionLoading === "upgrade"
                  ? "در حال ارتقا..."
                  : "ارتقا آزمایشی به Pro"
              }
            </button>
          )
        }
      </div>
    </div>
  );
}