// components/chat/ModelSelector.tsx

"use client";


import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";


import styles from "@/app/Chat.module.css";


import type {
  ConversationModelSelection,
  ModelSelectionMode,
  OpenRouterModel,
} from "@/types/chat";


/* =====================================================
   Props
===================================================== */

type ModelSelectorProps = {
  conversationId:
    string;

  disabled?:
    boolean;
};


/* =====================================================
   API Response Types
===================================================== */

type ModelsApiResponse = {
  ok?:
    boolean;

  message?:
    string;

  source?:
    string;

  defaultModel?:
    string;

  count?:
    number;

  totalAvailable?:
    number;

  models?:
    OpenRouterModel[];

  error?:
    string;
};


type ModelSelectionApiResponse = {
  ok?:
    boolean;

  message?:
    string;

  selection?:
    ConversationModelSelection;

  error?:
    string;
};


type UserCreditsResponse = {
  ok:
    boolean;

  credits?: {
    plan:
      "trial" |
      "free" |
      "pro" |
      "admin";

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

    allowedModelTier:
      "free" |
      "main" |
      "advanced" |
      "all";

    warningShown:
      boolean;

    lastAutoDowngradeAt:
      string | null;

    hasTrialAccess:
      boolean;

    hasSubscriptionAccess:
      boolean;

    effectiveAccess:
      "trial" |
      "subscription" |
      "free";
  };

  message?: string;
};


/* =====================================================
   Constants
===================================================== */

const DEFAULT_MODEL_ID =
  "openrouter/auto";


const DEMO_MAIN_MODEL_ID =
  "demo/main";


const DEMO_FREE_MODEL_ID =
  "demo/free";


const OPENROUTER_FREE_MODEL_ID =
  "openrouter/free";


const MODE_LABELS:
  Record<
    ModelSelectionMode,
    string
  > = {
    auto:
      "انتخاب هوشمند",

    preset:
      "حالت آماده",

    advanced:
      "انتخاب مستقیم",
  };


/* =====================================================
   Helper Functions
===================================================== */

function getFriendlyModelName(
  modelId:
    string
) {
  switch (
    modelId
  ) {
    case DEMO_MAIN_MODEL_ID:
      return "مدل اصلی دمو";

    case DEMO_FREE_MODEL_ID:
      return "مدل رایگان خودکار";

    case "openrouter/auto":
      return "انتخاب هوشمند OpenRouter";

    case OPENROUTER_FREE_MODEL_ID:
      return "مدل رایگان خودکار";

    default:
      return modelId;
  }
}


function getFriendlyProviderName(
  modelId:
    string
) {
  switch (
    modelId
  ) {
    case DEMO_MAIN_MODEL_ID:
      return "اعتبار آزمایشی";

    case DEMO_FREE_MODEL_ID:
    case OPENROUTER_FREE_MODEL_ID:
      return "OpenRouter رایگان";

    case "openrouter/auto":
      return "OpenRouter";

    default:
      return "مدل انتخاب‌شده";
  }
}


function getSelectionModeForModel(
  model:
    OpenRouterModel
):
  ModelSelectionMode {
  if (
    model.id ===
    "openrouter/auto"
  ) {
    return "auto";
  }


  if (
    model.id ===
      OPENROUTER_FREE_MODEL_ID ||

    model.id ===
      DEMO_FREE_MODEL_ID ||

    model.id ===
      DEMO_MAIN_MODEL_ID ||

    model.isRouter
  ) {
    return "preset";
  }


  return "advanced";
}


function formatNumber(
  value:
    number | null
) {
  if (
    value ===
      null ||

    !Number.isFinite(
      value
    )
  ) {
    return "نامشخص";
  }


  return new Intl
    .NumberFormat(
      "fa-IR"
    )
    .format(
      value
    );
}


function formatPrice(
  value:
    number | null
) {
  if (
    value ===
    0
  ) {
    return "رایگان";
  }


  if (
    value ===
      null ||

    !Number.isFinite(
      value
    )
  ) {
    return "نامشخص";
  }


  const formattedValue =
    value < 0.01
      ? value.toFixed(
          4
        )
      : value.toFixed(
          2
        );


  return `$${formattedValue} / 1M`;
}


