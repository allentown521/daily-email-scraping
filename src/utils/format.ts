import { BuyTypeEnum, UNKNOWN, VALID_STORE_ID } from "../service/lemonsqueezy";

export function formatDecimal(value: number) {
  return new Intl.NumberFormat("en-US", { notation: "compact" }).format(value);
}

export function formatAmount(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(value);
}

export function formatTime(time: number) {
  const date = new Date(time);
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${month}/${day} ${hours}:${minutes}`;
}

export function splitTextByNumbers(text: string) {
  const regex = /^\d+\.\s+/gm;
  return text
    .replace(regex, "")
    .split("\n")
    .map((item) => item.trim())
    .filter(Boolean);
}

export function getLicenseType(productId: number): string {
  if (productId === VALID_STORE_ID.MONTHLY) {
    return BuyTypeEnum.MONTHLY;
  } else if (productId === VALID_STORE_ID.YEARLY) {
    return BuyTypeEnum.YEARLY;
  } else if (productId === VALID_STORE_ID.ONETIME) {
    return BuyTypeEnum.ONETIME;
  } else {
    return UNKNOWN;
  }
}
