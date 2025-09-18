import { Button } from "@/components/ui/button";
import ReactDOM from "react-dom/client";
import { browser } from "wxt/browser";
import { createShadowRootUi, defineContentScript } from "#imports";

import "~/assets/styles/globals.css";
import { Message, sendMessage } from "@/lib/messaging";

export default defineContentScript({
  matches: ["https://peerlist.io/*/project/*"],
  cssInjectionMode: "ui",
  runAt: "document_end",

  async main(ctx) {
    console.log("Content script is running on peerlist detail.");

    const urls = [];

    document.querySelectorAll("a").forEach((a) => {
      const href = a.getAttribute("href");
      if (href && href.includes("ref=peerlist")) {
        urls.push(href);
      }
    });

    if (urls && urls[0]) {
      await sendMessage(Message.OPEN_TAB, `${urls[0]}`);
    }

    console.log(`Total URLs collected: ${urls.length}`);
  },
});
