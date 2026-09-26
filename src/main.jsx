import "./main.css";

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { ProjectStatusCard } from "./components/ProjectStatusCard.jsx";
import { useMcpBridge } from "./mcp/useMcpBridge.js";
import { AppRenderer } from "./runtime/AppRenderer.jsx";

function LoadingCard() {
  return (
    <article className="w-full max-w-md rounded-2xl border border-default bg-surface p-4 shadow-sm">
      <p className="text-xs text-secondary">ERP UI Runtime</p>
      <h2 className="mt-1 heading-lg">等待工具資料…</h2>
    </article>
  );
}

function App() {
  const bridge = useMcpBridge();

  if (bridge.workspaceView) {
    return <AppRenderer {...bridge} />;
  }

  if (bridge.project) {
    return (
      <ProjectStatusCard
        project={bridge.project}
        activeAction={bridge.activeAction}
        bridgeError={bridge.bridgeError}
        callTool={bridge.callTool}
      />
    );
  }

  return <LoadingCard />;
}

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
