import { getLicenseType } from "../utils/format";
import { getBrowser, getOS } from "../utils/navigator";
import * as lemonsqueezy from "./lemonsqueezy";

const premiumKey = "premium";
interface PremiumActivation {
  licenseKey: string;
  instanceId: string;
  type: string;
  expiredAt?: string;
}

async function getInstanceName() {
  const suffix = "Extension";
  return `${getOS()} / ${getBrowser()} / ${suffix}`;
}

export async function activatePremium(
  licenseKey: string
): Promise<PremiumActivation> {
  const { instanceId, buyType } = await lemonsqueezy.activateLicense(
    licenseKey,
    await getInstanceName()
  );
  const str: string = getLicenseType(buyType);
  const data = { licenseKey, instanceId, type: str };
  await chrome.storage.local.set({ [premiumKey]: JSON.stringify(data) });
  return data;
}

export async function validatePremium() {
  const activation = await getPremiumActivation();
  if (!activation) {
    return { valid: false };
  }

  return lemonsqueezy.validateLicense(
    activation.licenseKey,
    activation.instanceId
  );
}

export async function validatePremiumOnline() {
  let validateResp;
  try {
    validateResp = await validatePremium();
  } catch (e) {
    const localValidateResp = await getPremiumActivation();
    validateResp = localValidateResp
      ? { valid: true, ...localValidateResp }
      : undefined;
  }
  return {
    activated: validateResp?.valid,
    type: validateResp?.type,
    error: validateResp?.valid === true ? undefined : validateResp?.error,
  };
}

export async function deactivatePremium() {
  const activation = await getPremiumActivation();
  if (!activation) {
    return;
  }
  await lemonsqueezy.deactivateLicense(
    activation.licenseKey,
    activation.instanceId
  );
  await chrome.storage.local.remove(premiumKey);
}

export async function getPremiumActivation(): Promise<PremiumActivation | null> {
  const data = await chrome.storage.local.get(premiumKey);
  if (data && data[premiumKey]) {
    try {
      return JSON.parse(data[premiumKey]);
    } catch (e) {
      console.error("parse premium error", e);
      return null;
    }
  }

  return null;
}
