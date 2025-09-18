import { defineContentScript } from "#imports";

import "~/assets/styles/globals.css";
import { Message, sendMessage } from "@/lib/messaging";

export default defineContentScript({
  matches: ["https://www.tinylaunch.com/"],
  cssInjectionMode: "ui",
  runAt: "document_end",

  async main(ctx) {
    console.log("Content script is running on tinylaunch.");

    const urls = [];

    document.querySelectorAll("a").forEach((a) => {
      const href = a.getAttribute("href");
      if (href && href.startsWith("https") && !href.includes("tinylaunch")) {
        urls.push(href);
      }
    });

    console.log(`Total URLs collected: ${urls.length}`);

    urls.forEach((url) => {
      sendMessage(Message.OPEN_TAB, url);
    });
  },
});
