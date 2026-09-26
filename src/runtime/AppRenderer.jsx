import { CollectionWorkspace } from "./CollectionWorkspace.jsx";
import { TreeDetail } from "./TreeDetail.jsx";

function UnsupportedRenderer({ renderer }) {
  return (
    <article className="w-full max-w-lg rounded-2xl border border-default bg-surface p-4 shadow-sm">
      <p className="text-xs text-secondary">ERP UI Runtime</p>
      <h2 className="mt-1 heading-lg">尚未支援的 Renderer</h2>
      <p className="mt-2 text-sm text-secondary">{renderer ?? "unknown"}</p>
    </article>
  );
}

function renderDetail(view, options = {}) {
  const renderer = view?.presentation?.renderer;

  if (renderer === "tree-detail") {
    return <TreeDetail view={view} onBack={options.onBack} />;
  }

  return <UnsupportedRenderer renderer={renderer} />;
}

export function AppRenderer({
  workspaceView,
  detailView,
  clearDetail,
  activeAction,
  bridgeError,
  callTool,
  displayMode,
  safeAreaInsets,
  requestFullscreen,
}) {
  const renderer = workspaceView?.presentation?.renderer;

  if (renderer === "collection-workspace") {
    return (
      <CollectionWorkspace
        view={workspaceView}
        detailView={detailView}
        clearDetail={clearDetail}
        renderDetail={renderDetail}
        activeAction={activeAction}
        bridgeError={bridgeError}
        callTool={callTool}
        displayMode={displayMode}
        safeAreaInsets={safeAreaInsets}
        requestFullscreen={requestFullscreen}
      />
    );
  }

  return <UnsupportedRenderer renderer={renderer} />;
}
