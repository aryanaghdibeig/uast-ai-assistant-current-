// components/chat/MessageBubble.tsx

"use client";

import {
  useState,
  type KeyboardEvent,
  type ReactNode,
} from "react";

import ReactMarkdown from "react-markdown";
import type { Components } from "react-markdown";

import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";

import rehypeKatex from "rehype-katex";
import rehypeHighlight from "rehype-highlight";
import rehypeRaw from "rehype-raw";
import rehypeSanitize from "rehype-sanitize";

import styles from "@/app/Chat.module.css";


/* =====================================================
   Types
===================================================== */

type MessageBubbleProps = {
  messageId?: string;

  role:
  | "user"
  | "assistant";

  content: string;

  isLoading?: boolean;

  disabled?: boolean;

  onEditMessage?: (
    messageId: string,
    content: string
  ) => Promise<void>;

  onRegenerateMessage?: (
    messageId: string
  ) => Promise<void>;
};


type CodeBlockProps = {
  className?: string;

  children: string;
};


type IconProps = {
  size?: number;
};


/* =====================================================
   Icons
===================================================== */

function CopyIcon({
  size = 17,
}: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect
        x="9"
        y="9"
        width="11"
        height="11"
        rx="2"
      />

      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  );
}


function CheckIcon({
  size = 17,
}: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="m5 12 4 4L19 6" />
    </svg>
  );
}


function EditIcon({
  size = 17,
}: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M12 20h9" />

      <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4Z" />
    </svg>
  );
}


function SendIcon({
  size = 17,
}: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="m22 2-7 20-4-9-9-4Z" />

      <path d="M22 2 11 13" />
    </svg>
  );
}


function CloseIcon({
  size = 17,
}: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M18 6 6 18" />

      <path d="m6 6 12 12" />
    </svg>
  );
}


function RegenerateIcon({
  size = 17,
}: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M20 6v5h-5" />

      <path d="M4 18v-5h5" />

      <path d="M18.4 9A7 7 0 0 0 6.2 6.2L4 8" />

      <path d="M5.6 15A7 7 0 0 0 17.8 17.8L20 16" />
    </svg>
  );
}


/* =====================================================
   Helpers
===================================================== */

function getCodeLanguage(
  className?: string
) {
  const match =
    /language-([a-zA-Z0-9_-]+)/.exec(
      className || ""
    );

  return match?.[1] || "text";
}


async function copyToClipboard(
  value: string
) {
  if (!value) {
    return false;
  }

  try {
    await navigator.clipboard.writeText(
      value
    );

    return true;
  } catch {
    return false;
  }
}


/* =====================================================
   Code Block
===================================================== */

function CodeBlock({
  className,
  children,
}: CodeBlockProps) {
  const [
    copied,
    setCopied,
  ] = useState(
    false
  );

  const language =
    getCodeLanguage(
      className
    );

  const codeText =
    String(
      children
    ).replace(
      /\n$/,
      ""
    );


  async function handleCopyCode() {
    const success =
      await copyToClipboard(
        codeText
      );

    if (!success) {
      return;
    }

    setCopied(
      true
    );

    window.setTimeout(
      () => {
        setCopied(
          false
        );
      },
      1500
    );
  }


  return (
    <div
      className={
        styles.codeBlockWrapper
      }
      dir="ltr"
    >
      <div
        className={
          styles.codeBlockHeader
        }
      >
        <span>
          {language}
        </span>

        <button
          type="button"
          className={
            styles.codeCopyButton
          }
          title={
            copied
              ? "کپی شد"
              : "کپی کد"
          }
          aria-label={
            copied
              ? "کپی شد"
              : "کپی کد"
          }
          onClick={
            handleCopyCode
          }
        >
          {
            copied
              ? <CheckIcon />
              : <CopyIcon />
          }
        </button>
      </div>

      <pre
        className={
          styles.markdownPre
        }
      >
        <code
          className={
            className
          }
        >
          {codeText}
        </code>
      </pre>
    </div>
  );
}


