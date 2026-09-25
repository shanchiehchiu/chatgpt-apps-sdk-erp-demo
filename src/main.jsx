import "./main.css";

import { Badge } from "@openai/apps-sdk-ui/components/Badge";
import { Button } from "@openai/apps-sdk-ui/components/Button";
import { ChevronRightMd } from "@openai/apps-sdk-ui/components/Icon";
import {
  StrictMode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createRoot } from "react-dom/client";

function normalizeSafeArea(value) {
  const source = value?.insets ?? value ?? {};

  return {
    top: Number(source.top ?? 0),
    right: Number(source.right ?? 0),
    bottom: Number(source.bottom ?? 0),
    left: Number(source.left ?? 0),
  };
}

function useMcpBridge() {
  const [project, setProject] = useState(null);
  const [erpCandidates, setErpCandidates] = useState(null);
  const [erpPreview, setErpPreview] = useState(null);
  const [activeAction, setActiveAction] = useState(null);
  const [bridgeError, setBridgeError] = useState(null);
  const [displayMode, setDisplayMode] = useState(
    typeof window !== "undefined" ? window.openai?.displayMode ?? "inline" : "inline",
  );
  const [safeAreaInsets, setSafeAreaInsets] = useState(() =>
    normalizeSafeArea(
      typeof window !== "undefined" ? window.openai?.safeArea : null,
    ),
  );
  const pending = useRef(new Map());
  const rpcId = useRef(0);
  const initialized = useRef(null);

  const applyResult = useCallback((result) => {
    const structured = result?.structuredContent ?? result ?? {};
    const metadata =
      result?._meta ??
      result?.mcp_tool_result?._meta ??
      result?.call_tool_result?._meta ??
      {};

    if (structured.project) {
      setProject(structured.project);
    }

    const nextCandidates =
      metadata.erpCandidates ?? structured.erpCandidates ?? null;
    if (nextCandidates) {
      setErpCandidates(nextCandidates);
      setErpPreview(null);
    }

    const nextPreview = metadata.erpPreview ?? structured.erpPreview ?? null;
    if (nextPreview) {
      setErpPreview(nextPreview);
    }
  }, []);

  useEffect(() => {
    const onMessage = (event) => {
      if (event.source !== window.parent) return;
      const message = event.data;
      if (!message || message.jsonrpc !== "2.0") return;

      if (typeof message.id === "number") {
        const waiter = pending.current.get(message.id);
        if (!waiter) return;
        pending.current.delete(message.id);
        if (message.error) waiter.reject(message.error);
        else waiter.resolve(message.result);
        return;
      }

      if (message.method === "ui/notifications/tool-result") {
        applyResult(message.params);
      }

      if (message.method === "ui/notifications/host-context-changed") {
        const nextMode = message.params?.displayMode;
        if (nextMode) setDisplayMode(nextMode);

        if (message.params?.safeAreaInsets) {
          setSafeAreaInsets(normalizeSafeArea(message.params.safeAreaInsets));
        }
      }
    };

    const onGlobals = (event) => {
      const nextMode = event?.detail?.globals?.displayMode;
      if (nextMode) setDisplayMode(nextMode);

      const nextSafeArea = event?.detail?.globals?.safeArea;
      if (nextSafeArea) {
        setSafeAreaInsets(normalizeSafeArea(nextSafeArea));
      }
    };

    window.addEventListener("message", onMessage, { passive: true });
    window.addEventListener("openai:set_globals", onGlobals, { passive: true });

    return () => {
      window.removeEventListener("message", onMessage);
      window.removeEventListener("openai:set_globals", onGlobals);
    };
  }, [applyResult]);

  const request = useCallback((method, params) => {
    return new Promise((resolve, reject) => {
      const id = ++rpcId.current;
      pending.current.set(id, { resolve, reject });
      window.parent.postMessage({ jsonrpc: "2.0", id, method, params }, "*");
    });
  }, []);

  const ensureInitialized = useCallback(() => {
    if (!initialized.current) {
      initialized.current = (async () => {
        const result = await request("ui/initialize", {
          appInfo: { name: "erp-production-demo-widget", version: "0.1.0" },
          appCapabilities: {
            availableDisplayModes: ["inline", "fullscreen"],
          },
          protocolVersion: "2026-01-26",
        });

        const initialMode = result?.hostContext?.displayMode;
        if (initialMode) setDisplayMode(initialMode);

        if (result?.hostContext?.safeAreaInsets) {
          setSafeAreaInsets(
            normalizeSafeArea(result.hostContext.safeAreaInsets),
          );
        }

        window.parent.postMessage(
          {
            jsonrpc: "2.0",
            method: "ui/notifications/initialized",
            params: {},
          },
          "*",
        );
      })();
    }

    return initialized.current;
  }, [request]);

  useEffect(() => {
    ensureInitialized().catch((error) => {
      setBridgeError(error?.message || "Widget bridge unavailable");
    });
  }, [ensureInitialized]);

  const callTool = useCallback(
    async (name, args = {}) => {
      setActiveAction(name);
      setBridgeError(null);

      try {
        await ensureInitialized();
        const result = await request("tools/call", {
          name,
          arguments: args,
        });
        applyResult(result);
        return result;
      } catch (error) {
        console.error(error);
        setBridgeError(error?.message || "Tool call failed");
        return null;
      } finally {
        setActiveAction(null);
      }
    },
    [applyResult, ensureInitialized, request],
  );

  const requestFullscreen = useCallback(async () => {
    setBridgeError(null);

    try {
      await ensureInitialized();
      await request("ui/request-display-mode", { mode: "fullscreen" });
      setDisplayMode("fullscreen");
      return;
    } catch (error) {
      if (window.openai?.requestDisplayMode) {
        try {
          await window.openai.requestDisplayMode({ mode: "fullscreen" });
          setDisplayMode("fullscreen");
          return;
        } catch (fallbackError) {
          console.error(fallbackError);
        }
      }

      console.error(error);
      setBridgeError("無法開啟全螢幕工作台");
    }
  }, [ensureInitialized, request]);

  return {
    project,
    erpCandidates,
    erpPreview,
    setErpPreview,
    activeAction,
    bridgeError,
    callTool,
    displayMode,
    safeAreaInsets,
    requestFullscreen,
  };
}

