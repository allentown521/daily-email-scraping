import { useEffect, useState } from "react";
import { Theme, type User } from "~/types";
import { type WxtStorageItem, storage as browserStorage } from "#imports";
import type { ReacherCacheMap, ScrapedEmail } from "./email-scraper";

export const StorageKey = {
  THEME: "local:theme",
  USER: "local:user",
  COLLECTED_EMAILS: "local:collected_emails",
  REACHER_CACHE: "local:reacher_cache",
} as const;

export type StorageKey = (typeof StorageKey)[keyof typeof StorageKey];

const storage = {
  [StorageKey.THEME]: browserStorage.defineItem<Theme>(StorageKey.THEME, {
    fallback: Theme.SYSTEM,
  }),
  [StorageKey.USER]: browserStorage.defineItem<User | null>(StorageKey.USER, {
    fallback: null,
  }),
  [StorageKey.COLLECTED_EMAILS]: browserStorage.defineItem<ScrapedEmail[]>(
    StorageKey.COLLECTED_EMAILS,
    {
      fallback: [],
    },
  ),
  // Reacher 校验结果缓存：email -> { reachable, reasons, cachedAt }
  // 注：reachable 的语义是「通过清洗规则、应入库发送」，并非单纯可达；
  // reasons 记录命中的丢弃原因，便于缓存命中时复盘
  [StorageKey.REACHER_CACHE]: browserStorage.defineItem<ReacherCacheMap>(
    StorageKey.REACHER_CACHE,
    {
      fallback: {},
    },
  ),
} as const;

type Value<T extends StorageKey> = (typeof storage)[T] extends WxtStorageItem<
  infer V,
  infer _
>
  ? V
  : never;

export const getStorage = <K extends StorageKey>(key: K) => {
  return storage[key];
};

export const useStorage = <K extends StorageKey>(key: K) => {
  const item = storage[key] as WxtStorageItem<
    Value<K>,
    Record<string, unknown>
  >;
  const [value, setValue] = useState<Value<K> | null>(null);

  useEffect(() => {
    const unwatch = item.watch((value) => {
      setValue(value);
    });

    return () => {
      unwatch();
    };
  }, [item]);

  useEffect(() => {
    (async () => {
      const value = await item.getValue();
      setValue(value);
    })();
  }, [item.getValue]);

  const remove = () => {
    void item.removeValue();
  };

  const set = (value: Value<K>) => {
    void item.setValue(value);
  };

  return { data: value ?? item.fallback, remove, set };
};
