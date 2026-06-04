import { defineExtensionMessaging } from "@webext-core/messaging";
import type { User } from "~/types";
import type { ScrapedEmail } from "./email-scraper";

export const Message = {
  USER: "user",
  AUTH_SUCCESS: "auth-success",
  OPEN_TAB: "open-tab",
  OPEN_TAB_AND_RETURN: "open-tab-and-return",
  SCRAPE_EMAILS: "scrape-emails",
  EMAILS_COLLECTED: "emails-collected",
  FETCH_EMAILS_FROM_URLS: "fetch-emails-from-urls",
  EMAIL_PROCESSING_PROGRESS: "email-processing-progress",
} as const;

export type Message = (typeof Message)[keyof typeof Message];

interface Messages {
  [Message.USER]: () => User | null;
  [Message.AUTH_SUCCESS]: (tabId: number) => null;
  [Message.OPEN_TAB]: (url: string) => null;
  [Message.OPEN_TAB_AND_RETURN]: () => null;
  [Message.SCRAPE_EMAILS]: (url: string) => ScrapedEmail[];
  [Message.EMAILS_COLLECTED]: (emails: ScrapedEmail[]) => null;
  [Message.FETCH_EMAILS_FROM_URLS]: (urls: string[]) => {
    emails: ScrapedEmail[];
    processed: number;
  };
  [Message.EMAIL_PROCESSING_PROGRESS]: (data: {
    processed: number;
    total: number;
  }) => null;
}

export const { sendMessage, onMessage } = defineExtensionMessaging<Messages>();
