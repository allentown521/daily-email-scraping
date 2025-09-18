import { Button } from "@/components/ui/button";
import ReactDOM from "react-dom/client";
import { browser } from "wxt/browser";
import { createShadowRootUi, defineContentScript } from "#imports";

import "~/assets/styles/globals.css";
import { Message, sendMessage } from "@/lib/messaging";

export default defineContentScript({
  matches: ["https://peerlist.io/launchpad/*/*/*"],
  cssInjectionMode: "ui",
  runAt: "document_end",

  async main(ctx) {
    console.log("Content script is running on peerlist.");

    const urls = [];
    let pageCount = 0;
    let previousHeight = 0;
    let currentHeight = document.body.scrollHeight;
    let noChangeCount = 0;
    const maxNoChangeCount = 5; // 增加到5次，给更多机会确认是否真的加载完毕
    const maxScrollAttempts = 80; // 设置最大滚动尝试次数，防止无限循环

    // 记录已经看到的产品数量，用于检测是否有新内容
    let previousProductCount = 0;

    while (pageCount < maxScrollAttempts && noChangeCount < maxNoChangeCount) {
      pageCount++;

      previousHeight = currentHeight;

      // 使用更自然的渐进式滚动，模拟人类滚动行为
      const viewportHeight = window.innerHeight;
      const scrollPosition = window.scrollY;

      // 随机化滚动距离，使其更像人类行为，同时确保向下滚动
      const randomFactor = 0.5 + Math.random() * 0.5; // 0.5-1.0之间的随机数
      const scrollStep = viewportHeight * randomFactor;

      // 计算目标滚动位置，但不要超过文档高度
      const scrollTarget = Math.min(
        scrollPosition + scrollStep,
        document.body.scrollHeight - viewportHeight * 0.2 // 留出一点底部空间以触发加载
      );

      // 执行滚动
      window.scrollTo({
        top: scrollTarget,
        behavior: "smooth",
      });

      // 等待页面响应和加载，增加随机等待时间
      const waitTime = 5000 + Math.random() * 2000; // 5-7秒随机等待
      await new Promise((resolve) => setTimeout(resolve, waitTime));

      // 更新当前高度
      currentHeight = document.body.scrollHeight;

      // 检查页面内容是否有变化并收集URL
      const html = document.documentElement.innerHTML;
      const regex = /\/[^\/]+\/project\/[^\/"]+/g;
      let match;
      const currentProducts = [];

      while ((match = regex.exec(html)) !== null) {
        const productId = match[0];

        // 收集产品ID
        if (!currentProducts.includes(productId)) {
          currentProducts.push(productId);
        }

        // 同时收集URL
        const url = `https://peerlist.io/${productId}`;
        if (!urls.includes(url)) {
          urls.push(url);
        }
      }

      // 检查高度和产品数量是否变化
      if (
        previousHeight === currentHeight &&
        previousProductCount === currentProducts.length
      ) {
        noChangeCount++;
        console.log(
          `No changes detected ${noChangeCount}/${maxNoChangeCount} times (height: ${currentHeight}, products: ${currentProducts.length})`
        );
      } else {
        noChangeCount = 0; // 重置计数器
        previousProductCount = currentProducts.length;
      }

      console.log(
        `Scrolling attempt ${pageCount}/${maxScrollAttempts}, position: ${Math.round(
          window.scrollY
        )}/${document.body.scrollHeight}, collecting URLs... length: ${
          urls.length
        }`
      );
    }

    console.log(`Scrolling completed. Total URLs collected: ${urls.length}`);

    // 添加一个小延迟，确保最后的日志能够显示
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // 打开收集到的所有URL
    for (const url of urls) {
      await sendMessage(Message.OPEN_TAB, `${url}`);
      await new Promise((resolve) => setTimeout(resolve, 3000));
    }

    console.log(`All ${urls.length} tabs have been opened.`);
  },
});
