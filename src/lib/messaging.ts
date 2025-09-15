import { defineExtensionMessaging } from "@webext-core/messaging";
import type { User } from "~/types";

export const Message = {
  USER: "user",
  AUTH_SUCCESS: "auth-success",
} as const;

export type Message = (typeof Message)[keyof typeof Message];

interface Messages {
  [Message.USER]: () => User | null;
  [Message.AUTH_SUCCESS]: (tabId: number) => null;
}

export const { sendMessage, onMessage } = defineExtensionMessaging<Messages>();
