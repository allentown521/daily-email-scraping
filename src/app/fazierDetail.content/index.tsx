import { defineContentScript } from "#imports";

import "~/assets/styles/globals.css";
import { Message, sendMessage } from "@/lib/messaging";
import { scraperEnabled } from "@/lib/utils";

export default defineContentScript({
  matches: ["https://fazier.com/launches/*"],
  cssInjectionMode: "ui",
  runAt: "document_end",

  async main(ctx) {
    console.log("Content script is running on fazier detail.");
    if (!(await scraperEnabled())) {
      return;
    }
    const urls = [];

    document.querySelectorAll("a").forEach((a) => {
      const href = a.getAttribute("href");
      if (href && href.includes("ref=fazier")) {
        urls.push(href);
      }
    });

    if (urls && urls[0]) {
      await sendMessage(Message.OPEN_TAB, `${urls[0]}`);
    }

    console.log(`Total URLs collected: ${urls.length}`);
  },
});
