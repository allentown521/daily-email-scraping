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
