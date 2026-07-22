/* =========================
  components/chat/ChatPageClient.tsx
========================= */

"use client";

import {
  useEffect,
  useRef,
  useState,
} from "react";

import {
  useRouter,
} from "next/navigation";

import styles from "@/app/Chat.module.css";

import Header from "@/components/layout/Header";

import MessageBubble from "@/components/chat/MessageBubble";

import FilePreview from "@/components/chat/FilePreview";

import ChatInput from "@/components/chat/ChatInput";

import ChatSidebar from "@/components/chat/ChatSidebar";

import AssistantModeSelector from "@/components/chat/AssistantModeSelector";

import WelcomePanel from "@/components/chat/WelcomePanel";

import SmartFollowUpActions from "@/components/chat/SmartFollowUpActions";

/**
 * نمایش وضعیت اعتبار کاربر
 */
import UserCreditsBadge from "@/components/chat/UserCreditsBadge";

/**
 * انتخاب‌گر مدل OpenRouter
 */
import ModelSelector from "@/components/chat/ModelSelector";

import {
  createSupabaseBrowserClient,
} from "@/lib/supabase/client";

import {
  assistantModes,
} from "@/lib/assistant/modes";

import type {
  SmartFollowUpAction,
} from "@/lib/assistant/followups";

import type {
  AssistantModeId,
} from "@/types/chat";


/* =====================================================
   Types
===================================================== */

type Message = {
  id?:
  string;

  role:
  | "user"
  | "assistant";

  content:
  string;

  createdAt?:
  string;
};


type Conversation = {
  id:
  string;

  title:
  string;

  assistantMode:
  AssistantModeId;

  messages:
  Message[];
};


type ConversationBranch = {
  id:
  string;

  conversationId:
  string;

  title:
  string;

  branchOrder:
  number;

  isActive:
  boolean;

  createdAt:
  string;

  updatedAt:
  string;
};


type ChatPageClientProps = {
  userEmail?:
  | string
  | null;
};


type ExecuteMessageOptions = {
  /**
   * دستور واقعی که در پشت صحنه
   * برای مدل ارسال می‌شود.
   */
  apiMessageText:
  string;


  /**
   * متنی که کاربر در صفحه چت
   * مشاهده می‌کند.
   */
  displayMessageText?:
  string;


  attachedFiles?:
  File[];


  clearComposer?:
  boolean;


  /**
   * برای ارسال پیام در یک گفتگوی مشخص،
   * بدون وابستگی به مقدار قدیمی activeConversation.
   */
  conversationIdOverride?:
  string;


  /**
   * تاریخچه‌ای که باید برای مدل ارسال شود.
   * هنگام ساخت شاخه جدید، فقط پیام‌های پیش از پیام ویرایش‌شده
   * در این مقدار قرار می‌گیرند.
   */
  historyOverride?:
  Message[];
};


/* =====================================================
   Helper Functions
===================================================== */

function getConversationTitle(
  message:
    string
) {
  const cleanMessage =
    message.trim();


  if (
    !cleanMessage
  ) {
    return "گفتگوی فایل";
  }


  return cleanMessage.length >
    32
    ? `${cleanMessage.slice(
      0,
      32
    )}...`

    : cleanMessage;
}


function getFriendlyApiError(
  errorText:
    string
) {
  const lowerError =
    errorText.toLowerCase();


  if (
    lowerError.includes(
      "credit"
    ) ||

    lowerError.includes(
      "balance"
    ) ||

    lowerError.includes(
      "quota"
    ) ||

    lowerError.includes(
      "insufficient"
    ) ||

    lowerError.includes(
      "rate limit"
    ) ||

    lowerError.includes(
      "payment"
    )
  ) {
    return "❌ اعتبار OpenRouter کافی نیست یا سهمیه مدل تمام شده است. لطفاً اعتبار حساب OpenRouter را بررسی کنید.";
  }


  if (
    lowerError.includes(
      "api key"
    ) ||

    lowerError.includes(
      "unauthorized"
    ) ||

    lowerError.includes(
      "401"
    )
  ) {
    return "❌ کلید OpenRouter معتبر نیست یا در فایل .env.local به‌درستی تنظیم نشده است.";
  }


  if (
    lowerError.includes(
      "model"
    ) ||

    lowerError.includes(
      "not found"
    ) ||

    lowerError.includes(
      "404"
    )
  ) {
    return "❌ مدل انتخاب‌شده در OpenRouter در دسترس نیست. لطفاً نام مدل را بررسی کنید.";
  }


  return "❌ خطا در دریافت پاسخ از سرویس هوش مصنوعی. لطفاً دوباره تلاش کنید.";
}


function normalizeConversation(
  conversation:
    Conversation
):
  Conversation {
  return {
    ...conversation,


    assistantMode:
      conversation
        .assistantMode ||

      "general",


    messages:
      conversation
        .messages ||

      [],
  };
}


function getLastUserMessage(
  messages:
    Message[]
) {
  for (
    let index =
      messages.length - 1;

    index >= 0;

    index--
  ) {
    if (
      messages[
        index
      ].role ===
      "user"
    ) {
      return messages[
        index
      ].content;
    }
  }


  return "";
}


/* =====================================================
   Component
===================================================== */

