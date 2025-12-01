import { validatePremiumOnline } from "@/service/premium";
import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { browser } from "wxt/browser";
import type { User } from "~/types";

export const cn = (...inputs: ClassValue[]) => twMerge(clsx(inputs));

export const getName = (user: User) => {
  const name = user.name;

  const nameFromEmail = user.email?.split("@")[0];

  return typeof name === "string"
    ? name
    : nameFromEmail
    ? nameFromEmail
    : undefined;
};

export const getAvatar = (user: User) => {
  const avatar: unknown = user.image;

  return typeof avatar === "string" ? avatar : undefined;
};

export const scraperEnabled = async () => {
  const storage = await browser.storage.local.get(["contentScriptEnabled"]);
  return storage.contentScriptEnabled !== false;
};

export const isPurchasedOrTrial = async () => {
  const { activated } = await validatePremiumOnline();
  if (!activated) {
    const isInTrialResult = await checkIsInTrial();
    return isInTrialResult.isInTrial;
  }
  return true;
};

export const checkIsInTrial = async () => {
  const storage = await browser.storage.local.get(["contactId"]);
  const contactId = storage.contactId;
  try {
    // 总是从服务器获取试用状态
    const response = await fetch(
      `https://plunk.focusapps.app/api/v1/contacts/${contactId}`
    );

    if (!response.ok) {
      return { isInTrial: false, daysLeft: 0 };
    }

    const contactData = await response.json();
    const createdAt = new Date(contactData.createdAt);
    const now = new Date();
    const daysDiff = Math.floor(
      (now.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24)
    );
    const daysLeft = Math.max(0, 3 - daysDiff);

    return {
      isInTrial: daysLeft > 0,
      hasStarted: contactData.subscribed,
      daysLeft,
    };
  } catch (error) {
    console.error("Error checking trial status:", error);

    return { isInTrial: false, daysLeft: 0 };
  }
};
