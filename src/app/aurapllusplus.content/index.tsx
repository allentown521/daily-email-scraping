import { Button } from "@/components/ui/button";
import ReactDOM from "react-dom/client";
import { browser } from "wxt/browser";
import { createShadowRootUi, defineContentScript } from "#imports";

import "~/assets/styles/globals.css";
import { Message, sendMessage } from "@/lib/messaging";

export default defineContentScript({
  matches: ["https://auraplusplus.com/trending?filter=today"],
  cssInjectionMode: "ui",
  runAt: "document_end",

  async main(ctx) {
    console.log("Content script is running on auraplusplus.");

    const urls = [];

    document.querySelectorAll("a").forEach((a) => {
      const href = a.getAttribute("href");
      const title = a.getAttribute("title");
      if (
        href &&
        href.startsWith("https") &&
        title &&
        !href.includes("open-launch") &&
        !href.includes("auraplusplus")
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
