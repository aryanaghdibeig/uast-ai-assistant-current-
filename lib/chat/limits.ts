// lib/chat/limits.ts
// Shared chat input limits (server enforces; client warns — never silent truncate).

export const MAX_CHAT_MESSAGE_CHARS = 20_000;

/** User-facing error; distinct from output-token / adaptive budget messages. */
export const CHAT_MESSAGE_TOO_LONG_MESSAGE =
  "پیام شما بیش از ۲۰۰۰۰ نویسه است. لطفاً کوتاه‌تر بنویسید یا بخشی را به‌صورت فایل پیوست کنید. این محدودیت طول متن ورودی است و با بودجه توکن خروجی مدل یکی نیست.";

export function isChatMessageTooLong(message: string): boolean {
  return message.length > MAX_CHAT_MESSAGE_CHARS;
}
