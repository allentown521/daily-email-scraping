import { createAuthClient } from "better-auth/react";
import { env } from "~/lib/env";
import { storage } from "#imports";

const storageAdapter = {
  getItem: async (key: string) =>
    (await storage.getItem<string>(`local:${key}`)) || null,
  setItem: async (key: string, value: string) => {
    await storage.setItem(`local:${key}`, value);
  },
  removeItem: (key: string) => storage.removeItem(`local:${key}`),
};

export const betterAuth = createAuthClient({
  baseURL: env.VITE_BETTER_AUTH_URL,
});