function ProjectStatusCard({ project, activeAction, bridgeError, callTool }) {
  const totalChanges =
    (project?.modified ?? 0) + (project?.added ?? 0) + (project?.deleted ?? 0);

  return (
    <article className="w-full max-w-sm overflow-hidden rounded-2xl border border-default bg-surface shadow-sm">
      <div className="p-3.5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs text-secondary">Project status</p>
            <h2 className="mt-0.5 truncate heading-lg">
              {project?.name ?? "ERP Apps SDK Demo"}
            </h2>
          </div>
          <Badge color={bridgeError ? "danger" : "success"} size="sm">
            {bridgeError ? "Unavailable" : "Connected"}
          </Badge>
        </div>

        <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-3 gap-y-2.5 text-sm">
          <dt className="self-center font-medium text-secondary">Branch</dt>
          <dd className="text-right">
            <Badge color="secondary" variant="soft" size="sm">
              <code className="font-mono">{project?.branch ?? "—"}</code>
            </Badge>
          </dd>
          <dt className="font-medium text-secondary">Working tree</dt>
          <dd className="text-right">
            <div className="font-semibold">{totalChanges} changes</div>
            <div className="text-xs text-secondary">
              {project?.modified ?? 0} modified · {project?.added ?? 0} added
            </div>
          </dd>
          <dt className="self-center font-medium text-secondary">Round trip</dt>
          <dd className="flex items-center justify-end gap-2">
            <span className="text-xs text-secondary">
              {project?.interactionCount ?? 0} completed
            </span>
            <Button
              variant="soft"
              color="secondary"
              size="sm"
              disabled={activeAction === "run_round_trip"}
              onClick={() => callTool("run_round_trip")}
            >
              {activeAction === "run_round_trip" ? "Testing…" : "Test +1"}
            </Button>
          </dd>
        </dl>
      </div>
    </article>
  );
}

