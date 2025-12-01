import { defineContentScript } from "#imports";

import "~/assets/styles/globals.css";
import { Message, sendMessage } from "@/lib/messaging";
import { scraperEnabled } from "@/lib/utils";

export default defineContentScript({
  matches: ["https://www.startupfa.st/trending?filter=today"],
  cssInjectionMode: "ui",
  runAt: "document_end",

  async main(ctx) {
    console.log("Content script is running on startupfa.st.");
    if (!(await scraperEnabled())) {
      return;
    }
    const urls = [];

    document.querySelectorAll("a").forEach((a) => {
      const href = a.getAttribute("href");
      const title = a.getAttribute("title");
      if (
        href &&
        href.startsWith("https") &&
        title &&
        !href.includes("startupfa") &&
        !href.includes("open-launch")
      ) {
        urls.push(href);
      }
    });

    console.log(`Total URLs collected: ${urls.length}`);

    for (const url of urls) {
      await sendMessage(Message.OPEN_TAB, `${url}`);
      await new Promise((resolve) => setTimeout(resolve, 3000));
    }
  },
});
