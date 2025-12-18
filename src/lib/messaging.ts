import { defineExtensionMessaging } from "@webext-core/messaging";
import type { User } from "~/types";

export const Message = {
  USER: "user",
  AUTH_SUCCESS: "auth-success",
  OPEN_TAB: "open-tab",
  OPEN_TAB_AND_RETURN: "open-tab-and-return",
} as const;

export type Message = (typeof Message)[keyof typeof Message];

interface Messages {
  [Message.USER]: () => User | null;
  [Message.AUTH_SUCCESS]: (tabId: number) => null;
  [Message.OPEN_TAB]: (url: string) => null;
  [Message.OPEN_TAB_AND_RETURN]: () => null;
}

export const { sendMessage, onMessage } = defineExtensionMessaging<Messages>();
