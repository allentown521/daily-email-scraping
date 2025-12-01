import { defineContentScript } from "#imports";

import "~/assets/styles/globals.css";
import { Message, sendMessage } from "@/lib/messaging";
import { scraperEnabled } from "@/lib/utils";

export default defineContentScript({
  matches: ["https://www.uneed.best/"],
  cssInjectionMode: "ui",
  runAt: "document_end",

  async main(ctx) {
    console.log("Content script is running on unseed.");
    if (!(await scraperEnabled())) {
      return;
    }
    setTimeout(async () => {
      const urls = [];
      document.querySelectorAll("a").forEach((a) => {
        const href = a.getAttribute("href");
        if (
          href &&
          href.includes("ref=uneed.best") &&
          href.startsWith("https")
        ) {
          urls.push(href);
        }
      });
      console.log(`Total URLs collected: ${urls.length}`);

      for (const url of urls) {
        await sendMessage(Message.OPEN_TAB, `${url}`);
        await new Promise((resolve) => setTimeout(resolve, 3000));
      }
    }, 10000);
  },
});