function BrandLockup({ compact = false }) {
  return (
    <div className="flex items-center gap-2.5">
      <div className="erp-brand-mark" aria-hidden="true">E</div>
      <div className="min-w-0">
        <div className="text-xs font-semibold">範例 ERP</div>
        {!compact ? (
          <div className="text-[11px] text-secondary">生產管理</div>
        ) : null}
      </div>
    </div>
  );
}

function InlineCandidate({ item }) {
  return (
    <div className="flex items-center gap-3 py-2.5">
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-semibold">{item.product_name}</div>
        <div className="mt-0.5 truncate text-xs text-secondary">
          {item.customer_name} · {item.delivery_date || "未設定送貨日"}
        </div>
      </div>
      <span className="shrink-0 text-sm font-semibold tabular-nums">
        ×{item.count}
      </span>
    </div>
  );
}

function ErpInlineSummary({ data, bridgeError, requestFullscreen }) {
  const previewItems = data.items.slice(0, 3);
  const remaining = Math.max(0, data.count - previewItems.length);

  return (
    <article className="w-full max-w-xl overflow-hidden rounded-xl bg-surface ring-1 ring-subtle shadow-sm">
      <header className="border-b border-subtle px-4 py-3.5">
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <BrandLockup compact />
            <div className="h-6 w-px bg-black/10 dark:bg-white/10" aria-hidden="true" />
            <h2 className="truncate text-base font-semibold">待轉生產工單</h2>
          </div>

          <Badge color="secondary" variant="soft" size="sm">
            {data.count} 筆待處理
          </Badge>
        </div>
      </header>

      <div className="erp-divider-list px-4">
        {previewItems.map((item) => (
          <InlineCandidate key={item.id} item={item} />
        ))}
      </div>

      {bridgeError ? (
        <div className="px-4 pt-2 text-xs text-danger">{bridgeError}</div>
      ) : null}

      <footer className="flex items-center justify-between gap-3 border-t border-subtle px-4 py-3">
        <span className="text-xs text-secondary">
          {remaining > 0 ? `另有 ${remaining} 筆 · ` : ""}唯讀預覽
        </span>

        <Button
          variant="solid"
          color="primary"
          size="md"
          pill={false}
          className="erp-brand-primary"
          onClick={requestFullscreen}
        >
          開啟工作台
          <ChevronRightMd />
        </Button>
      </footer>
    </article>
  );
}

function CandidateRow({ item, checked, onToggle }) {
  return (
    <label
      className={[
        "group grid cursor-pointer grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-3 rounded-xl px-3 py-2.5 transition",
        checked
          ? "erp-selected-row"
          : "hover:bg-secondary/35",
      ].join(" ")}
    >
      <input
        type="checkbox"
        className="mt-1 h-4 w-4 shrink-0"
        checked={checked}
        onChange={() => onToggle(item.id)}
      />

      <div className="min-w-0">
        <div className="truncate text-sm font-semibold">{item.product_name}</div>
        <div className="mt-0.5 truncate text-xs text-secondary">
          {item.order_no} · {item.customer_name}
        </div>
        <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-secondary">
          <span>{item.delivery_date || "未設定送貨日"}</span>
          <span>·</span>
          <span>{item.delivery_time}</span>
          <span className="truncate opacity-70">{item.product_serial}</span>
        </div>
      </div>

      <div className="pt-0.5 text-right">
        <div className="text-sm font-semibold">{item.count}</div>
        <div className="text-[11px] text-secondary">數量</div>
      </div>
    </label>
  );
}

function buildDepthMap(orders) {
  const byNo = new Map(orders.map((order) => [order.no, order]));
  const memo = new Map();

  const resolve = (order, guard = 0) => {
    if (!order?.no || guard > 20) return 0;
    if (memo.has(order.no)) return memo.get(order.no);

    let depth = 0;
    if (order.parent_no && byNo.has(order.parent_no)) {
      depth = resolve(byNo.get(order.parent_no), guard + 1) + 1;
    }

    memo.set(order.no, depth);
    return depth;
  };

  orders.forEach((order) => resolve(order));
  return memo;
}

