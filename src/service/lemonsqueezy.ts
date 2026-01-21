import { ofetch } from "ofetch";
import { getLicenseType } from "../utils/format";
import * as serverApi from "./server-api";
//https://docs.lemonsqueezy.com/help/licensing/license-api
enum KEY_STATUSES {
  ACTIVE = "active",
}

//13开头是测试版本，2是正式版本
export enum VALID_STORE_ID {
  MONTHLY = 622075,
  YEARLY = 622076,
  ONETIME = 709187,
}

export enum BuyTypeEnum {
  MONTHLY = "monthly",
  YEARLY = "yearly",
  ONETIME = "onetime",
}

const STORE_ID = 162254;
export const UNKNOWN = "unknown";

async function activateLicense(key: string, instanceName: string) {
  const resp = await serverApi.activateLicense(key, instanceName);
  console.log("resp", resp);
  if (!resp.activated) {
    throw new Error(resp.error);
  } else {
    const validateResp = await validateLicense(key, resp.instance.id);
    if (!validateResp.valid) {
      throw new Error(validateResp.error);
    }
  }
  return { instanceId: resp.instance.id, buyType: resp.meta.product_id };
}

async function deactivateLicense(key: string, instanceId: string) {
  await ofetch("https://api.focusapps.app/lemonsqueezy/licenses/deactivate", {
    method: "POST",
    params: {
      license_key: key,
      instance_id: instanceId,
    },
  });
}

type LicenseKey = {
  valid: boolean;
  type: string;
  error?: string;
};

async function validateLicense(
  key: string,
  instanceId: string,
): Promise<LicenseKey> {
  const resp = await ofetch(
    "https://api.focusapps.app/lemonsqueezy/licenses/validate",
    {
      method: "POST",
      params: {
        license_key: key,
        instance_id: instanceId,
      },
    },
  );
  if (resp.valid) {
    if (resp.license_key.status === KEY_STATUSES.ACTIVE) {
      if (resp.meta.store_id !== STORE_ID) {
        return {
          valid: false,
          error: "Invalid license key",
          type: UNKNOWN,
        };
      } else {
        return { valid: true, type: getLicenseType(resp.meta.product_id) };
      }
    } else {
      return { valid: false, error: resp.status_formatted, type: UNKNOWN };
    }
  }
  return { valid: false, error: resp.error, type: UNKNOWN };
}

export { activateLicense, deactivateLicense, validateLicense };
