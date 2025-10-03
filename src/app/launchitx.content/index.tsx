import { defineContentScript } from "#imports";

import "~/assets/styles/globals.css";
import { Message, sendMessage } from "@/lib/messaging";

export default defineContentScript({
  matches: ["https://launchitx.com/trending?filter=today"],
  cssInjectionMode: "ui",
  runAt: "document_end",

  async main(ctx) {
    console.log("Content script is running on launchitx.");

    const urls = [];

    document.querySelectorAll("main a").forEach((a) => {
      const href = a.getAttribute("href");
      if (
        href &&
        href.startsWith("https") &&
        !href.includes("open-launch") &&
        !href.includes("launchitx")
      ) {
        urls.push(href);
      }
    });

    console.log(`Total URLs collected: ${urls.length}`);

    urls.forEach((url) => {
      sendMessage(Message.OPEN_TAB, url);
    });
  },
});
