export const Theme = {
  LIGHT: "light",
  DARK: "dark",
  SYSTEM: "system",
} as const;

export const NodeEnv = {
  DEVELOPMENT: "development",
  PRODUCTION: "production",
} as const;

export type Theme = (typeof Theme)[keyof typeof Theme];
export type NodeEnv = (typeof NodeEnv)[keyof typeof NodeEnv];
import type { User as AuthUser } from "better-auth/types";
export type { AuthUser as User };