export default function ChatPageClient({
  userEmail,
}: ChatPageClientProps) {
  const router =
    useRouter();


  /* =====================================================
     States
  ===================================================== */

  const [
    conversations,

    setConversations,
  ] =
    useState<
      Conversation[]
    >(
      []
    );


  const [
    activeConversationId,

    setActiveConversationId,
  ] =
    useState(
      ""
    );


  const [
    input,

    setInput,
  ] =
    useState(
      ""
    );


  const [
    files,

    setFiles,
  ] =
    useState<
      File[]
    >(
      []
    );


  const [
    loading,

    setLoading,
  ] =
    useState(
      false
    );


  const [
    initialLoading,

    setInitialLoading,
  ] =
    useState(
      true
    );


  const [
    selectedModeId,

    setSelectedModeId,
  ] =
    useState<
      AssistantModeId
    >(
      "general"
    );


  const [
    smartActions,

    setSmartActions,
  ] =
    useState<
      SmartFollowUpAction[]
    >(
      []
    );


  const [
    smartActionsLoading,

    setSmartActionsLoading,
  ] =
    useState(
      false
    );


  const [
    smartActionsSource,

    setSmartActionsSource,
  ] =
    useState(
      ""
    );


  const [
    conversationBranches,

    setConversationBranches,
  ] =
    useState<
      ConversationBranch[]
    >(
      []
    );


  const [
    activeBranchId,

    setActiveBranchId,
  ] =
    useState(
      ""
    );


  const [
    branchLoading,

    setBranchLoading,
  ] =
    useState(
      false
    );


  /* =====================================================
     Refs
  ===================================================== */

  const smartActionsKeyRef =
    useRef(
      ""
    );


  const messagesEndRef =
    useRef<
      HTMLDivElement
    >(
      null
    );


  /* =====================================================
     Active Conversation
  ===================================================== */

  const activeConversation =
    conversations.find(
      (
        conversation
      ) =>
        conversation.id ===
        activeConversationId
    ) ||

    conversations[
    0
    ];


  const messages =
    activeConversation
      ?.messages ||

    [];


  const selectedMode =
    assistantModes.find(
      (
        mode
      ) =>
        mode.id ===
        selectedModeId
    ) ||

    assistantModes[
    0
    ];


  const inputPlaceholder =
    selectedMode
      .placeholder;


  const lastAssistantMessageIndex =
    messages
      .map(
        (
          message
        ) =>
          message.role
      )
      .lastIndexOf(
        "assistant"
      );


  const lastUserMessage =
    getLastUserMessage(
      messages
    );


  const lastAssistantMessage =
    lastAssistantMessageIndex !==
      -1
      ? messages[
        lastAssistantMessageIndex
      ]?.content ||

      ""

      : "";


  const shouldShowSmartActions =
    !loading &&

    !branchLoading &&

    lastAssistantMessageIndex !==
    -1 &&

    Boolean(
      lastAssistantMessage
        .trim()
    );


  const activeBranchIndex =
    conversationBranches.findIndex(
      (
        branch
      ) =>
        branch.id ===
        activeBranchId
    );


  const activeBranch =
    activeBranchIndex >=
      0
      ? conversationBranches[
      activeBranchIndex
      ]
      : null;


  const canGoToPreviousBranch =
    activeBranchIndex >
    0;


  const canGoToNextBranch =
    activeBranchIndex >=
    0 &&

    activeBranchIndex <
    conversationBranches.length -
    1;


  /* =====================================================
     Create Conversation
  ===================================================== */

  const createServerConversation =
    async (
      assistantMode:
        AssistantModeId =
        selectedModeId
    ) => {
      const response =
        await fetch(
          "/api/conversations",

          {
            method:
              "POST",


            headers: {
              "Content-Type":
                "application/json",
            },


            body:
              JSON.stringify({
                title:
                  "گفتگوی جدید",


                assistantMode,
              }),
          }
        );


      if (
        !response.ok
      ) {
        const errorText =
          await response
            .text();


        throw new Error(
          errorText ||

          "ساخت گفتگوی جدید انجام نشد."
        );
      }


      const data =
        await response
          .json();


      if (
        !data.ok ||

        !data
          .conversation
      ) {
        throw new Error(
          "پاسخ ساخت گفتگو معتبر نیست."
        );
      }


      return normalizeConversation(
        data
          .conversation as
        Conversation
      );
    };


  /* =====================================================
     Save Assistant Mode
  ===================================================== */

  const saveConversationMode =
    async (
      conversationId:
        string,


      assistantMode:
        AssistantModeId
    ) => {
      const response =
        await fetch(
          "/api/conversations",

          {
            method:
              "PATCH",


            headers: {
              "Content-Type":
                "application/json",
            },


            body:
              JSON.stringify({
                conversationId,


                assistantMode,
              }),
          }
        );


      if (
        !response.ok
      ) {
        const errorText =
          await response
            .text();


        throw new Error(
          errorText ||

          "ذخیره حالت گفتگو انجام نشد."
        );
      }


      const data =
        await response
          .json();


      if (
        !data.ok
      ) {
        throw new Error(
          "پاسخ ذخیره حالت گفتگو معتبر نیست."
        );
      }


      return data
        .conversation;
    };


  /* =====================================================
     Load Conversations
  ===================================================== */

  const loadConversations =
    async () => {
      try {
        setInitialLoading(
          true
        );


        const response =
          await fetch(
            "/api/conversations"
          );


        if (
          !response.ok
        ) {
          throw new Error(
            "خواندن گفتگوها انجام نشد."
          );
        }


        const data =
          await response
            .json();


        if (
          !data.ok
        ) {
          throw new Error(
            "پاسخ گفتگوها معتبر نیست."
          );
        }


        const loadedConversations =
          (
            data
              .conversations as
            Conversation[]
          ).map(
            normalizeConversation
          );


        if (
          loadedConversations
            .length >
          0
        ) {
          setConversations(
            loadedConversations
          );


          setActiveConversationId(
            loadedConversations[
              0
            ].id
          );


          setSelectedModeId(
            loadedConversations[
              0
            ]
              .assistantMode
          );


          return;
        }


        const created =
          await createServerConversation(
            "general"
          );


        setConversations([
          created,
        ]);


        setActiveConversationId(
          created.id
        );


        setSelectedModeId(
          created
            .assistantMode
        );
      } catch (
      error
      ) {
        console.error(
          "Load conversations error:",

          error
        );


        alert(
          "خطا در بارگذاری گفتگوها. لطفاً صفحه را دوباره بارگذاری کنید."
        );
      } finally {
        setInitialLoading(
          false
        );
      }
    };


  /* =====================================================
     Conversation Branches
  ===================================================== */

  const loadConversationBranches =
    async (
      conversationId:
        string,

      manageLoading =
        true
    ) => {
      if (
        !conversationId
      ) {
        setConversationBranches(
          []
        );


        setActiveBranchId(
          ""
        );


        return [];
      }


      if (
        manageLoading
      ) {
        setBranchLoading(
          true
        );
      }


      try {
        const response =
          await fetch(
            `/api/conversations/${encodeURIComponent(
              conversationId
            )}/branches`,

            {
              cache:
                "no-store",
            }
          );


        const data =
          await response
            .json()
            .catch(
              () => null
            );


        if (
          !response.ok ||
          !data?.ok ||
          !Array.isArray(
            data.branches
          )
        ) {
          throw new Error(
            data?.message ||
            data?.error ||
            "خواندن شاخه‌های گفتگو انجام نشد."
          );
        }


        const loadedBranches =
          data.branches as
          ConversationBranch[];


        const nextActiveBranchId =
          typeof data
            .conversation
            ?.activeBranchId ===
            "string"
            ? data
              .conversation
              .activeBranchId
            : loadedBranches.find(
              (
                branch
              ) =>
                branch.isActive
            )?.id ||
            "";


        setConversationBranches(
          loadedBranches
        );


        setActiveBranchId(
          nextActiveBranchId
        );


        return loadedBranches;
      } catch (
      error
      ) {
        console.error(
          "Load conversation branches error:",

          error
        );


        setConversationBranches(
          []
        );


        setActiveBranchId(
          ""
        );


        throw error;
      } finally {
        if (
          manageLoading
        ) {
          setBranchLoading(
            false
          );
        }
      }
    };


  const reloadConversationFromServer =
    async (
      conversationId:
        string
    ) => {
      const response =
        await fetch(
          "/api/conversations",

          {
            cache:
              "no-store",
          }
        );


      const data =
        await response
          .json()
          .catch(
            () => null
          );


      if (
        !response.ok ||
        !data?.ok ||
        !Array.isArray(
          data.conversations
        )
      ) {
        throw new Error(
          data?.message ||
          data?.error ||
          "بارگذاری مجدد گفتگو انجام نشد."
        );
      }


      const loadedConversations =
        (
          data.conversations as
          Conversation[]
        ).map(
          normalizeConversation
        );


      const refreshedConversation =
        loadedConversations.find(
          (
            conversation
          ) =>
            conversation.id ===
            conversationId
        );


      if (
        !refreshedConversation
      ) {
        throw new Error(
          "گفتگوی فعال پس از تغییر شاخه پیدا نشد."
        );
      }


      setConversations(
        loadedConversations
      );


      setActiveConversationId(
        conversationId
      );


      setSelectedModeId(
        refreshedConversation
          .assistantMode
      );


      return refreshedConversation;
    };


  const handleSelectBranch =
    async (
      branchId:
        string
    ) => {
      if (
        loading ||
        branchLoading ||
        !activeConversation ||
        !branchId ||
        branchId ===
        activeBranchId
      ) {
        return;
      }


      const conversationId =
        activeConversation.id;


      setBranchLoading(
        true
      );


      clearSmartActions();


      try {
        const response =
          await fetch(
            `/api/conversations/${encodeURIComponent(
              conversationId
            )}/branches`,

            {
              method:
                "PATCH",


              headers: {
                "Content-Type":
                  "application/json",
              },


              body:
                JSON.stringify({
                  branchId,
                }),
            }
          );


        const data =
          await response
            .json()
            .catch(
              () => null
            );


        if (
          !response.ok ||
          !data?.ok
        ) {
          throw new Error(
            data?.message ||
            data?.error ||
            "تغییر شاخه گفتگو انجام نشد."
          );
        }


        setActiveBranchId(
          branchId
        );


        await reloadConversationFromServer(
          conversationId
        );


        await loadConversationBranches(
          conversationId,

          false
        );
      } catch (
      error
      ) {
        console.error(
          "Select conversation branch error:",

          error
        );


        alert(
          error instanceof Error
            ? error.message
            : "تغییر شاخه گفتگو انجام نشد."
        );
      } finally {
        setBranchLoading(
          false
        );
      }
    };


  /* =====================================================
     Refresh Conversation Memory
  ===================================================== */

  const refreshConversationMemory =
    async (
      conversationId:
        string
    ) => {
      try {
        const response =
          await fetch(
            "/api/memory",

            {
              method:
                "POST",


              headers: {
                "Content-Type":
                  "application/json",
              },


              body:
                JSON.stringify({
                  conversationId,
                }),
            }
          );


        const data =
          await response
            .json()
            .catch(
              () => null
            );


        if (
          !response.ok ||

          !data?.ok
        ) {
          console.error(
            "Automatic memory refresh failed:",

            data
          );
        }
      } catch (
      error
      ) {
        /**
         * خطای حافظه نباید
         * پاسخ اصلی چت را خراب کند.
         */
        console.error(
          "Automatic memory refresh error:",

          error
        );
      }
    };


  /* =====================================================
     Smart Follow-up Actions
  ===================================================== */

  const loadSmartFollowUps =
    async () => {
      if (
        !shouldShowSmartActions ||

        !activeConversation
      ) {
        setSmartActions(
          []
        );


        setSmartActionsSource(
          ""
        );


        setSmartActionsLoading(
          false
        );


        return;
      }


      const actionKey = [
        activeConversation
          .id,


        selectedModeId,


        activeConversation
          .title,


        lastUserMessage,


        lastAssistantMessage
          .slice(
            0,
            500
          ),
      ].join(
        "|"
      );


      if (
        smartActionsKeyRef
          .current ===
        actionKey
      ) {
        return;
      }


      smartActionsKeyRef
        .current =
        actionKey;


      setSmartActions(
        []
      );


      setSmartActionsSource(
        ""
      );


      setSmartActionsLoading(
        true
      );


      try {
        const response =
          await fetch(
            "/api/followups",

            {
              method:
                "POST",


              headers: {
                "Content-Type":
                  "application/json",
              },


              body:
                JSON.stringify({
                  modeId:
                    selectedModeId,


                  topic:
                    activeConversation
                      .title,


                  conversationTitle:
                    activeConversation
                      .title,


                  lastUserMessage,


                  lastAssistantMessage,
                }),
            }
          );


        if (
          !response.ok
        ) {
          throw new Error(
            "دریافت اقدام‌های پیشنهادی انجام نشد."
          );
        }


        const data =
          await response
            .json();


        if (
          !data.ok ||

          !Array.isArray(
            data.actions
          )
        ) {
          throw new Error(
            "پاسخ اقدام‌های پیشنهادی معتبر نیست."
          );
        }


        setSmartActions(
          data
            .actions as
          SmartFollowUpAction[]
        );


        setSmartActionsSource(
          String(
            data
              .source ||

            ""
          )
        );
      } catch (
      error
      ) {
        console.error(
          "Load smart followups error:",

          error
        );


        setSmartActions(
          []
        );


        setSmartActionsSource(
          ""
        );
      } finally {
        setSmartActionsLoading(
          false
        );
      }
    };


  /* =====================================================
     Effects
  ===================================================== */

  useEffect(
    () => {
      void loadConversations();
    },

    []
  );


  useEffect(
    () => {
      if (
        !activeConversationId
      ) {
        setConversationBranches(
          []
        );


        setActiveBranchId(
          ""
        );


        return;
      }


      void loadConversationBranches(
        activeConversationId
      ).catch(
        () => {
          /**
           * خطا در اینجا ثبت شده است.
           * رابط اصلی گفتگو نباید به‌خاطر خطای شاخه‌ها متوقف شود.
           */
        }
      );
    },

    [
      activeConversationId,
    ]
  );


  useEffect(
    () => {
      void loadSmartFollowUps();
    },

    [
      shouldShowSmartActions,


      activeConversation
        ?.id,


      activeConversation
        ?.title,


      selectedModeId,


      lastUserMessage,


      lastAssistantMessage,
    ]
  );


  useEffect(
    () => {
      messagesEndRef
        .current
        ?.scrollIntoView({
          behavior:
            "smooth",
        });
    },

    [
      messages,


      smartActions,


      smartActionsLoading,
    ]
  );


  /* =====================================================
     Clear Smart Actions
  ===================================================== */

  const clearSmartActions =
    () => {
      smartActionsKeyRef
        .current =
        "";


      setSmartActions(
        []
      );


      setSmartActionsSource(
        ""
      );


      setSmartActionsLoading(
        false
      );
    };


  /* =====================================================
     Logout
  ===================================================== */

  const handleLogout =
    async () => {
      if (
        loading
      ) {
        return;
      }


      const supabase =
        createSupabaseBrowserClient();


      const {
        error,
      } =
        await supabase
          .auth
          .signOut();


      if (
        error
      ) {
        alert(
          "خروج از حساب انجام نشد: " +

          error
            .message
        );


        return;
      }


      router.push(
        "/login"
      );


      router.refresh();
    };


  /* =====================================================
     Local Conversation Updates
  ===================================================== */

  const updateConversationMessages =
    (
      conversationId:
        string,


      updater:
        (
          messages:
            Message[]
        ) =>
          Message[]
    ) => {
      setConversations(
        (
          previous
        ) =>
          previous.map(
            (
              conversation
            ) => {
              if (
                conversation
                  .id !==
                conversationId
              ) {
                return conversation;
              }


              return {
                ...conversation,


                messages:
                  updater(
                    conversation
                      .messages
                  ),
              };
            }
          )
      );
    };


  const updateConversationTitle =
    (
      conversationId:
        string,


      title:
        string
    ) => {
      setConversations(
        (
          previous
        ) =>
          previous.map(
            (
              conversation
            ) => {
              if (
                conversation
                  .id !==
                conversationId
              ) {
                return conversation;
              }


              return {
                ...conversation,


                title,
              };
            }
          )
      );
    };


  const updateConversationMode =
    (
      conversationId:
        string,


      assistantMode:
        AssistantModeId
    ) => {
      setConversations(
        (
          previous
        ) =>
          previous.map(
            (
              conversation
            ) => {
              if (
                conversation
                  .id !==
                conversationId
              ) {
                return conversation;
              }


              return {
                ...conversation,


                assistantMode,
              };
            }
          )
      );
    };


  /* =====================================================
     Start New Conversation
  ===================================================== */

  const startNewConversationWithMode =
    async (
      modeId:
        AssistantModeId,


      promptText =
        ""
    ) => {
      clearSmartActions();


      const newConversation =
        await createServerConversation(
          modeId
        );


      setConversations(
        (
          previous
        ) => [
            newConversation,


            ...previous,
          ]
      );


      setActiveConversationId(
        newConversation
          .id
      );


      setSelectedModeId(
        newConversation
          .assistantMode
      );


      setInput(
        promptText
      );


      setFiles(
        []
      );


      return newConversation;
    };


  /* =====================================================
     Change Assistant Mode
  ===================================================== */

  const handleChangeMode =
    async (
      modeId:
        AssistantModeId
    ) => {
      if (
        loading
      ) {
        return;
      }


      const currentConversation =
        activeConversation;


      const hasMessages =
        Boolean(
          currentConversation
            ?.messages
            ?.length
        );


      try {
        if (
          !currentConversation
        ) {
          await startNewConversationWithMode(
            modeId
          );


          return;
        }


        if (
          hasMessages
        ) {
          await startNewConversationWithMode(
            modeId
          );


          return;
        }


        const previousMode =
          selectedModeId;


        clearSmartActions();


        setSelectedModeId(
          modeId
        );


        updateConversationMode(
          currentConversation
            .id,


          modeId
        );


        try {
          await saveConversationMode(
            currentConversation
              .id,


            modeId
          );
        } catch (
        error
        ) {
          console.error(
            "Save conversation mode error:",

            error
          );


          setSelectedModeId(
            previousMode
          );


          updateConversationMode(
            currentConversation
              .id,


            previousMode
          );


          alert(
            "ذخیره حالت کاری گفتگو انجام نشد. لطفاً دوباره تلاش کنید."
          );
        }
      } catch (
      error
      ) {
        console.error(
          "Change mode error:",

          error
        );


        alert(
          "ساخت گفتگوی جدید با حالت انتخاب‌شده انجام نشد."
        );
      }
    };


  /* =====================================================
     New Chat
  ===================================================== */

  const handleNewChat =
    async () => {
      if (
        loading
      ) {
        return;
      }


      try {
        await startNewConversationWithMode(
          selectedModeId
        );
      } catch (
      error
      ) {
        console.error(
          "New chat error:",

          error
        );


        alert(
          "ساخت گفتگوی جدید انجام نشد."
        );
      }
    };


  /* =====================================================
     Select Conversation
  ===================================================== */

  const handleSelectConversation =
    (
      conversationId:
        string
    ) => {
      if (
        loading
      ) {
        return;
      }


      const selectedConversation =
        conversations.find(
          (
            conversation
          ) =>
            conversation
              .id ===
            conversationId
        );


      clearSmartActions();


      setActiveConversationId(
        conversationId
      );


      setSelectedModeId(
        selectedConversation
          ?.assistantMode ||

        "general"
      );


      setInput(
        ""
      );


      setFiles(
        []
      );
    };


  /* =====================================================
     Delete Conversation
  ===================================================== */

  const handleDeleteConversation =
    async (
      conversationId:
        string
    ) => {
      if (
        loading
      ) {
        return;
      }


      const confirmed =
        window.confirm(
          "آیا از حذف این گفتگو مطمئن هستید؟"
        );


      if (
        !confirmed
      ) {
        return;
      }


      try {
        const response =
          await fetch(
            `/api/conversations?id=${encodeURIComponent(
              conversationId
            )}`,

            {
              method:
                "DELETE",
            }
          );


        if (
          !response.ok
        ) {
          const errorText =
            await response
              .text();


          throw new Error(
            errorText ||

            "حذف گفتگو انجام نشد."
          );
        }


        clearSmartActions();


        const remainingConversations =
          conversations.filter(
            (
              conversation
            ) =>
              conversation
                .id !==
              conversationId
          );


        if (
          remainingConversations
            .length >
          0
        ) {
          setConversations(
            remainingConversations
          );


          if (
            conversationId ===
            activeConversationId
          ) {
            setActiveConversationId(
              remainingConversations[
                0
              ].id
            );


            setSelectedModeId(
              remainingConversations[
                0
              ]
                .assistantMode
            );
          }
        } else {
          await startNewConversationWithMode(
            "general"
          );
        }


        setInput(
          ""
        );


        setFiles(
          []
        );
      } catch (
      error
      ) {
        console.error(
          "Delete conversation error:",

          error
        );


        alert(
          "حذف گفتگو انجام نشد. لطفاً دوباره تلاش کنید."
        );
      }
    };


  /* =====================================================
     Use Welcome Prompt
  ===================================================== */

  const handleUsePrompt =
    async (
      prompt:
        string,


      modeId:
        AssistantModeId
    ) => {
      if (
        loading
      ) {
        return;
      }


      const currentConversation =
        activeConversation;


      const hasMessages =
        Boolean(
          currentConversation
            ?.messages
            ?.length
        );


      try {
        if (
          !currentConversation
        ) {
          await startNewConversationWithMode(
            modeId,


            prompt
          );


          return;
        }


        if (
          hasMessages
        ) {
          await startNewConversationWithMode(
            modeId,


            prompt
          );


          return;
        }


        const previousMode =
          selectedModeId;


        clearSmartActions();


        setSelectedModeId(
          modeId
        );


        setInput(
          prompt
        );


        updateConversationMode(
          currentConversation
            .id,


          modeId
        );


        try {
          await saveConversationMode(
            currentConversation
              .id,


            modeId
          );
        } catch (
        error
        ) {
          console.error(
            "Save prompt mode error:",

            error
          );


          setSelectedModeId(
            previousMode
          );


          updateConversationMode(
            currentConversation
              .id,


            previousMode
          );


          alert(
            "ذخیره حالت کاری گفتگو انجام نشد. لطفاً دوباره تلاش کنید."
          );
        }
      } catch (
      error
      ) {
        console.error(
          "Use prompt error:",

          error
        );


        alert(
          "ساخت گفتگوی جدید با اقدام سریع انجام نشد."
        );
      }
    };


  /* =====================================================
     Execute Chat Message
  ===================================================== */

  const executeMessage =
    async ({
      apiMessageText,


      displayMessageText,


      attachedFiles =
      [],


      clearComposer =
      true,


      conversationIdOverride,


      historyOverride,
    }:
      ExecuteMessageOptions
    ) => {
      const normalizedApiMessage =
        apiMessageText
          .trim();


      const normalizedDisplayMessage =
        (
          displayMessageText ||

          apiMessageText
        ).trim();


      if (
        (
          !normalizedApiMessage &&

          attachedFiles
            .length ===
          0
        ) ||

        loading
      ) {
        return;
      }


      let currentConversation =
        conversationIdOverride
          ? conversations.find(
            (
              conversation
            ) =>
              conversation.id ===
              conversationIdOverride
          ) ||
          activeConversation
          : activeConversation;


      if (
        !currentConversation
      ) {
        try {
          currentConversation =
            await startNewConversationWithMode(
              selectedModeId
            );
        } catch {
          alert(
            "گفتگو آماده نیست. لطفاً دوباره تلاش کنید."
          );


          return;
        }
      }


      clearSmartActions();


      const currentConversationId =
        conversationIdOverride ||

        currentConversation
          .id;


      const previousMessages =
        historyOverride ||

        currentConversation
          .messages ||

        [];


      const userMessage:
        Message = {
        role:
          "user",


        content:
          normalizedDisplayMessage ||

          "📎 [File Uploaded]",
      };


      const assistantMessage:
        Message = {
        role:
          "assistant",


        content:
          "",
      };


      const shouldUpdateTitle =
        currentConversation
          .title ===
        "گفتگوی جدید" &&

        currentConversation
          .messages
          .length ===
        0;


      if (
        shouldUpdateTitle
      ) {
        updateConversationTitle(
          currentConversationId,


          getConversationTitle(
            userMessage
              .content
          )
        );
      }


      updateConversationMode(
        currentConversationId,


        selectedModeId
      );


      updateConversationMessages(
        currentConversationId,


        (
          currentMessages
        ) => [
            ...currentMessages,


            userMessage,


            assistantMessage,
          ]
      );


      if (
        clearComposer
      ) {
        setInput(
          ""
        );


        setFiles(
          []
        );
      }


      setLoading(
        true
      );


      const formData =
        new FormData();


      formData.append(
        "conversationId",


        currentConversationId
      );


      formData.append(
        "assistantMode",


        selectedModeId
      );


      formData.append(
        "message",


        normalizedApiMessage
      );


      formData.append(
        "displayMessage",


        normalizedDisplayMessage
      );


      /**
       * فقط پیام‌های قبلی ارسال می‌شوند.
       * پیام فعلی در Route اضافه خواهد شد.
       */
      formData.append(
        "history",


        JSON.stringify(
          previousMessages
        )
      );


      attachedFiles.forEach(
        (
          file
        ) => {
          formData.append(
            "files",


            file
          );
        }
      );


      try {
        const response =
          await fetch(
            "/api/chat",


            {
              method:
                "POST",


              body:
                formData,
            }
          );


        if (
          !response.ok
        ) {
          const errorText =
            await response
              .text();


          throw new Error(
            getFriendlyApiError(
              errorText
            )
          );
        }


        if (
          !response.body
        ) {
          throw new Error(
            "❌ پاسخ سرور خالی است. لطفاً دوباره تلاش کنید."
          );
        }


        const reader =
          response
            .body
            .getReader();


        const decoder =
          new TextDecoder();


        let fullText =
          "";


        let buffer =
          "";


        while (
          true
        ) {
          const {
            value,


            done,
          } =
            await reader
              .read();


          if (
            done
          ) {
            break;
          }


          buffer +=
            decoder.decode(
              value,


              {
                stream:
                  true,
              }
            );


          const lines =
            buffer.split(
              "\n"
            );


          buffer =
            lines.pop() ||

            "";


          for (
            const line of
            lines
          ) {
            const trimmedLine =
              line.trim();


            if (
              !trimmedLine
                .startsWith(
                  "data: "
                )
            ) {
              continue;
            }


            const data =
              trimmedLine
                .replace(
                  "data: ",


                  ""
                )
                .trim();


            if (
              !data ||

              data ===
              "[DONE]"
            ) {
              continue;
            }


            try {
              const json =
                JSON.parse(
                  data
                );


              const content =
                json
                  .choices?.[
                  0
                ]
                  ?.delta
                  ?.content ||

                "";


              if (
                content
              ) {
                fullText +=
                  content;


                updateConversationMessages(
                  currentConversationId,


                  (
                    currentMessages
                  ) => {
                    const updated =
                      [
                        ...currentMessages,
                      ];


                    updated[
                      updated
                        .length -
                      1
                    ] = {
                      role:
                        "assistant",


                      content:
                        fullText,
                    };


                    return updated;
                  }
                );
              }
            } catch (
            error
            ) {
              console.error(
                "Error parsing stream chunk:",


                error
              );
            }
          }
        }


        if (
          !fullText
            .trim()
        ) {
          updateConversationMessages(
            currentConversationId,


            (
              currentMessages
            ) => {
              const updated =
                [
                  ...currentMessages,
                ];


              updated[
                updated
                  .length -
                1
              ] = {
                role:
                  "assistant",


                content:
                  "❌ پاسخی از مدل دریافت نشد. لطفاً دوباره تلاش کنید.",
              };


              return updated;
            }
          );


          return;
        }


        /**
         * به‌روزرسانی خودکار حافظه
         */
        void refreshConversationMemory(
          currentConversationId
        );
      } catch (
      error
      ) {
        console.error(
          "Chat error:",


          error
        );


        updateConversationMessages(
          currentConversationId,


          (
            currentMessages
          ) => [
              ...currentMessages
                .slice(
                  0,
                  -1
                ),


              {
                role:
                  "assistant",


                content:
                  error instanceof
                    Error
                    ? error
                      .message

                    : "❌ خطا در دریافت پاسخ. لطفاً دوباره تلاش کنید.",
              },
            ]
        );
      } finally {
        setLoading(
          false
        );
      }
    };


  /* =====================================================
     Edit User Message
  ===================================================== */

  const handleEditMessage =
    async (
      messageId:
        string,


      editedContent:
        string
    ) => {
      if (
        loading ||
        branchLoading ||
        !activeConversation
      ) {
        return;
      }


      const normalizedContent =
        editedContent.trim();


      if (
        !normalizedContent
      ) {
        throw new Error(
          "متن پیام نمی‌تواند خالی باشد."
        );
      }


      const conversationId =
        activeConversation.id;


      const editedMessageIndex =
        activeConversation
          .messages
          .findIndex(
            (
              message
            ) =>
              message.id ===
              messageId
          );


      if (
        editedMessageIndex ===
        -1
      ) {
        throw new Error(
          "پیام انتخاب‌شده در گفتگوی فعال پیدا نشد."
        );
      }


      const branchHistory =
        activeConversation
          .messages
          .slice(
            0,


            editedMessageIndex
          );


      setBranchLoading(
        true
      );


      clearSmartActions();


      try {
        const response =
          await fetch(
            "/api/messages/edit",


            {
              method:
                "PATCH",


              headers: {
                "Content-Type":
                  "application/json",
              },


              body:
                JSON.stringify({
                  conversationId,


                  messageId,


                  content:
                    normalizedContent,
                }),
            }
          );


        const data =
          await response
            .json()
            .catch(
              () => null
            );


        if (
          !response.ok ||
          !data?.ok
        ) {
          throw new Error(
            data?.message ||
            data?.error ||
            "ساخت شاخه جدید برای پیام ویرایش‌شده انجام نشد."
          );
        }


        const newBranchId =
          typeof data
            .edit
            ?.newBranch
            ?.id ===
            "string"
            ? data
              .edit
              .newBranch
              .id
            : "";


        if (
          newBranchId
        ) {
          setActiveBranchId(
            newBranchId
          );
        }


        /**
         * ابتدا نمای محلی را تا پیش از پیام ویرایش‌شده
         * به عقب برمی‌گردانیم. سپس متن اصلاح‌شده در همان
         * شاخه جدید به مدل ارسال می‌شود.
         */
        updateConversationMessages(
          conversationId,


          () =>
            branchHistory
        );


        setInput(
          ""
        );


        setFiles(
          []
        );


        await executeMessage({
          apiMessageText:
            normalizedContent,


          displayMessageText:
            normalizedContent,


          attachedFiles:
            [],


          clearComposer:
            false,


          conversationIdOverride:
            conversationId,


          historyOverride:
            branchHistory,
        });


        await reloadConversationFromServer(
          conversationId
        );


        await loadConversationBranches(
          conversationId,


          false
        );
      } catch (
      error
      ) {
        console.error(
          "Edit message error:",


          error
        );


        throw error;
      } finally {
        setBranchLoading(
          false
        );
      }
    };


  /* =====================================================
     Regenerate Assistant Message
  ===================================================== */

  const handleRegenerateMessage =
    async (
      assistantMessageId:
        string
    ) => {
      if (
        loading ||
        branchLoading ||
        !activeConversation
      ) {
        return;
      }


      const conversationId =
        activeConversation.id;


      const assistantMessageIndex =
        activeConversation
          .messages
          .findIndex(
            (
              message
            ) =>
              message.id ===
              assistantMessageId &&
              message.role ===
              "assistant"
          );


      if (
        assistantMessageIndex ===
        -1
      ) {
        throw new Error(
          "پاسخ انتخاب‌شده در گفتگوی فعال پیدا نشد."
        );
      }


      let sourceUserMessageIndex =
        -1;


      for (
        let index =
          assistantMessageIndex -
          1;

        index >=
        0;

        index--
      ) {
        if (
          activeConversation
            .messages[
            index
          ]
            .role ===
          "user"
        ) {
          sourceUserMessageIndex =
            index;


          break;
        }
      }


      if (
        sourceUserMessageIndex ===
        -1
      ) {
        throw new Error(
          "پیام کاربر مرتبط با این پاسخ پیدا نشد."
        );
      }


      const sourceUserMessage =
        activeConversation
          .messages[
        sourceUserMessageIndex
        ];


      if (
        !sourceUserMessage.id
      ) {
        throw new Error(
          "شناسه پیام کاربر برای بازتولید پاسخ در دسترس نیست."
        );
      }


      const sourcePrompt =
        sourceUserMessage
          .content
          .trim();


      if (
        !sourcePrompt
      ) {
        throw new Error(
          "متن پیام کاربر برای بازتولید پاسخ خالی است."
        );
      }


      /**
       * فقط پیام‌های قبل از درخواست اصلی
       * در شاخه جدید کپی می‌شوند.
       */
      const branchHistory =
        activeConversation
          .messages
          .slice(
            0,

            sourceUserMessageIndex
          );


      setBranchLoading(
        true
      );


      clearSmartActions();


      try {
        /**
         * API ویرایش پیام، یک شاخه جدید ایجاد می‌کند.
         * در بازتولید پاسخ، متن پیام کاربر تغییر نمی‌کند.
         */
        const response =
          await fetch(
            "/api/messages/edit",

            {
              method:
                "PATCH",

              headers: {
                "Content-Type":
                  "application/json",
              },

              body:
                JSON.stringify({
                  conversationId,

                  messageId:
                    sourceUserMessage.id,

                  content:
                    sourcePrompt,
                }),
            }
          );


        const data =
          await response
            .json()
            .catch(
              () => null
            );


        if (
          !response.ok ||
          !data?.ok
        ) {
          throw new Error(
            data?.message ||
            data?.error ||
            "ساخت شاخه جدید برای بازتولید پاسخ انجام نشد."
          );
        }


        const newBranchId =
          typeof data
            .edit
            ?.newBranch
            ?.id ===
            "string"
            ? data
              .edit
              .newBranch
              .id
            : "";


        if (
          newBranchId
        ) {
          setActiveBranchId(
            newBranchId
          );
        }


        /**
         * نمای گفتگو تا قبل از پیام کاربر
         * به وضعیت شاخه جدید برمی‌گردد.
         */
        updateConversationMessages(
          conversationId,

          () =>
            branchHistory
        );


        setInput(
          ""
        );


        setFiles(
          []
        );


        /**
         * همان پیام کاربر دوباره برای مدل ارسال می‌شود.
         */
        await executeMessage({
          apiMessageText:
            sourcePrompt,

          displayMessageText:
            sourcePrompt,

          attachedFiles:
            [],

          clearComposer:
            false,

          conversationIdOverride:
            conversationId,

          historyOverride:
            branchHistory,
        });


        /**
         * پیام‌های دارای شناسه واقعی از سرور دریافت می‌شوند.
         */
        await reloadConversationFromServer(
          conversationId
        );


        await loadConversationBranches(
          conversationId,

          false
        );
      } catch (
      error
      ) {
        console.error(
          "Regenerate assistant message error:",

          error
        );


        throw error;
      } finally {
        setBranchLoading(
          false
        );
      }
    };


  /* =====================================================
     Send Message
  ===================================================== */

  const sendMessage =
    async () => {
      await executeMessage({
        apiMessageText:
          input,


        displayMessageText:
          input,


        attachedFiles:
          files,


        clearComposer:
          true,
      });
    };


  /* =====================================================
     Smart Action
  ===================================================== */

  const handleSmartFollowUpAction =
    async (
      action:
        SmartFollowUpAction
    ) => {
      if (
        loading
      ) {
        return;
      }


      await executeMessage({
        apiMessageText:
          action.prompt,


        displayMessageText:
          action.title,


        attachedFiles:
          [],


        clearComposer:
          false,
      });
    };


  /* =====================================================
     Remove File
  ===================================================== */

  const removeFile =
    (
      index:
        number
    ) => {
      setFiles(
        (
          previous
        ) =>
          previous.filter(
            (
              _,


              currentIndex
            ) =>
              currentIndex !==
              index
          )
      );
    };


  /* =====================================================
     Sidebar Data
  ===================================================== */

  const sidebarConversations =
    conversations.map(
      (
        conversation
      ) => ({
        id:
          conversation
            .id,


        title:
          conversation
            .title,


        assistantMode:
          conversation
            .assistantMode,


        messagesCount:
          conversation
            .messages
            .length,
      })
    );


  /* =====================================================
     Loading Screen
  ===================================================== */

  if (
    initialLoading
  ) {
    return (
      <div
        style={{
          minHeight:
            "100vh",


          display:
            "flex",


          alignItems:
            "center",


          justifyContent:
            "center",


          direction:
            "rtl",


          color:
            "#374151",
        }}
      >
        در حال بارگذاری گفتگوها...
      </div>
    );
  }


  /* =====================================================
     Render
  ===================================================== */

  return (
    <div
      className={
        styles
          .appShell
      }
    >
      <ChatSidebar
        conversations={
          sidebarConversations
        }


        activeConversationId={
          activeConversationId
        }


        onNewChat={
          handleNewChat
        }


        onSelectConversation={
          handleSelectConversation
        }


        onDeleteConversation={
          handleDeleteConversation
        }
      />


      <main
        className={
          styles
            .chatContainer
        }
      >
        <Header />


        {/* =============================================
            User Information
        ============================================= */}

        <div
          style={{
            height:
              "44px",


            borderBottom:
              "1px solid var(--border)",


            background:
              "var(--bg)",


            display:
              "flex",


            alignItems:
              "center",


            justifyContent:
              "space-between",


            padding:
              "0 16px",


            direction:
              "rtl",


            fontSize:
              "13px",
          }}
        >
          <span
            style={{
              color:
                "#374151",
            }}
          >
            کاربر واردشده:{" "}

            {
              userEmail ||

              "نامشخص"
            }
          </span>


          <button
            type="button"


            onClick={
              handleLogout
            }


            style={{
              height:
                "30px",


              border:
                "1px solid #d1d5db",


              borderRadius:
                "8px",


              background:
                "#ffffff",


              color:
                "#374151",


              cursor:
                loading
                  ? "not-allowed"

                  : "pointer",


              padding:
                "0 12px",


              fontSize:
                "13px",


              opacity:
                loading
                  ? 0.6

                  : 1,
            }}
          >
            خروج
          </button>
        </div>


        {/* =============================================
            Assistant Mode Selector
        ============================================= */}

        <AssistantModeSelector
          selectedModeId={
            selectedModeId
          }


          onChangeMode={
            handleChangeMode
          }
        />


        {/* =============================================
            OpenRouter Model Selector
        ============================================= */}

        <ModelSelector
          conversationId={
            activeConversation
              ?.id ||

            ""
          }


          disabled={
            loading ||
            branchLoading
          }
        />


        {/* =============================================
            User Credits Badge
        ============================================= */}

        <div
          style={{
            width:
              "100%",


            maxWidth:
              360,


            marginRight:
              16,


            marginTop:
              8,


            marginBottom:
              12,
          }}
        >
          <UserCreditsBadge />
        </div>


        {/* =============================================
            Messages
        ============================================= */}

        <div
          className={
            styles
              .messages
          }
        >
          {
            conversationBranches.length >
            1 && (
              <div
                className={
                  styles
                    .branchNavigator
                }


                dir="rtl"
              >
                <button
                  type="button"


                  className={
                    styles
                      .branchNavigatorButton
                  }


                  onClick={
                    () => {
                      const previousBranch =
                        conversationBranches[
                        activeBranchIndex -
                        1
                        ];


                      if (
                        previousBranch
                      ) {
                        void handleSelectBranch(
                          previousBranch.id
                        );
                      }
                    }
                  }


                  disabled={
                    !canGoToPreviousBranch ||
                    loading ||
                    branchLoading
                  }


                  title="شاخه قبلی"


                  aria-label="شاخه قبلی"
                >
                  <svg
                    viewBox="0 0 24 24"


                    aria-hidden="true"
                  >
                    <path
                      d="m15 18-6-6 6-6"
                    />
                  </svg>
                </button>


                <div
                  className={
                    styles
                      .branchNavigatorInfo
                  }
                >
                  <strong>
                    شاخه {
                      activeBranchIndex +
                      1
                    } از {
                      conversationBranches.length
                    }
                  </strong>


                  <span>
                    {
                      branchLoading
                        ? "در حال تغییر شاخه..."
                        : activeBranch
                          ?.title ||
                        "نسخه گفتگو"
                    }
                  </span>
                </div>


                <button
                  type="button"


                  className={
                    styles
                      .branchNavigatorButton
                  }


                  onClick={
                    () => {
                      const nextBranch =
                        conversationBranches[
                        activeBranchIndex +
                        1
                        ];


                      if (
                        nextBranch
                      ) {
                        void handleSelectBranch(
                          nextBranch.id
                        );
                      }
                    }
                  }


                  disabled={
                    !canGoToNextBranch ||
                    loading ||
                    branchLoading
                  }


                  title="شاخه بعدی"


                  aria-label="شاخه بعدی"
                >
                  <svg
                    viewBox="0 0 24 24"


                    aria-hidden="true"
                  >
                    <path
                      d="m9 18 6-6-6-6"
                    />
                  </svg>
                </button>
              </div>
            )
          }


          {
            messages
              .length ===
            0 && (
              <WelcomePanel
                selectedModeId={
                  selectedModeId
                }


                onSelectMode={
                  handleChangeMode
                }


                onUsePrompt={
                  handleUsePrompt
                }
              />
            )
          }


          {
            messages.map(
              (
                message,


                index
              ) => (
                <div
                  key={`${activeConversationId}-${index}`}
                >
                  <MessageBubble
                    messageId={
                      message.id
                    }

                    role={
                      message
                        .role
                    }

                    content={
                      message
                        .content
                    }

                    isLoading={
                      loading &&

                      index ===
                      messages
                        .length -
                      1
                    }

                    disabled={
                      loading ||
                      branchLoading
                    }

                    onEditMessage={
                      handleEditMessage
                    }

                    onRegenerateMessage={
                      handleRegenerateMessage
                    }
                  />


                  {
                    message
                      .role ===
                    "assistant" &&


                    index ===
                    lastAssistantMessageIndex &&


                    shouldShowSmartActions && (
                      <SmartFollowUpActions
                        actions={
                          smartActions
                        }


                        loading={
                          smartActionsLoading
                        }


                        source={
                          smartActionsSource
                        }


                        disabled={
                          loading ||
                          branchLoading
                        }


                        onUseAction={
                          handleSmartFollowUpAction
                        }
                      />
                    )
                  }
                </div>
              )
            )
          }


          <div
            ref={
              messagesEndRef
            }
          />
        </div>


        {/* =============================================
            Files
        ============================================= */}

        <FilePreview
          files={
            files
          }


          onRemoveFile={
            removeFile
          }
        />


        {/* =============================================
            Chat Input
        ============================================= */}

        <ChatInput
          input={
            input
          }


          setInput={
            setInput
          }


          files={
            files
          }


          setFiles={
            setFiles
          }


          loading={
            loading ||
            branchLoading
          }


          onSendMessage={
            sendMessage
          }


          placeholder={
            inputPlaceholder
          }
        />
      </main>
    </div>
  );
}