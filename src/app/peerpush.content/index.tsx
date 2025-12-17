import { defineContentScript } from "#imports";

import "~/assets/styles/globals.css";
import {} from "@/lib/messaging";
import { isPurchasedOrTrial, scraperEnabled } from "@/lib/utils";

export default defineContentScript({
  matches: ["https://peerpush.net/?view=live"],
  cssInjectionMode: "ui",
  runAt: "document_end",

  async main(ctx) {
    console.log("Content script is running on peerpush.");
    if (!(await scraperEnabled())) {
      return;
    }
    if (!(await isPurchasedOrTrial())) {
      return;
    }
    const imgElements = [];
    const pageCount = 0;
    const previousHeight = 0;
    const currentHeight = document.body.scrollHeight;
    const noChangeCount = 0;
    const maxNoChangeCount = 5; // 增加到5次，给更多机会确认是否真的加载完毕
    const maxScrollAttempts = 80; // 设置最大滚动尝试次数，防止无限循环

    // 记录已经看到的产品数量，用于检测是否有新内容
    const previousProductCount = 0;

    // 创建持续显示的状态面板
    let statusPanel = null;
    const statusPanelId = "peerpush-status-panel-" + Date.now();

    const createStatusPanel = () => {
      // 检查是否已存在且在 DOM 中
      if (
        statusPanel &&
        statusPanel.parentNode &&
        document.body.contains(statusPanel)
      ) {
        return statusPanel;
      }

      // 移除可能存在的旧面板
      const existingPanel = document.getElementById(statusPanelId);
      if (existingPanel) {
        existingPanel.remove();
      }

      const panel = document.createElement("div");
      statusPanel = panel;
      panel.id = statusPanelId; // 设置唯一 ID
      panel.style.cssText = `
        position: fixed !important;
        top: 20px !important;
        right: 20px !important;
        background: rgba(0, 0, 0, 0.85) !important;
        color: white !important;
        padding: 20px !important;
        border-radius: 12px !important;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;
        font-size: 14px !important;
        z-index: 999999 !important;
        box-shadow: 0 4px 20px rgba(0,0,0,0.3) !important;
        min-width: 280px !important;
        line-height: 1.4 !important;
        border-left: 4px solid #4CAF50 !important;
        pointer-events: none !important;
        user-select: none !important;
      `;

      // 强制添加到 document.body
      const addToBody = () => {
        if (document.body) {
          document.body.appendChild(panel);
          console.log(
            "Status panel created and attached to body with ID:",
            statusPanelId
          );

          // 添加一个 MutationObserver 来监控面板是否被意外移除
          const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
              if (mutation.type === "childList") {
                mutation.removedNodes.forEach((removedNode) => {
                  if (removedNode === panel) {
                    console.log("Panel was removed, re-adding...");
                    setTimeout(() => {
                      if (document.body && !document.body.contains(panel)) {
                        document.body.appendChild(panel);
                      }
                    }, 100);
                  }
                });
              }
            });
          });

          observer.observe(document.body, { childList: true, subtree: true });
        } else {
          // 如果 body 还没准备好，等待一下再试
          setTimeout(addToBody, 100);
        }
      };

      addToBody();
      return panel;
    };

    const updateStatus = (status, itemCount, scrollProgress, extra = "") => {
      // 总是重新创建面板以确保显示
      const panel = createStatusPanel();

      // 再次确认面板在 DOM 中
      setTimeout(() => {
        if (!document.body.contains(panel)) {
          console.log(
            "Panel still not in DOM after creation, forcing re-add..."
          );
          document.body.appendChild(panel);
        }
      }, 50);

      const statusColors = {
        running: "#4CAF50",
        paused: "#ff6b6b",
        completed: "#2196F3",
        error: "#f44336",
      };

      const statusIcons = {
        running: "🔄",
        paused: "⏸️",
        completed: "✅",
        error: "❌",
      };

      const borderColor = statusColors[status] || "#4CAF50";
      const icon = statusIcons[status] || "🔄";

      panel.style.borderLeftColor = borderColor + " !important";
      panel.innerHTML = `
        <div style="display: flex; align-items: center; margin-bottom: 12px;">
          <span style="font-size: 24px; margin-right: 10px;">${icon}</span>
          <strong style="font-size: 16px; color: ${borderColor};">
            ${
              status === "running"
                ? "Scrolling"
                : status === "paused"
                ? "Paused"
                : status === "completed"
                ? "Completed"
                : "Error"
            }
          </strong>
        </div>
        <div style="font-size: 13px; color: #ccc; line-height: 1.6;">
          <div>📦 Collected: <strong style="color: white; font-size: 15px;">${itemCount}</strong> projects</div>
          <div>📊 Progress: <strong style="color: white;">${scrollProgress}</strong></div>
          ${
            extra
              ? `<div style="margin-top: 8px; padding-top: 8px; border-top: 1px solid #444;">${extra}</div>`
              : ""
          }
        </div>
      `;

      console.log(
        `Status updated: ${status}, items: ${itemCount}, progress: ${scrollProgress}`
      );
    };

    const removeStatusPanel = () => {
      if (statusPanel && statusPanel.parentNode) {
        statusPanel.parentNode.removeChild(statusPanel);
        statusPanel = null;
        console.log("Status panel removed");
      }
    };

    // 初始化状态面板
    updateStatus("running", 0, "0%", "Starting scroll task...");

    // 检查页面可见性并提醒
    const checkVisibility = () => {
      if (document.hidden) {
        updateStatus(
          "paused",
          urls.length,
          `${Math.round((pageCount / maxScrollAttempts) * 100)}%`,
          "⚠️ Keep this tab in foreground<br>Will resume automatically when you return"
        );
        return false;
      }
      return true;
    };

    // 检查页面是否在前台
    if (!checkVisibility()) {
      console.log("Page is in background, pausing scrolling");
      // 等待页面重新可见，但不增加 pageCount
      while (document.hidden) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
      console.log("Page is now visible, resuming scrolling");
      updateStatus(
        "running",
        urls.length,
        `${Math.round((pageCount / maxScrollAttempts) * 100)}%`,
        "✨ Resuming scroll..."
      );
    }

    await new Promise((resolve) => setTimeout(resolve, 5000));
    // 检查页面内容是否有变化并收集img元素
    const launchesElement = document.getElementById("launches");
    if (launchesElement) {
      // 找到launches元素下的所有img标签
      const foundImgs = launchesElement.querySelectorAll("img");
      for (const img of foundImgs) {
        if (!imgElements.includes(img)) {
          imgElements.push(img);
        }
      }
    }

    // 更新状态面板
    updateStatus(
      "running",
      imgElements.length,
      `${Math.round((pageCount / maxScrollAttempts) * 100)}%`,
      `📍 Position: ${Math.round(window.scrollY)}/${
        document.body.scrollHeight
      }px`
    );

    console.log(
      `Scrolling completed. Total img elements collected: ${imgElements.length}`
    );

    // 更新为完成状态
    updateStatus(
      "completed",
      imgElements.length,
      "100%",
      `🎉 Scroll completed!<br>Preparing to click ${imgElements.length} images...`
    );

    await new Promise((resolve) => setTimeout(resolve, 1000));

    let clickedCount = 0;
    for (const img of imgElements) {
      try {
        // 检查img元素的详细信息
        const rect = img.getBoundingClientRect();
        const style = window.getComputedStyle(img);
        const parentElement = img.parentElement;
        const parentStyle = parentElement ? window.getComputedStyle(parentElement) : null;
        
        console.log(`Img element ${clickedCount + 1}:`, {
          src: img.src.substring(0, 100) + "...",
          alt: img.alt,
          className: img.className,
          parentElement:
            parentElement?.tagName +
            (parentElement?.className
              ? "." + parentElement.className
              : ""),
          parentHasOnclick: !!parentElement?.onclick,
          parentHref: parentElement?.href,
          parentDataset: parentElement?.dataset,
          parentIsClickable: parentStyle ? parentStyle.pointerEvents !== "none" : false,
          parentCursor: parentStyle?.cursor,
          isVisible: style.visibility !== "hidden" && style.display !== "none",
          isClickable: style.pointerEvents !== "none",
          hasHref: !!img.href,
          hasOnclick: !!img.onclick,
          hasDataAttributes: Object.keys(img.dataset).length > 0,
          dataset: img.dataset,
          position: {
            top: Math.round(rect.top),
            left: Math.round(rect.left),
            width: Math.round(rect.width),
            height: Math.round(rect.height),
          },
          zIndex: style.zIndex,
        });

        // 找到真正可点击的目标元素
        const findClickableTarget = () => {
          // 检查所有可能的父级元素（向上查找3层）
          let currentElement = img;
          for (let i = 0; i < 3; i++) {
            if (currentElement.parentElement) {
              currentElement = currentElement.parentElement;
              // 检查是否有href
              if (currentElement.href) {
                console.log(`Found parent with href at level ${i + 1}:`, currentElement.href);
                return currentElement;
              }
              // 检查是否有onclick
              if (currentElement.onclick || currentElement.getAttribute('onclick')) {
                console.log(`Found parent with onclick at level ${i + 1}`);
                return currentElement;
              }
              // 检查常见的点击类名
              const className = currentElement.className || '';
              if (className.includes('click') || className.includes('link') || className.includes('button')) {
                console.log(`Found parent with clickable class at level ${i + 1}:`, className);
                return currentElement;
              }
              // 检查data属性
              if (currentElement.dataset.href || currentElement.dataset.link || currentElement.dataset.url) {
                const dataUrl = currentElement.dataset.href || currentElement.dataset.link || currentElement.dataset.url;
                console.log(`Found parent with data URL at level ${i + 1}:`, dataUrl);
                return currentElement;
              }
            }
          }
          
          // 检查img本身
          if (img.onclick || img.href || img.getAttribute('onclick')) {
            console.log("Img is clickable");
            return img;
          }
          
          // 在img中心位置找到最顶层的元素
          const centerX = rect.left + rect.width / 2;
          const centerY = rect.top + rect.height / 2;
          const elementAtPoint = document.elementFromPoint(centerX, centerY);
          console.log("Element at click point:", elementAtPoint?.tagName, elementAtPoint?.className, elementAtPoint?.href);
          
          return elementAtPoint || currentElement || img;
        };

        const clickableTarget = findClickableTarget();

        // 尝试多种点击方式
        const clickMethods = [
          // 1. 在目标元素上先hover再点击
          async () => {
            const targetRect = clickableTarget.getBoundingClientRect();
            const centerX = targetRect.left + targetRect.width / 2;
            const centerY = targetRect.top + targetRect.height / 2;
            
            console.log("Method 1: Hover + click on target:", clickableTarget.tagName, clickableTarget.href || clickableTarget.className);
            
            // 先触发完整的hover事件序列
            const hoverEvents = ['mouseover', 'mouseenter', 'mousemove'];
            for (const eventType of hoverEvents) {
              const event = new MouseEvent(eventType, {
                view: window,
                bubbles: true,
                cancelable: true,
                clientX: centerX,
                clientY: centerY,
                relatedTarget: document.body,
              });
              clickableTarget.dispatchEvent(event);
              await new Promise(resolve => setTimeout(resolve, 50));
            }
            
            // 等待hover效果完全生效
            await new Promise(resolve => setTimeout(resolve, 300));
            
            // 然后触发完整的点击事件序列
            const clickEvents = ['mousedown', 'mouseup', 'click'];
            for (const eventType of clickEvents) {
              const event = new MouseEvent(eventType, {
                view: window,
                bubbles: true,
                cancelable: true,
                clientX: centerX,
                clientY: centerY,
                button: 0,
                buttons: eventType === 'mousedown' ? 1 : 0,
              });
              clickableTarget.dispatchEvent(event);
              await new Promise(resolve => setTimeout(resolve, 50));
            }
          },

          // 2. 直接调用click方法（对href元素最有效）
          () => {
            console.log("Method 2: Direct click() call on:", clickableTarget.tagName, clickableTarget.href);
            clickableTarget.click();
          },

          // 3. 模拟用户真实点击行为
          async () => {
            console.log("Method 3: Simulating real user click");
            const targetRect = clickableTarget.getBoundingClientRect();
            const centerX = targetRect.left + targetRect.width / 2;
            const centerY = targetRect.top + targetRect.height / 2;
            
            // 先hover
            clickableTarget.dispatchEvent(new MouseEvent('mouseover', {
              view: window,
              bubbles: true,
              cancelable: true,
              clientX: centerX,
              clientY: centerY,
            }));
            
            await new Promise(resolve => setTimeout(resolve, 200));
            
            // 再点击
            clickableTarget.dispatchEvent(new MouseEvent('click', {
              view: window,
              bubbles: true,
              cancelable: true,
              clientX: centerX,
              clientY: centerY,
            }));
          },

          // 4. 强制打开href链接
          () => {
            if (clickableTarget.href) {
              console.log("Method 4: Force opening href:", clickableTarget.href);
              window.open(clickableTarget.href, '_blank');
            } else {
              console.log("Method 4: No href found");
            }
          },

          // 5. 检查并点击data-url或data-href
          () => {
            if (clickableTarget.dataset.href || clickableTarget.dataset.url || clickableTarget.dataset.link) {
              const url = clickableTarget.dataset.href || clickableTarget.dataset.url || clickableTarget.dataset.link;
              console.log("Method 5: Opening data URL:", url);
              window.open(url, '_blank');
            } else {
              console.log("Method 5: No data URL found");
            }
          },

          // 6. 尝试父元素的data属性
          () => {
            if (parentElement && (parentElement.dataset.href || parentElement.dataset.url || parentElement.dataset.link)) {
              const url = parentElement.dataset.href || parentElement.dataset.url || parentElement.dataset.link;
              console.log("Method 6: Opening parent data URL:", url);
              window.open(url, '_blank');
            } else {
              console.log("Method 6: No parent data URL found");
            }
          },

          // 7. 强制触发所有可能的点击事件
          () => {
            console.log("Method 7: Triggering all click events");
            const allEvents = ['click', 'dblclick', 'contextmenu'];
            allEvents.forEach(eventType => {
              clickableTarget.dispatchEvent(new Event(eventType, { bubbles: true, cancelable: true }));
            });
          },

          // 8. 绕过事件阻止，直接强制执行点击
          () => {
            console.log("Method 8: Force click bypassing preventDefault");
            
            // 创建一个不会被阻止的点击事件
            const forceClick = (element) => {
              const rect = element.getBoundingClientRect();
              const clickEvent = new MouseEvent('click', {
                view: window,
                bubbles: true,
                cancelable: false, // 关键：设置为不可取消
                clientX: rect.left + rect.width / 2,
                clientY: rect.top + rect.height / 2,
              });
              
              // 在元素上直接触发，不允许被阻止
              try {
                element.dispatchEvent(clickEvent);
              } catch (e) {
                console.log("Direct dispatch failed, trying alternative");
              }
              
              // 如果元素有onclick函数，直接调用
              if (element.onclick) {
                try {
                  element.onclick.call(element, clickEvent);
                } catch (e) {
                  console.log("Onclick execution failed:", e);
                }
              }
              
              // 如果有href属性，直接打开
              if (element.href) {
                console.log("Opening href directly");
                window.open(element.href, '_blank');
                return true;
              }
              
              return false;
            };
            
            // 尝试在多个元素上强制点击
            const elementsToTry = [clickableTarget, parentElement, img];
            for (const elem of elementsToTry) {
              if (elem && forceClick(elem)) {
                break;
              }
            }
          },

          // 9. 在父元素上尝试点击
          async () => {
            if (parentElement && parentElement !== clickableTarget) {
              console.log("Method 9: Trying parent element");
              parentElement.click();
              await new Promise(resolve => setTimeout(resolve, 500));
            }
          },
        ];

        let clickSuccess = false;
        const originalWindowCount = window.length;

        for (const [index, method] of clickMethods.entries()) {
          try {
            console.log(`Trying click method ${index + 1}`);

            await method();

            // 等待页面响应
            await new Promise((resolve) => setTimeout(resolve, 1000));

            // 多种方式检测点击是否成功
            const newWindowCount = window.length;
            const hasNewWindow = newWindowCount > originalWindowCount;
            const wasPrevented = clickableTarget.onclick === null;
            const targetHref = clickableTarget.href;
            const targetDataHref = clickableTarget.dataset.href || clickableTarget.dataset.url || clickableTarget.dataset.link;
            
            console.log(`Click method ${index + 1} results:`, {
              newWindowCount: `${originalWindowCount} -> ${newWindowCount}`,
              hasNewWindow,
              targetHref,
              targetDataHref,
              wasPrevented
            });

            // 如果有新窗口打开，说明点击成功
            if (hasNewWindow) {
              clickSuccess = true;
              console.log(`Click method ${index + 1} SUCCESS: New window opened`);
              break;
            }
            
            // 如果是方法4、5、6、8（强制打开URL）并且有新窗口或数据URL，也认为成功
            if ((index === 4 || index === 5 || index === 6 || index === 8) && (targetHref || targetDataHref)) {
              clickSuccess = true;
              console.log(`Click method ${index + 1} SUCCESS: Force opened URL`);
              break;
            }

            console.log(`Click method ${index + 1} executed but no new window detected`);
          } catch (methodError) {
            console.warn(`Click method ${index + 1} failed:`, methodError);
          }
        }

        if (!clickSuccess) {
          console.warn(`All click methods failed for img ${clickedCount + 1}`);
        }

        clickedCount++;
        console.log(`Processed img element ${clickedCount}:`, img);

        // 更新状态，显示正在点击的img数量
        updateStatus(
          "running",
          imgElements.length,
          "100%",
          `🔄 Processing images...<br>🖱️ Processed: <strong style="color: #4CAF50;">${clickedCount}</strong> / ${imgElements.length}`
        );

        await new Promise((resolve) => setTimeout(resolve, 3000));
      } catch (error) {
        console.error("Error processing img element:", error);
      }
    }

    console.log(`All ${imgElements.length} img elements have been clicked.`);

    // 最后更新状态
    updateStatus(
      "completed",
      imgElements.length,
      "100%",
      `🎉 Task completed!<br>🖱️ Clicked ${clickedCount} images`
    );

    // 5秒后移除状态面板
    /*     setTimeout(() => {
      removeStatusPanel();
    }, 5000); */
  },
});