/* =====================================================
   Markdown Components
===================================================== */

const markdownComponents:
  Components = {
  h1({
    children,
  }) {
    return (
      <h1
        className={
          styles.markdownH1
        }
      >
        {children}
      </h1>
    );
  },

  h2({
    children,
  }) {
    return (
      <h2
        className={
          styles.markdownH2
        }
      >
        {children}
      </h2>
    );
  },

  h3({
    children,
  }) {
    return (
      <h3
        className={
          styles.markdownH3
        }
      >
        {children}
      </h3>
    );
  },

  p({
    children,
  }) {
    return (
      <p
        className={
          styles.markdownParagraph
        }
      >
        {children}
      </p>
    );
  },

  ul({
    children,
  }) {
    return (
      <ul
        className={
          styles.markdownList
        }
      >
        {children}
      </ul>
    );
  },

  ol({
    children,
  }) {
    return (
      <ol
        className={
          styles.markdownList
        }
      >
        {children}
      </ol>
    );
  },

  li({
    children,
  }) {
    return (
      <li
        className={
          styles.markdownListItem
        }
      >
        {children}
      </li>
    );
  },

  blockquote({
    children,
  }) {
    return (
      <blockquote
        className={
          styles.markdownBlockquote
        }
      >
        {children}
      </blockquote>
    );
  },

  hr() {
    return (
      <hr
        className={
          styles.markdownHr
        }
      />
    );
  },

  table({
    children,
  }) {
    return (
      <div
        className={
          styles.markdownTableWrapper
        }
      >
        <table
          className={
            styles.markdownTable
          }
        >
          {children}
        </table>
      </div>
    );
  },

  th({
    children,
  }) {
    return (
      <th>
        {children}
      </th>
    );
  },

  td({
    children,
  }) {
    return (
      <td>
        {children}
      </td>
    );
  },

  a({
    href,
    children,
  }) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className={
          styles.markdownLink
        }
      >
        {children}
      </a>
    );
  },

  img({
    src,
    alt,
  }) {
    return (
      <img
        src={src || ""}
        alt={alt || ""}
        loading="lazy"
        className={
          styles.markdownImage
        }
      />
    );
  },

  code({
    className,
    children,
    ...props
  }) {
    const codeText =
      String(
        children
      );

    const isBlock =
      codeText.includes(
        "\n"
      ) ||
      Boolean(
        className?.includes(
          "language-"
        )
      );

    if (isBlock) {
      return (
        <CodeBlock
          className={
            className
          }
        >
          {codeText}
        </CodeBlock>
      );
    }

    return (
      <code
        className={
          styles.inlineCode
        }
        {...props}
      >
        {children}
      </code>
    );
  },
};


/* =====================================================
   Message Bubble
===================================================== */

