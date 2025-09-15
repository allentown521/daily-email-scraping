import { StorageKey, getStorage } from "@/lib/storage";
import { betterAuth } from "@/lib/supabase";
import { Message, onMessage } from "~/lib/messaging";
import { browser, defineBackground } from "#imports";

const main = () => {
  console.log(
    "Background service worker is running! Edit `src/app/background` and save to reload."
  );
};

onMessage(Message.USER, () => {
  const storage = getStorage(StorageKey.USER);
  return storage.getValue();
});

onMessage(Message.AUTH_SUCCESS, (meessage) => {
  const intervalId = setInterval(async () => {
    const { data: session, error } = await betterAuth.getSession();
    if (!error && session?.user) {
      clearInterval(intervalId);

      // 查询当前扩展打开的options.html页面
      const optionsPages = await browser.tabs.query({
        url: browser.runtime.getURL("/options.html"),
      });

      // 如果找到页面则更新，否则创建新页面
      if (optionsPages.length > 0 && optionsPages[0]?.id) {
        await browser.tabs.update(optionsPages[0].id, {
          url: "options.html",
          active: true,
        });
      } else {
        await browser.tabs.create({
          url: "options.html",
          active: true,
        });
      }

      browser.tabs.remove(meessage.data);
    }
  }, 3000);
});

export default defineBackground(main);