function createFallbackModel(
  modelId:
    string
):
  OpenRouterModel {
  const isAuto =
    modelId ===
    "openrouter/auto";


  const isDemoMain =
    modelId ===
    DEMO_MAIN_MODEL_ID;


  const isDemoFree =
    modelId ===
    DEMO_FREE_MODEL_ID;


  const isOpenRouterFree =
    modelId ===
    OPENROUTER_FREE_MODEL_ID;


  const isFree =
    isDemoFree ||
    isOpenRouterFree;


  return {
    id:
      modelId,


    name:
      getFriendlyModelName(
        modelId
      ),


    provider:
      getFriendlyProviderName(
        modelId
      ),


    description:
      isDemoMain
        ? "مدل اصلی دمو برای پاسخ‌های رسمی‌تر، کامل‌تر و مدیریتی‌تر فعال می‌شود. مصرف آن از اعتبار آزمایشی کاربر کسر می‌شود."
        : isAuto
          ? "OpenRouter با توجه به درخواست، مدل مناسب را به‌صورت خودکار انتخاب می‌کند."
          : isFree
            ? "OpenRouter یکی از مدل‌های رایگان موجود را به‌صورت خودکار انتخاب می‌کند."
            : "این مدل برای گفتگوی جاری ذخیره شده است.",


    contextLength:
      null,


    maxCompletionTokens:
      null,


    promptPricePerMillion:
      isFree
        ? 0
        : null,


    completionPricePerMillion:
      isFree
        ? 0
        : null,


    isFree,


    isRouter:
      isAuto ||
      isFree,


    selectionMode:
      isAuto
        ? "auto"
        : isDemoMain ||
          isFree
          ? "preset"
          : "advanced",


    capabilities: {
      text:
        true,
    },
  };
}


function getModelBadges(
  model:
    OpenRouterModel
) {
  const badges:
    string[] = [];


  if (
    model.id ===
    DEMO_MAIN_MODEL_ID
  ) {
    badges.push(
      "اصلی دمو"
    );
  }


  if (
    model.isFree ||
    model.id ===
      DEMO_FREE_MODEL_ID ||
    model.id ===
      OPENROUTER_FREE_MODEL_ID
  ) {
    badges.push(
      "رایگان"
    );
  }


  if (
    model.isRouter
  ) {
    badges.push(
      "مسیریاب"
    );
  }


  if (
    model
      .capabilities
      ?.reasoning
  ) {
    badges.push(
      "استدلال"
    );
  }


  if (
    model
      .capabilities
      ?.imageInput
  ) {
    badges.push(
      "تصویر"
    );
  }


  if (
    model
      .capabilities
      ?.tools
  ) {
    badges.push(
      "ابزار"
    );
  }


  return badges.slice(
    0,
    4
  );
}


function getRemainingTrialPercent(
  credits:
    UserCreditsResponse["credits"] |
    null
) {
  if (
    !credits
  ) {
    return null;
  }


  if (
    credits.trialTokenLimit <=
    0
  ) {
    return 0;
  }


  return Math.max(
    0,

    100 -
      credits.trialUsagePercent
  );
}


function getEffectiveAccessLabel(
  credits:
    UserCreditsResponse["credits"] |
    null
) {
  if (
    !credits
  ) {
    return "در حال بررسی اعتبار";
  }


  if (
    credits.effectiveAccess ===
    "subscription"
  ) {
    return "اشتراک فعال";
  }


  if (
    credits.effectiveAccess ===
    "trial"
  ) {
    const remainingPercent =
      getRemainingTrialPercent(
        credits
      );


    return `اعتبار آزمایشی فعال · ${formatNumber(
      remainingPercent
    )}٪ باقی‌مانده`;
  }


  return "اعتبار مدل اصلی تمام شده است";
}


/* =====================================================
   Component
===================================================== */

