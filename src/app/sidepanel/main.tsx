import React from "react";
import ReactDOM from "react-dom/client";

import { Main } from "~/components/common/main";
import { Layout } from "~/components/layout/layout";

const SidePanel = () => {
  return (
    <Layout containerClassName="min-w-[56rem]">
      <Main className="w-full px-4" filename="app/sidepanel" />
    </Layout>
  );
};

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <SidePanel />
  </React.StrictMode>,
);
