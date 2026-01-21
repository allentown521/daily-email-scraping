import { ofetch } from "ofetch";

export async function decodePoeFormkey(html: string): Promise<string> {
  const resp = await ofetch(
    "https://us-central1-aichatone.cloudfunctions.net/decode-formkey",
    {
      method: "POST",
      body: { html },
    },
  );
  return resp.formkey;
}

type ActivateResponse =
  | {
      activated: true;
      instance: { id: string };
      meta: { product_id: number; product_name: string };
    }
  | { activated: false; error: string };

export async function activateLicense(key: string, instanceName: string) {
  return ofetch<ActivateResponse>(
    "https://api.focusapps.app/lemonsqueezy/licenses/activate",
    {
      method: "POST",
      params: {
        license_key: key,
        instance_name: instanceName,
      },
    },
  );
}

interface Product {
  price: number;
}

export async function fetchPremiumProduct() {
  return ofetch<Product>(
    "https://us-central1-aichatone.cloudfunctions.net/premium/product",
  );
}

export async function createDiscount() {
  return ofetch<{ code: string; startTime: number }>(
    "https://us-central1-aichatone.cloudfunctions.net/premiumdiscount/create",
    {
      method: "POST",
    },
  );
}

export interface VersionInfo {
  versionCode: {
    win32?: string;
    darwin?: string;
    web?: string;
    linux?: string;
  };
}

export interface Notify {
  title: string;
  debug: boolean;
  versionCode: string;
  description?: string;
}

export interface MailerliteSubscriberCreate {
  email: string;
  groups?: Array<string>;
  fields?: object;
}

interface MailerliteSubscriberInfoData {
  data: MailerliteSubscriberInfo;
}

export interface MailerliteSubscriberInfo {
  email: string;
  subscribed_at: string;
  created_at: string;
  unsubscribed_at?: string;
  status: string;
}

const mailerliteAuthKey =
  "eyJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiJ9.eyJhdWQiOiI0IiwianRpIjoiNjAxY2MyYjhiZDNjYTU4OGI2M2MzZGFhZWVhOTc2YzM2MDU3YTliODMxZGUzOTYwYTgwOGY0MjNiMWQ0ZDRmYjhkOGIzZDQ1NjQzYmFkNDgiLCJpYXQiOjE3MDAxODcyNTQuODQxMTA4LCJuYmYiOjE3MDAxODcyNTQuODQxMTEzLCJleHAiOjQ4NTU4NjA4NTQuODM1NTI4LCJzdWIiOiI2OTY2NTkiLCJzY29wZXMiOltdfQ.UF8uoQkwJdx4k8kpzRCRGX72KCNFBiLBeCtnnADmnJVzP0AvqrIN4ExNdwFtrPZyzCqrKDfrrgFZ7CgkWmMuDKVJdXSoY2wAA-iQEdY2TLirZCxzv6tPLdWLW9HHnPxzMmMV5jqYMyHOwTZV6WXercwVWHTNacHO_1ftwyk3901iqS6UhgnLehz4u7mje-zVZjLcvEG5A44mEk6RTNaFLO-CfPEt9T63GKTunPv9UcFpSafZoXdbnMLAHWk8ZOvyRa8BEtF-lhOGaqOzxkD6AcD0x2BrB1JRzl5c3wZc7MZcGiyG4vW1zSKFXuHbBZwx0J3UdVfPAPhMz1RBpOXmKAIrHwvPYRI10hvzbS_ATXjA-Y52YlvVUPA7LG3W36cFls0vYRxh7bFqFbbS6UCDmLCOfpbQ7rGhlfF73I3xGFRHVznqvvbai343RBQ2U85txYzL7_TkchOQ9r9y5MmUUPSrnt-f-sx3NzxL-Ho4VYMEx_C3QBRhGQJrw0ciuoXloc00FZ1tMjdDIjCIKs-IayJyieMo5EhucjoSQ4P4hrqcrVhKyLEC4qtCfI_ibOFjjW4F7LQd0Fl05ef6B1ZFphsNZtRSPq-NzQ04cpzZuqCPy_fJpV-Mt_adwvkJCdTi9dpPlWVJAYoLQ-kmFhHyoUzKCudrn3wkcpvPAIteycs";

export async function fetchVersionInfo() {
  return ofetch<VersionInfo>(
    "https://us-central1-aichatone.cloudfunctions.net/check-update",
  );
}

export async function fetchNotify() {
  return ofetch<Notify>(
    "https://us-central1-aichatone.cloudfunctions.net/check-notify",
  );
}

export async function createMailerliteSubscriber(
  params: MailerliteSubscriberCreate,
) {
  return ofetch.raw("https://connect.mailerlite.com/api/subscribers", {
    method: "POST",
    responseType: "json",
    headers: {
      Authorization: `Bearer ${mailerliteAuthKey}`,
    },
    body: {
      email: params.email,
      groups: ["111512279243031881"], //AIChatOne group
      fields: params.fields,
    },
  });
}

export async function fetchMailerliteSubscriber(email: string) {
  return ofetch<MailerliteSubscriberInfoData>(
    `https://connect.mailerlite.com/api/subscribers/${email}`,
    {
      method: "GET",
      responseType: "json",
      headers: {
        Authorization: `Bearer ${mailerliteAuthKey}`,
      },
    },
  );
}