function WorkOrderRow({
  order,
  depth,
  isTopLevel,
  expanded,
  onToggle,
}) {
  return (
    <div
      className="rounded-xl border border-subtle bg-surface p-3"
      style={{ marginLeft: Math.min(depth, 4) * 16 }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-1.5">
            {depth > 0 ? <span className="text-secondary">↳</span> : null}
            <span className="font-mono text-xs text-secondary">{order.no}</span>
            <Badge
              color={isTopLevel ? "success" : "secondary"}
              variant="soft"
              size="sm"
            >
              {isTopLevel ? "成品" : "半成品"}
            </Badge>
          </div>

          <div className="mt-1 text-sm font-semibold">{order.product_name}</div>
          <div className="mt-0.5 text-xs text-secondary">
            {order.product_serial} · 需求 {order.count}
            {order.delivery_date ? ` · ${order.delivery_date}` : ""}
          </div>
        </div>

        <Badge color="secondary" variant="outline" size="sm">
          {order.status_name}
        </Badge>
      </div>

      <div className="mt-2 flex items-center justify-between">
        <span className="text-xs text-secondary">
          直接用料 {order.materials.length} 項
        </span>
        <Button
          variant="ghost"
          color="secondary"
          size="sm"
          onClick={onToggle}
        >
          {expanded ? "收合" : "用料"}
        </Button>
      </div>

      {expanded ? (
        <div className="mt-2 overflow-hidden rounded-lg bg-secondary/40">
          {order.materials.length ? (
            order.materials.map((material) => (
              <div
                key={`${order.no}-${material.product_id}`}
                className="flex items-center justify-between gap-3 border-b border-subtle px-3 py-2 last:border-b-0"
              >
                <div className="min-w-0">
                  <div className="truncate text-xs font-medium">
                    {material.product_name}
                  </div>
                  <div className="truncate text-[11px] text-secondary">
                    {material.product_serial}
                  </div>
                </div>
                <div className="shrink-0 text-xs font-semibold">
                  {material.count}
                </div>
              </div>
            ))
          ) : (
            <div className="px-3 py-2 text-xs text-secondary">無直接用料</div>
          )}
        </div>
      ) : null}
    </div>
  );
}

function PreviewPanel({ data, onBack }) {
  const [expandedNos, setExpandedNos] = useState([]);
  const depths = useMemo(() => buildDepthMap(data.born_orders), [data.born_orders]);
  const topLevelIds = useMemo(
    () => new Set(data.top_level_products_id),
    [data.top_level_products_id],
  );

  const toggle = (no) => {
    setExpandedNos((current) =>
      current.includes(no)
        ? current.filter((value) => value !== no)
        : [...current, no],
    );
  };

  return (
    <section className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center justify-between gap-3 border-b border-subtle px-5 py-4">
        <div>
          <p className="text-xs font-medium text-secondary">預覽結果</p>
          <div className="mt-0.5 flex items-baseline gap-2">
            <h3 className="heading-lg">{data.work_order_count} 張生產工單</h3>
            <span className="text-xs text-secondary">
              由 {data.selected_item_ids.length} 筆訂購明細展開
            </span>
          </div>
        </div>
        <Badge color="success" variant="soft" size="sm">
          唯讀預覽
        </Badge>
      </div>

      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-4">
        {data.born_orders.map((order) => (
          <WorkOrderRow
            key={order.no}
            order={order}
            depth={depths.get(order.no) ?? 0}
            isTopLevel={topLevelIds.has(order.products_id)}
            expanded={expandedNos.includes(order.no)}
            onToggle={() => toggle(order.no)}
          />
        ))}
      </div>

      <div className="flex items-center justify-between border-t border-subtle px-5 py-3">
        <span className="text-xs text-secondary">
          不建立工單、不扣庫存
        </span>
        <Button variant="soft" color="secondary" size="sm" onClick={onBack}>
          返回選擇
        </Button>
      </div>
    </section>
  );
}

function EmptyPreview({ selectedCount }) {
  return (
    <div className="flex min-h-0 flex-1 items-center justify-center p-8">
      <div className="max-w-sm text-center">
        <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-2xl bg-secondary text-lg">
          ↳
        </div>
        <h3 className="mt-3 text-base font-semibold">預覽工單結構</h3>
        <p className="mt-1.5 text-sm text-secondary">
          {selectedCount > 0
            ? `已選 ${selectedCount} 筆訂購明細，按下預覽後會在這裡展開工單、半成品與直接用料。`
            : "先從左側選擇訂購明細，再預覽實際會產生的工單與 BOM 用料。"}
        </p>
      </div>
    </div>
  );
}

function ErpWorkspace({
  data,
  preview,
  setPreview,
  activeAction,
  bridgeError,
  callTool,
  safeAreaInsets,
}) {
  const [selectedIds, setSelectedIds] = useState([]);
  const [query, setQuery] = useState("");

  useEffect(() => {
    setSelectedIds((current) => {
      const validIds = new Set(data.items.map((item) => item.id));
      return current.filter((id) => validIds.has(id));
    });
  }, [data]);

  const visibleItems = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return data.items;

    return data.items.filter((item) =>
      [
        item.order_no,
        item.customer_name,
        item.product_name,
        item.product_serial,
      ]
        .join(" ")
        .toLowerCase()
        .includes(needle),
    );
  }, [data.items, query]);

  const allVisibleSelected =
    visibleItems.length > 0 &&
    visibleItems.every((item) => selectedIds.includes(item.id));

  const toggle = (id) => {
    setSelectedIds((current) =>
      current.includes(id)
        ? current.filter((value) => value !== id)
        : [...current, id],
    );
  };

  const toggleVisible = () => {
    const visibleIds = visibleItems.map((item) => item.id);

    setSelectedIds((current) => {
      if (allVisibleSelected) {
        return current.filter((id) => !visibleIds.includes(id));
      }

      return Array.from(new Set([...current, ...visibleIds]));
    });
  };

  const previewing = activeAction === "preview_production_orders";
  const reloading = activeAction === "get_production_candidates";
  const composerClearance = Math.max(
    124,
    (safeAreaInsets?.bottom ?? 0) + 24,
  );

  return (
    <main
      className="box-border flex min-h-[100dvh] flex-col bg-surface"
      style={{
        paddingTop: safeAreaInsets?.top ?? 0,
        paddingRight: safeAreaInsets?.right ?? 0,
        paddingBottom: composerClearance,
        paddingLeft: safeAreaInsets?.left ?? 0,
      }}
    >
      <header className="border-b border-subtle bg-surface px-6 py-4">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-4">
          <div className="flex min-w-0 items-center gap-4">
            <BrandLockup compact />
            <div className="h-8 w-px bg-black/10 dark:bg-white/10" aria-hidden="true" />
            <div className="min-w-0">
              <p className="text-xs font-medium text-secondary">生產管理</p>
              <h1 className="mt-0.5 truncate text-xl font-semibold tracking-tight">
                訂購轉生產工單
              </h1>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge color="secondary" variant="soft" size="sm">
              {data.count} 筆待處理
            </Badge>
            <Badge color="secondary" variant="outline" size="sm">
              唯讀預覽
            </Badge>
          </div>
        </div>
      </header>

      <div className="mx-auto flex min-h-0 w-full max-w-7xl flex-1 flex-col gap-0 lg:flex-row">
        <section className="flex min-h-0 w-full min-w-0 flex-col border-b border-subtle lg:w-[46%] lg:min-w-[420px] lg:border-b-0 lg:border-r">
          <div className="space-y-3 border-b border-subtle p-4">
            <div className="flex gap-2">
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="搜尋訂單、客戶、產品"
                className="min-w-0 flex-1 rounded-xl border border-default bg-surface px-3 py-2 text-sm outline-none transition focus:border-strong"
              />
              <Button
                variant="ghost"
                color="secondary"
                size="sm"
                disabled={reloading}
                onClick={() =>
                  callTool("get_production_candidates", { limit: 30 })
                }
              >
                {reloading ? "更新中…" : "重新整理"}
              </Button>
            </div>

            <div className="flex items-center justify-between text-xs text-secondary">
              <span>
                顯示 {visibleItems.length} 筆 · 已選 {selectedIds.length} 筆
              </span>
              <button
                type="button"
                className="font-medium hover:text-primary"
                onClick={toggleVisible}
              >
                {allVisibleSelected ? "清除目前選取" : "全選目前結果"}
              </button>
            </div>
          </div>

          <div className="min-h-0 flex-1 space-y-1 overflow-y-auto p-2">
            {visibleItems.length ? (
              visibleItems.map((item) => (
                <CandidateRow
                  key={item.id}
                  item={item}
                  checked={selectedIds.includes(item.id)}
                  onToggle={toggle}
                />
              ))
            ) : (
              <div className="px-4 py-12 text-center text-sm text-secondary">
                找不到符合條件的訂購明細
              </div>
            )}
          </div>

          {selectedIds.length > 0 ? (
            <div className="flex items-center justify-between gap-3 border-t border-subtle px-4 py-3">
              <div className="flex items-center gap-3">
                <div>
                  <div className="text-sm font-semibold">
                    {selectedIds.length} 筆已選
                  </div>
                  <div className="text-[11px] text-secondary">
                    預覽不會寫入 ERP
                  </div>
                </div>
                <button
                  type="button"
                  className="text-xs font-medium text-secondary hover:text-primary"
                  onClick={() => setSelectedIds([])}
                >
                  清除
                </button>
              </div>

              <Button
                variant="solid"
                color="primary"
                size="md"
                pill={false}
                className="erp-brand-primary"
                loading={previewing}
                onClick={() =>
                  callTool("preview_production_orders", { ids: selectedIds })
                }
              >
                預覽工單
                <ChevronRightMd />
              </Button>
            </div>
          ) : (
            <div className="border-t border-subtle px-4 py-3 text-xs text-secondary">
              選擇訂購明細後即可預覽工單與 BOM
            </div>
          )}
        </section>

        <section className="flex min-h-0 min-w-0 flex-1 flex-col">
          {preview ? (
            <PreviewPanel data={preview} onBack={() => setPreview(null)} />
          ) : (
            <EmptyPreview selectedCount={selectedIds.length} />
          )}

          {bridgeError ? (
            <div className="border-t border-subtle px-5 py-2 text-xs text-danger">
              {bridgeError}
            </div>
          ) : null}
        </section>
      </div>
    </main>
  );
}

function LoadingCard() {
  return (
    <article className="w-full max-w-md rounded-2xl border border-default bg-surface p-4 shadow-sm">
      <p className="text-xs text-secondary">ERP Apps SDK Demo</p>
      <h2 className="mt-1 heading-lg">等待工具資料…</h2>
    </article>
  );
}

function App() {
  const {
    project,
    erpCandidates,
    erpPreview,
    setErpPreview,
    activeAction,
    bridgeError,
    callTool,
    displayMode,
    safeAreaInsets,
    requestFullscreen,
  } = useMcpBridge();

  if (erpCandidates) {
    if (displayMode === "fullscreen") {
      return (
        <ErpWorkspace
          data={erpCandidates}
          preview={erpPreview}
          setPreview={setErpPreview}
          activeAction={activeAction}
          bridgeError={bridgeError}
          callTool={callTool}
          safeAreaInsets={safeAreaInsets}
        />
      );
    }

    return (
      <ErpInlineSummary
        data={erpCandidates}
        bridgeError={bridgeError}
        requestFullscreen={requestFullscreen}
      />
    );
  }

  if (project) {
    return (
      <ProjectStatusCard
        project={project}
        activeAction={activeAction}
        bridgeError={bridgeError}
        callTool={callTool}
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