export default function ModelSelector({
  conversationId,

  disabled = false,
}: ModelSelectorProps) {
  /* -------------------------------------------------
     Refs
  -------------------------------------------------- */

  const rootRef =
    useRef<
      HTMLDivElement
    >(
      null
    );


  /* -------------------------------------------------
     UI States
  -------------------------------------------------- */

  const [
    isOpen,

    setIsOpen,
  ] =
    useState(
      false
    );


  const [
    search,

    setSearch,
  ] =
    useState(
      ""
    );


  const [
    freeOnly,

    setFreeOnly,
  ] =
    useState(
      false
    );


  const [
    visionOnly,

    setVisionOnly,
  ] =
    useState(
      false
    );


  /* -------------------------------------------------
     Credits State
  -------------------------------------------------- */

  const [
    credits,

    setCredits,
  ] =
    useState<
      UserCreditsResponse["credits"] |
      null
    >(
      null
    );


  const [
    loadingCredits,

    setLoadingCredits,
  ] =
    useState(
      false
    );


  /* -------------------------------------------------
     Model States
  -------------------------------------------------- */

  const [
    models,

    setModels,
  ] =
    useState<
      OpenRouterModel[]
    >(
      []
    );


  const [
    selectedModelId,

    setSelectedModelId,
  ] =
    useState(
      DEFAULT_MODEL_ID
    );


  const [
    selectionMode,

    setSelectionMode,
  ] =
    useState<
      ModelSelectionMode
    >(
      "auto"
    );


  const [
    totalAvailable,

    setTotalAvailable,
  ] =
    useState<
      number | null
    >(
      null
    );


  /* -------------------------------------------------
     Loading States
  -------------------------------------------------- */

  const [
    loadingSelection,

    setLoadingSelection,
  ] =
    useState(
      false
    );


  const [
    loadingModels,

    setLoadingModels,
  ] =
    useState(
      false
    );


  const [
    savingModelId,

    setSavingModelId,
  ] =
    useState(
      ""
    );


  const [
    error,

    setError,
  ] =
    useState(
      ""
    );


  /* -------------------------------------------------
     Access flags
  -------------------------------------------------- */

  const hasSubscriptionAccess =
    Boolean(
      credits
        ?.hasSubscriptionAccess
    );


  const hasTrialAccess =
    Boolean(
      credits
        ?.hasTrialAccess
    );


  const effectiveAccess =
    credits
      ?.effectiveAccess ||
    "free";


  const canBrowseAdvancedModels =
    hasSubscriptionAccess;


  /* -------------------------------------------------
     Selected Model
  -------------------------------------------------- */

  const selectedModel =
    useMemo(
      () => {
        if (
          effectiveAccess ===
          "trial"
        ) {
          return createFallbackModel(
            DEMO_MAIN_MODEL_ID
          );
        }


        if (
          effectiveAccess ===
          "free"
        ) {
          return createFallbackModel(
            DEMO_FREE_MODEL_ID
          );
        }


        return (
          models.find(
            (
              model
            ) =>
              model.id ===
              selectedModelId
          ) ||

          createFallbackModel(
            selectedModelId
          )
        );
      },

      [
        effectiveAccess,

        models,

        selectedModelId,
      ]
    );


  const selectorDisabled =
    disabled ||

    loadingSelection ||

    !conversationId;


  const recommendedModels =
    useMemo(
      () => {
        if (
          effectiveAccess ===
          "subscription"
        ) {
          return [
            createFallbackModel(
              DEMO_MAIN_MODEL_ID
            ),

            createFallbackModel(
              DEMO_FREE_MODEL_ID
            ),
          ];
        }


        if (
          effectiveAccess ===
          "trial"
        ) {
          return [
            createFallbackModel(
              DEMO_MAIN_MODEL_ID
            ),

            createFallbackModel(
              DEMO_FREE_MODEL_ID
            ),
          ];
        }


        return [
          createFallbackModel(
            DEMO_FREE_MODEL_ID
          ),
        ];
      },

      [
        effectiveAccess,
      ]
    );


  /* =====================================================
     Load User Credits
  ===================================================== */

  useEffect(
    () => {
      let isMounted =
        true;


      const loadCredits =
        async () => {
          setLoadingCredits(
            true
          );


          try {
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


            const data =
              await response
                .json()
                .catch(
                  () => null
                ) as
                UserCreditsResponse |
                null;


            if (
              !isMounted
            ) {
              return;
            }


            if (
              response.ok &&
              data?.ok &&
              data.credits
            ) {
              setCredits(
                data.credits
              );
            }
          } catch (
            loadError
          ) {
            console.error(
              "Load user credits error:",

              loadError
            );
          } finally {
            if (
              isMounted
            ) {
              setLoadingCredits(
                false
              );
            }
          }
        };


      void loadCredits();


      const interval =
        window.setInterval(
          () => {
            void loadCredits();
          },

          30000
        );


      return () => {
        isMounted =
          false;

        window.clearInterval(
          interval
        );
      };
    },

    []
  );


  /* =====================================================
     Load Conversation Model
  ===================================================== */

  useEffect(
    () => {
      if (
        !conversationId
      ) {
        setSelectedModelId(
          DEFAULT_MODEL_ID
        );


        setSelectionMode(
          "auto"
        );


        setError(
          ""
        );


        return;
      }


      const controller =
        new AbortController();


      const loadConversationModel =
        async () => {
          setLoadingSelection(
            true
          );


          setError(
            ""
          );


          try {
            const response =
              await fetch(
                `/api/conversations/${encodeURIComponent(
                  conversationId
                )}/model`,

                {
                  method:
                    "GET",

                  cache:
                    "no-store",

                  signal:
                    controller.signal,
                }
              );


            const data =
              await response
                .json()
                .catch(
                  () => null
                ) as
                ModelSelectionApiResponse
                | null;


            if (
              !response.ok ||

              !data?.ok ||

              !data.selection
            ) {
              throw new Error(
                data?.error ||

                data?.message ||

                "مدل ذخیره‌شده گفتگو خوانده نشد."
              );
            }


            setSelectedModelId(
              data
                .selection
                .selectedModel ||

              DEFAULT_MODEL_ID
            );


            setSelectionMode(
              data
                .selection
                .modelSelectionMode ||

              "auto"
            );
          } catch (
            loadError
          ) {
            if (
              loadError instanceof
                DOMException &&

              loadError.name ===
                "AbortError"
            ) {
              return;
            }


            console.error(
              "Load conversation model error:",

              loadError
            );


            setSelectedModelId(
              DEFAULT_MODEL_ID
            );


            setSelectionMode(
              "auto"
            );


            setError(
              "مدل ذخیره‌شده گفتگو خوانده نشد."
            );
          } finally {
            if (
              !controller
                .signal
                .aborted
            ) {
              setLoadingSelection(
                false
              );
            }
          }
        };


      void loadConversationModel();


      return () => {
        controller.abort();
      };
    },

    [
      conversationId,
    ]
  );


  /* =====================================================
     Load OpenRouter Models
  ===================================================== */

  useEffect(
    () => {
      if (
        !isOpen ||
        !canBrowseAdvancedModels
      ) {
        return;
      }


      const controller =
        new AbortController();


      const timeout =
        window.setTimeout(
          () => {
            const loadModels =
              async () => {
                setLoadingModels(
                  true
                );


                setError(
                  ""
                );


                try {
                  const params =
                    new URLSearchParams();


                  params.set(
                    "limit",

                    "40"
                  );


                  params.set(
                    "sort",

                    "most-popular"
                  );


                  const cleanSearch =
                    search.trim();


                  if (
                    cleanSearch
                  ) {
                    params.set(
                      "search",

                      cleanSearch
                    );
                  }


                  if (
                    freeOnly
                  ) {
                    params.set(
                      "freeOnly",

                      "true"
                    );
                  }


                  if (
                    visionOnly
                  ) {
                    params.set(
                      "visionOnly",

                      "true"
                    );
                  }


                  const response =
                    await fetch(
                      `/api/models?${params.toString()}`,

                      {
                        method:
                          "GET",

                        cache:
                          "no-store",

                        signal:
                          controller.signal,
                      }
                    );


                  const data =
                    await response
                      .json()
                      .catch(
                        () => null
                      ) as
                      ModelsApiResponse
                      | null;


                  if (
                    !response.ok ||

                    !data?.ok ||

                    !Array.isArray(
                      data.models
                    )
                  ) {
                    throw new Error(
                      data?.error ||

                      data?.message ||

                      "فهرست مدل‌های OpenRouter دریافت نشد."
                    );
                  }


                  setModels(
                    data.models
                  );


                  setTotalAvailable(
                    typeof data
                      .totalAvailable ===
                      "number"
                      ? data
                          .totalAvailable
                      : null
                  );
                } catch (
                  loadError
                ) {
                  if (
                    loadError instanceof
                      DOMException &&

                    loadError.name ===
                      "AbortError"
                  ) {
                    return;
                  }


                  console.error(
                    "Load OpenRouter models error:",

                    loadError
                  );


                  setError(
                    loadError instanceof
                      Error
                      ? loadError.message
                      : "فهرست مدل‌ها دریافت نشد."
                  );
                } finally {
                  if (
                    !controller
                      .signal
                      .aborted
                  ) {
                    setLoadingModels(
                      false
                    );
                  }
                }
              };


            void loadModels();
          },

          search.trim()
            ? 350
            : 0
        );


      return () => {
        window.clearTimeout(
          timeout
        );


        controller.abort();
      };
    },

    [
      isOpen,

      search,

      freeOnly,

      visionOnly,

      canBrowseAdvancedModels,
    ]
  );


  /* =====================================================
     Close Panel
  ===================================================== */

  useEffect(
    () => {
      if (
        !isOpen
      ) {
        return;
      }


      const handleMouseDown =
        (
          event:
            MouseEvent
        ) => {
          const target =
            event.target as
              Node
              | null;


          if (
            target &&

            !rootRef
              .current
              ?.contains(
                target
              )
          ) {
            setIsOpen(
              false
            );
          }
        };


      const handleKeyDown =
        (
          event:
            KeyboardEvent
        ) => {
          if (
            event.key ===
            "Escape"
          ) {
            setIsOpen(
              false
            );
          }
        };


      document.addEventListener(
        "mousedown",

        handleMouseDown
      );


      document.addEventListener(
        "keydown",

        handleKeyDown
      );


      return () => {
        document.removeEventListener(
          "mousedown",

          handleMouseDown
        );


        document.removeEventListener(
          "keydown",

          handleKeyDown
        );
      };
    },

    [
      isOpen,
    ]
  );


  /* =====================================================
     Save Selected Model
  ===================================================== */

  const saveModel =
    async (
      model:
        OpenRouterModel
    ) => {
      if (
        !conversationId ||

        disabled ||

        savingModelId
      ) {
        return;
      }


      const nextSelectionMode =
        getSelectionModeForModel(
          model
        );


      setSavingModelId(
        model.id
      );


      setError(
        ""
      );


      try {
        const response =
          await fetch(
            `/api/conversations/${encodeURIComponent(
              conversationId
            )}/model`,

            {
              method:
                "PATCH",


              headers: {
                "Content-Type":
                  "application/json",
              },


              body:
                JSON.stringify({
                  selectedModel:
                    model.id,


                  modelSelectionMode:
                    nextSelectionMode,


                  modelPreferences: {
                    preferFree:
                      model.id ===
                        OPENROUTER_FREE_MODEL_ID ||

                      model.id ===
                        DEMO_FREE_MODEL_ID ||

                      model.isFree,


                    selectedByUser:
                      true,


                    accessMode:
                      effectiveAccess,
                  },
                }),
            }
          );


        const data =
          await response
            .json()
            .catch(
              () => null
            ) as
            ModelSelectionApiResponse
            | null;


        if (
          !response.ok ||

          !data?.ok ||

          !data.selection
        ) {
          throw new Error(
            data?.error ||

            data?.message ||

            "ذخیره مدل انتخاب‌شده انجام نشد."
          );
        }


        setSelectedModelId(
          data
            .selection
            .selectedModel
        );


        setSelectionMode(
          data
            .selection
            .modelSelectionMode
        );


        setIsOpen(
          false
        );
      } catch (
        saveError
      ) {
        console.error(
          "Save model error:",

          saveError
        );


        setError(
          saveError instanceof
            Error
            ? saveError.message
            : "ذخیره مدل انتخاب‌شده انجام نشد."
        );
      } finally {
        setSavingModelId(
          ""
        );
      }
    };


  /* =====================================================
     Render helpers
  ===================================================== */

  const renderModelCard =
    (
      model:
        OpenRouterModel
    ) => {
      const isSelected =
        effectiveAccess ===
          "trial" &&
        model.id ===
          DEMO_MAIN_MODEL_ID
          ? true
          : effectiveAccess ===
            "free" &&
            model.id ===
              DEMO_FREE_MODEL_ID
            ? true
            : model.id ===
              selectedModelId;


      const isSaving =
        model.id ===
        savingModelId;


      const badges =
        getModelBadges(
          model
        );


      return (
        <button
          key={
            model.id
          }

          type="button"

          className={[
            styles
              .modelSelectorCard,


            isSelected
              ? styles
                  .modelSelectorCardSelected
              : "",
          ]
            .filter(
              Boolean
            )
            .join(
              " "
            )}

          disabled={
            Boolean(
              savingModelId
            )
          }

          onClick={
            () => {
              void saveModel(
                model
              );
            }
          }
        >
          <div
            className={
              styles
                .modelSelectorCardTop
            }
          >
            <div
              className={
                styles
                  .modelSelectorCardIdentity
              }
            >
              <strong>
                {
                  model
                    .name
                }
              </strong>


              <span>
                {
                  model
                    .provider
                }
              </span>
            </div>


            <span
              className={
                styles
                  .modelSelectorCardCheck
              }
            >
              {
                isSaving
                  ? "…"
                  : isSelected
                    ? "✓"
                    : ""
              }
            </span>
          </div>


          {
            model
              .description && (
              <p
                className={
                  styles
                    .modelSelectorDescription
                }
              >
                {
                  model
                    .description
                }
              </p>
            )
          }


          <div
            className={
              styles
                .modelSelectorBadges
            }
          >
            {
              badges.map(
                (
                  badge
                ) => (
                  <span
                    key={`${model.id}-${badge}`}
                  >
                    {
                      badge
                    }
                  </span>
                )
              )
            }
          </div>


          <div
            className={
              styles
                .modelSelectorMeta
            }
          >
            <span>
              زمینه:

              {" "}

              {
                formatNumber(
                  model
                    .contextLength
                )
              }
            </span>


            <span>
              ورودی:

              {" "}

              {
                formatPrice(
                  model
                    .promptPricePerMillion
                )
              }
            </span>


            <span>
              خروجی:

              {" "}

              {
                formatPrice(
                  model
                    .completionPricePerMillion
                )
              }
            </span>
          </div>
        </button>
      );
    };


  /* =====================================================
     Render
  ===================================================== */

  return (
    <div
      ref={
        rootRef
      }

      className={
        styles
          .modelSelectorBar
      }
    >
      <div
        className={
          styles
            .modelSelectorSummary
        }
      >
        <div
          className={
            styles
              .modelSelectorTitleBlock
          }
        >
          <span
            className={
              styles
                .modelSelectorEyebrow
            }
          >
            مدل مؤثر پاسخ‌گو
          </span>


          <span
            className={
              styles
                .modelSelectorHint
            }
          >
            {
              loadingCredits
                ? "در حال بررسی اعتبار کاربر"
                : getEffectiveAccessLabel(
                    credits
                  )
            }
          </span>
        </div>


        <button
          type="button"

          className={
            styles
              .modelSelectorTrigger
          }

          disabled={
            selectorDisabled
          }

          aria-expanded={
            isOpen
          }

          onClick={
            () => {
              setIsOpen(
                (
                  previous
                ) =>
                  !previous
              );
            }
          }
        >
          <span
            className={
              styles
                .modelSelectorTriggerIcon
            }
          >
            🤖
          </span>


          <span
            className={
              styles
                .modelSelectorTriggerText
            }
          >
            <strong>
              {
                loadingSelection ||
                loadingCredits
                  ? "در حال خواندن مدل..."
                  : selectedModel
                      .name
              }
            </strong>


            <small>
              {
                effectiveAccess ===
                  "trial"
                  ? "اعتبار آزمایشی · مدل اصلی"
                  : effectiveAccess ===
                    "free"
                    ? "رایگان · OpenRouter"
                    : MODE_LABELS[
                        selectionMode
                      ]
              }

              {" · "}

              {
                selectedModel
                  .provider
              }
            </small>
          </span>


          <span
            className={
              styles
                .modelSelectorChevron
            }
          >
            {
              isOpen
                ? "⌃"
                : "⌄"
            }
          </span>
        </button>
      </div>


      {
        isOpen && (
          <div
            className={
              styles
                .modelSelectorPanel
            }
          >
            <div
              className={
                styles
                  .modelSelectorPanelHeader
              }
            >
              <div>
                <strong>
                  انتخاب مدل پاسخ‌گو
                </strong>


                <span>
                  {
                    effectiveAccess ===
                    "subscription"
                      ? "اشتراک فعال است و انتخاب مستقیم مدل‌ها در دسترس شماست."
                      : effectiveAccess ===
                        "trial"
                        ? "تا پایان اعتبار آزمایشی، پاسخ‌های اصلی با مدل دمو ارائه می‌شود."
                        : "اعتبار مدل اصلی تمام شده و پاسخ‌ها با مدل رایگان ارائه می‌شوند."
                  }
                </span>
              </div>


              <button
                type="button"

                className={
                  styles
                    .modelSelectorCloseButton
                }

                aria-label="بستن انتخاب‌گر مدل"

                onClick={
                  () => {
                    setIsOpen(
                      false
                    );
                  }
                }
              >
                ×
              </button>
            </div>


            <div
              className={
                styles
                  .modelSelectorList
              }
            >
              {
                recommendedModels.map(
                  renderModelCard
                )
              }
            </div>


            {
              canBrowseAdvancedModels && (
                <>
                  <div
                    className={
                      styles
                        .modelSelectorTools
                    }
                  >
                    <input
                      type="search"

                      value={
                        search
                      }

                      className={
                        styles
                          .modelSelectorSearch
                      }

                      placeholder="جست‌وجوی نام مدل یا ارائه‌دهنده..."

                      onChange={
                        (
                          event
                        ) => {
                          setSearch(
                            event
                              .target
                              .value
                          );
                        }
                      }
                    />


                    <label
                      className={
                        styles
                          .modelSelectorFilter
                      }
                    >
                      <input
                        type="checkbox"

                        checked={
                          freeOnly
                        }

                        onChange={
                          (
                            event
                          ) => {
                            setFreeOnly(
                              event
                                .target
                                .checked
                            );
                          }
                        }
                      />

                      فقط رایگان
                    </label>


                    <label
                      className={
                        styles
                          .modelSelectorFilter
                      }
                    >
                      <input
                        type="checkbox"

                        checked={
                          visionOnly
                        }

                        onChange={
                          (
                            event
                          ) => {
                            setVisionOnly(
                              event
                                .target
                                .checked
                            );
                          }
                        }
                      />

                      دارای ورودی تصویر
                    </label>
                  </div>


                  <div
                    className={
                      styles
                        .modelSelectorStatusRow
                    }
                  >
                    <span>
                      {
                        loadingModels
                          ? "در حال دریافت مدل‌ها..."
                          : `${new Intl
                              .NumberFormat(
                                "fa-IR"
                              )
                              .format(
                                models.length
                              )} مدل نمایش داده شده`
                      }
                    </span>


                    {
                      totalAvailable !==
                        null && (
                        <span>
                          مجموع مدل‌ها:

                          {" "}

                          {
                            new Intl
                              .NumberFormat(
                                "fa-IR"
                              )
                              .format(
                                totalAvailable
                              )
                          }
                        </span>
                      )
                    }
                  </div>


                  {
                    error && (
                      <div
                        className={
                          styles
                            .modelSelectorError
                        }
                      >
                        {
                          error
                        }
                      </div>
                    )
                  }


                  <div
                    className={
                      styles
                        .modelSelectorList
                    }
                  >
                    {
                      loadingModels &&

                      models.length ===
                        0
                        ? Array
                            .from({
                              length:
                                6,
                            })
                            .map(
                              (
                                _,

                                index
                              ) => (
                                <div
                                  key={`model-loading-${index}`}

                                  className={
                                    styles
                                      .modelSelectorSkeleton
                                  }
                                />
                              )
                            )

                        : models.map(
                            renderModelCard
                          )
                    }


                    {
                      !loadingModels &&

                      models.length ===
                        0 && (
                        <div
                          className={
                            styles
                              .modelSelectorEmpty
                          }
                        >
                          مدلی با این شرایط پیدا نشد.
                        </div>
                      )
                    }
                  </div>
                </>
              )
            }


            {
              !canBrowseAdvancedModels && (
                <div
                  className={
                    styles
                      .modelSelectorStatusRow
                  }
                >
                  <span>
                    مدل‌های انتخاب مستقیم پس از فعال‌شدن اشتراک نمایش داده می‌شوند.
                  </span>
                </div>
              )
            }


            {
              error &&

              !canBrowseAdvancedModels && (
                <div
                  className={
                    styles
                      .modelSelectorError
                  }
                >
                  {
                    error
                  }
                </div>
              )
            }
          </div>
        )
      }
    </div>
  );
}