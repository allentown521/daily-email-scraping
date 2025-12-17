import { defineContentScript } from "#imports";

import "~/assets/styles/globals.css";
import { Message, sendMessage } from "@/lib/messaging";
import { scraperEnabled } from "@/lib/utils";

export default defineContentScript({
  matches: ["https://peerpush.net/p/*"],
  cssInjectionMode: "ui",
  runAt: "document_end",

  async main(ctx) {
    console.log("Content script is running on peerpush detail.");
    if (!(await scraperEnabled())) {
      return;
    }
    const visitSiteUrls = [];

    document.querySelectorAll("a").forEach((a) => {
      if (a.innerText.trim() === "Visit site") {
        const href = a.getAttribute("href");
        if (href) {
          visitSiteUrls.push(href);
        }
      }
    });

    if (visitSiteUrls && visitSiteUrls[0]) {
      await sendMessage(Message.OPEN_TAB, `${visitSiteUrls[0]}`);
    }

    console.log(`Total "Visit site" URLs collected: ${visitSiteUrls.length}`);
  },
});
