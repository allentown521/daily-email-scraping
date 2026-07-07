import tailwindcss from "@tailwindcss/vite";
import svgr from "vite-plugin-svgr";
import { type WxtViteConfig, defineConfig } from "wxt";

export default defineConfig({
  manifest: {
    name: "__MSG_extensionName__",
    description: "__MSG_extensionDescription__",
    default_locale: "en",
    host_permissions: ["<all_urls>"],
    permissions: [
      "storage",
      "sidePanel",
      "tabs",
      "alarms",
      "notifications",
      "scripting",
    ],
    side_panel: {
      default_path: "sidepanel.html",
    },
  },
  srcDir: "src",
  entrypointsDir: "app",
  outDir: "build",
  modules: ["@wxt-dev/module-react", "@wxt-dev/auto-icons"],
  imports: false,
  vite: () =>
    ({
      plugins: [svgr(), tailwindcss()],
    }) as WxtViteConfig,
});