export default function MessageBubble({
  messageId,
  role,
  content,
  isLoading = false,
  disabled = false,
  onEditMessage,
  onRegenerateMessage,
}: MessageBubbleProps) {
  const [
    copied,
    setCopied,
  ] = useState(
    false
  );

  const [
    isEditing,
    setIsEditing,
  ] = useState(
    false
  );

  const [
    editValue,
    setEditValue,
  ] = useState(
    content
  );

  const [
    editLoading,
    setEditLoading,
  ] = useState(
    false
  );

  const [
    regenerateLoading,
    setRegenerateLoading,
  ] = useState(
    false
  );

  const [
    editError,
    setEditError,
  ] = useState<
    string |
    null
  >(
    null
  );

  const fallbackContent =
    role === "assistant" &&
      isLoading
      ? "..."
      : "";

  const visibleContent =
    content ||
    fallbackContent;

  const canEdit =
    role === "user" &&
    Boolean(
      messageId
    ) &&
    Boolean(
      onEditMessage
    ) &&
    !disabled &&
    !isLoading;

  const hasRegenerateAction =
    role === "assistant" &&
    Boolean(
      messageId
    ) &&
    Boolean(
      onRegenerateMessage
    );

  const canRegenerate =
    hasRegenerateAction &&
    !disabled &&
    !isLoading &&
    !regenerateLoading;


  /* ===================================================
     Copy Message
  =================================================== */

  async function handleCopyMessage() {
    const success =
      await copyToClipboard(
        content
      );

    if (!success) {
      return;
    }

    setCopied(
      true
    );

    window.setTimeout(
      () => {
        setCopied(
          false
        );
      },
      1500
    );
  }


  /* ===================================================
     Start Editing
  =================================================== */

  function handleStartEditing() {
    if (!canEdit) {
      return;
    }

    setEditValue(
      content
    );

    setEditError(
      null
    );

    setIsEditing(
      true
    );
  }


  /* ===================================================
     Cancel Editing
  =================================================== */

  function handleCancelEditing() {
    if (editLoading) {
      return;
    }

    setEditValue(
      content
    );

    setEditError(
      null
    );

    setIsEditing(
      false
    );
  }


  /* ===================================================
     Save Edited Message
  =================================================== */

  async function handleSaveEditing() {
    const cleanValue =
      editValue.trim();

    if (
      !messageId ||
      !onEditMessage
    ) {
      return;
    }

    if (!cleanValue) {
      setEditError(
        "متن پیام نمی‌تواند خالی باشد."
      );

      return;
    }

    if (
      cleanValue ===
      content.trim()
    ) {
      setIsEditing(
        false
      );

      return;
    }

    try {
      setEditLoading(
        true
      );

      setEditError(
        null
      );

      await onEditMessage(
        messageId,
        cleanValue
      );

      setIsEditing(
        false
      );
    } catch (
    error
    ) {
      setEditError(
        error instanceof Error
          ? error.message
          : "ویرایش پیام انجام نشد."
      );
    } finally {
      setEditLoading(
        false
      );
    }
  }


  /* ===================================================
     Keyboard Editing Controls
  =================================================== */

  function handleEditKeyDown(
    event:
      KeyboardEvent<
        HTMLTextAreaElement
      >
  ) {
    if (
      event.key ===
      "Escape"
    ) {
      event.preventDefault();

      handleCancelEditing();

      return;
    }

    if (
      event.key ===
      "Enter" &&
      (
        event.ctrlKey ||
        event.metaKey
      )
    ) {
      event.preventDefault();

      void handleSaveEditing();
    }
  }


  /* ===================================================
     Regenerate Assistant Message
  =================================================== */

  async function handleRegenerateMessage() {
    if (
      !messageId ||
      !onRegenerateMessage ||
      !canRegenerate
    ) {
      return;
    }


    try {
      setRegenerateLoading(
        true
      );


      await onRegenerateMessage(
        messageId
      );
    } catch (
    error
    ) {
      console.error(
        "Regenerate message error:",

        error
      );


      window.alert(
        error instanceof Error
          ? error.message
          : "بازتولید پاسخ انجام نشد."
      );
    } finally {
      setRegenerateLoading(
        false
      );
    }
  }


  /* ===================================================
     Message Action Button
  =================================================== */

  function renderActionButton({
    label,
    icon,
    disabled:
    buttonDisabled,
    onClick,
  }: {
    label: string;
    icon: ReactNode;
    disabled?: boolean;
    onClick: () => void;
  }) {
    return (
      <button
        type="button"
        className={
          styles.messageActionButton
        }
        title={label}
        aria-label={label}
        disabled={
          buttonDisabled
        }
        onClick={
          onClick
        }
      >
        {icon}
      </button>
    );
  }


  return (
    <div
      className={`${styles.messageRow} ${role === "user"
        ? styles.userRow
        : styles.aiRow
        }`}
    >
      <div
        className={`${styles.bubble} ${role === "user"
          ? styles.userBubble
          : styles.aiBubble
          }`}
      >
        {
          isEditing
            ? (
              <div
                className={
                  styles.messageEditPanel
                }
              >
                <textarea
                  value={
                    editValue
                  }
                  className={
                    styles.messageEditTextarea
                  }
                  disabled={
                    editLoading
                  }
                  rows={4}
                  autoFocus
                  aria-label="ویرایش متن پیام"
                  onChange={
                    (
                      event
                    ) => {
                      setEditValue(
                        event.target.value
                      );

                      if (editError) {
                        setEditError(
                          null
                        );
                      }
                    }
                  }
                  onKeyDown={
                    handleEditKeyDown
                  }
                />

                {
                  editError && (
                    <p
                      className={
                        styles.messageEditError
                      }
                      role="alert"
                      aria-live="polite"
                    >
                      {editError}
                    </p>
                  )
                }

                <div
                  className={
                    styles.messageEditActions
                  }
                >
                  <button
                    type="button"
                    className={
                      styles.messageEditSaveButton
                    }
                    disabled={
                      editLoading
                    }
                    onClick={
                      handleSaveEditing
                    }
                  >
                    <SendIcon />

                    <span>
                      {
                        editLoading
                          ? "در حال ارسال..."
                          : "ذخیره و ارسال مجدد"
                      }
                    </span>
                  </button>

                  <button
                    type="button"
                    className={
                      styles.messageEditCancelButton
                    }
                    disabled={
                      editLoading
                    }
                    onClick={
                      handleCancelEditing
                    }
                  >
                    <CloseIcon />

                    <span>
                      انصراف
                    </span>
                  </button>
                </div>

                <p
                  className={
                    styles.messageEditHint
                  }
                >
                  برای ارسال، Ctrl + Enter و برای انصراف، Esc را فشار دهید.
                </p>
              </div>
            )
            : (
              <>
                {
                  role === "assistant"
                    ? (
                      <div
                        className={
                          styles.markdownContent
                        }
                        dir="rtl"
                      >
                        <ReactMarkdown
                          remarkPlugins={[
                            remarkGfm,
                            remarkMath,
                          ]}
                          rehypePlugins={[
                            rehypeRaw,
                            rehypeSanitize,
                            rehypeKatex,
                            rehypeHighlight,
                          ]}
                          components={
                            markdownComponents
                          }
                        >
                          {visibleContent}
                        </ReactMarkdown>
                      </div>
                    )
                    : (
                      <div
                        className={
                          styles.plainMessageContent
                        }
                        dir="rtl"
                      >
                        {visibleContent}
                      </div>
                    )
                }

                {
                  Boolean(
                    content
                  ) && (
                    <div
                      className={
                        styles.messageActions
                      }
                      role="toolbar"
                      aria-label="ابزارهای پیام"
                    >
                      {
                        renderActionButton({
                          label:
                            copied
                              ? "کپی شد"
                              : role === "assistant"
                                ? "کپی پاسخ"
                                : "کپی پیام",

                          icon:
                            copied
                              ? <CheckIcon />
                              : <CopyIcon />,

                          disabled:
                            disabled ||
                            isLoading,

                          onClick:
                            handleCopyMessage,
                        })
                      }

                      {
                        hasRegenerateAction &&
                        renderActionButton({
                          label:
                            regenerateLoading
                              ? "در حال بازتولید پاسخ..."
                              : "بازتولید پاسخ در شاخه جدید",

                          icon:
                            <RegenerateIcon />,

                          disabled:
                            !canRegenerate,

                          onClick:
                            () => {
                              void handleRegenerateMessage();
                            },
                        })
                      }

                      {
                        canEdit &&
                        renderActionButton({
                          label:
                            "ویرایش پیام و ایجاد شاخه جدید",

                          icon:
                            <EditIcon />,

                          onClick:
                            handleStartEditing,
                        })
                      }
                    </div>
                  )
                }
              </>
            )
        }
      </div>
    </div>
  );
}