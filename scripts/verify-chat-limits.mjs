/**
 * Verifies chat input limit helpers without calling paid APIs.
 */
import {
  CHAT_MESSAGE_TOO_LONG_MESSAGE,
  MAX_CHAT_MESSAGE_CHARS,
  isChatMessageTooLong,
} from "../lib/chat/limits.ts";

const short = "سلام";
const exact = "x".repeat(MAX_CHAT_MESSAGE_CHARS);
const over = "x".repeat(MAX_CHAT_MESSAGE_CHARS + 1);

if (isChatMessageTooLong(short) || isChatMessageTooLong(exact)) {
  console.error("FAIL: under/equal limit flagged");
  process.exit(1);
}

if (!isChatMessageTooLong(over)) {
  console.error("FAIL: over limit not flagged");
  process.exit(1);
}

if (!CHAT_MESSAGE_TOO_LONG_MESSAGE.includes("۲۰۰۰۰")) {
  console.error("FAIL: user message missing Persian limit");
  process.exit(1);
}

if (!CHAT_MESSAGE_TOO_LONG_MESSAGE.includes("بودجه توکن")) {
  console.error("FAIL: message should distinguish token budget");
  process.exit(1);
}

console.log("PASS chat message length checks");
