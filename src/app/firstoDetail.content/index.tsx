import { Button } from "@/components/ui/button";
import ReactDOM from "react-dom/client";
import { browser } from "wxt/browser";
import { createShadowRootUi, defineContentScript } from "#imports";

import "~/assets/styles/globals.css";
import { Message, sendMessage } from "@/lib/messaging";

export default defineContentScript({
  matches: ["https://firsto.co/projects/*"],
  cssInjectionMode: "ui",
  runAt: "document_end",

  async main(ctx) {
    console.log("Content script is running on firsto.");

    const urls = [];

    document.querySelectorAll("a").forEach((a) => {
      const href = a.getAttribute("href");
      const dataUmamiEvent = a.getAttribute("data-umami-event");
      if (
        href &&
        dataUmamiEvent &&
        href.startsWith("https") &&
        !href.includes("firsto") &&
        !href.includes("open-launch")
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
