import { defineContentScript } from "#imports";

import "~/assets/styles/globals.css";
import { Message, sendMessage } from "@/lib/messaging";

export default defineContentScript({
  matches: ["https://theresanaiforthat.com/period/*"],
  cssInjectionMode: "ui",
  runAt: "document_end",

  async main(ctx) {
    console.log("Content script is running on theresanaiforthat.");

    const urls = [];

    document.querySelectorAll("li").forEach((a) => {
      const href = a.getAttribute("data-url");
      if (
        href &&
        href.startsWith("https") &&
        !href.includes("theresanaiforthat")
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
