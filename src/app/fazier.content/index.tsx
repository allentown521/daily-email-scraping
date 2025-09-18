import { Button } from "@/components/ui/button";
import ReactDOM from "react-dom/client";
import { browser } from "wxt/browser";
import { createShadowRootUi, defineContentScript } from "#imports";

import "~/assets/styles/globals.css";
import { Message, sendMessage } from "@/lib/messaging";

export default defineContentScript({
  matches: ["https://fazier.com/leaderboard/daily/*/*/*"],
  cssInjectionMode: "ui",
  runAt: "document_end",

  async main(ctx) {
    console.log("Content script is running on fazier.");

    const urls = [];

    document.querySelectorAll("a").forEach((a) => {
      const href = a.getAttribute("href");
      if (href && href.includes("launches")) {
        urls.push(href);
      }
    });

    for (const url of urls) {
      await sendMessage(Message.OPEN_TAB, `https://fazier.com/${url}`);
      await new Promise((resolve) => setTimeout(resolve, 3000));
    }

    console.log(`Total URLs collected: ${urls.length}`);
  },
});
