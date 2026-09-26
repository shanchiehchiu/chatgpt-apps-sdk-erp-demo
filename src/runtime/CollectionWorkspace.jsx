import { Badge } from "@openai/apps-sdk-ui/components/Badge";
import { Button } from "@openai/apps-sdk-ui/components/Button";
import { ChevronRightMd } from "@openai/apps-sdk-ui/components/Icon";
import { useEffect, useMemo, useState } from "react";

import {
  fieldValue,
  getPath,
  interpolate,
  lineValue,
  resolveArgs,
} from "./value.js";

function BrandLockup({ brand, compact = false }) {
  if (!brand) return null;

  return (
    <div className="flex items-center gap-2.5">
      <div className="erp-brand-mark" aria-hidden="true">
        {brand.mark ?? "E"}
      </div>
      <div className="min-w-0">
        <div className="text-xs font-semibold">{brand.name}</div>
        {!compact && brand.section ? (
          <div className="text-[11px] text-secondary">{brand.section}</div>
        ) : null}
      </div>
    </div>
  );
}

function InlineRecord({ record, item }) {
  return (
    <div className="flex items-center gap-3 py-2.5">
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-semibold">
          {fieldValue(record, item.title)}
        </div>
        {item.subtitle ? (
          <div className="mt-0.5 truncate text-xs text-secondary">
            {lineValue(record, item.subtitle)}
          </div>
        ) : null}
      </div>

      {item.trailing ? (
        <span className="shrink-0 text-sm font-semibold tabular-nums">
          {fieldValue(record, item.trailing)}
        </span>
      ) : null}
    </div>
  );
}

function InlineSummary({
  view,
  bridgeError,
  requestFullscreen,
}) {
  const { presentation, data } = view;
  const inline = presentation.inline ?? {};
  const records = data.records ?? [];
  const previewRecords = records.slice(0, inline.limit ?? 3);
  const total = getPath(data, presentation.count?.path, records.length);
  const remaining = Math.max(0, total - previewRecords.length);

  return (
    <article className="w-full max-w-xl overflow-hidden rounded-xl bg-surface ring-1 ring-subtle shadow-sm">
      <header className="border-b border-subtle px-4 py-3.5">
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <BrandLockup brand={presentation.brand} compact />
            <div
              className="h-6 w-px bg-black/10 dark:bg-white/10"
              aria-hidden="true"
            />
            <h2 className="truncate text-base font-semibold">
              {inline.title ?? presentation.title}
            </h2>
          </div>

          <Badge color="secondary" variant="soft" size="sm">
            {total}
            {presentation.count?.suffix ?? ""}
          </Badge>
        </div>
      </header>

      <div className="erp-divider-list px-4">
        {previewRecords.map((record, index) => (
          <InlineRecord
            key={record?.[presentation.collection?.key] ?? index}
            record={record}
            item={inline.item ?? presentation.collection?.item ?? {}}
          />
        ))}
      </div>

      {bridgeError ? (
        <div className="px-4 pt-2 text-xs text-danger">{bridgeError}</div>
      ) : null}

      <footer className="flex items-center justify-between gap-3 border-t border-subtle px-4 py-3">
        <span className="text-xs text-secondary">
          {remaining > 0
            ? `${inline.remainingPrefix ?? "另有 "}${remaining}${inline.remainingSuffix ?? " 筆"} · `
            : ""}
          {presentation.statusText}
        </span>

        <Button
          variant="solid"
          color="primary"
          size="md"
          pill={false}
          className="erp-brand-primary"
          onClick={requestFullscreen}
        >
          {inline.openLabel ?? "開啟"}
          <ChevronRightMd />
        </Button>
      </footer>
    </article>
  );
}

function CollectionRecord({
  record,
  schema,
  checked,
  selectable,
  onToggle,
}) {
  const key = record?.[schema.key];
  const item = schema.item ?? {};

  const body = (
    <>
      {selectable ? (
        <input
          type="checkbox"
          className="mt-1 h-4 w-4 shrink-0"
          checked={checked}
          onChange={() => onToggle(key)}
        />
      ) : null}

      <div className="min-w-0">
        <div className="truncate text-sm font-semibold">
          {fieldValue(record, item.title)}
        </div>

        {item.subtitle ? (
          <div className="mt-0.5 truncate text-xs text-secondary">
            {lineValue(record, item.subtitle)}
          </div>
        ) : null}

        {item.meta ? (
          <div className="mt-1.5 truncate text-xs text-secondary">
            {lineValue(record, item.meta)}
          </div>
        ) : null}
      </div>

      {item.trailing ? (
        <div className="pt-0.5 text-right">
          <div className="text-sm font-semibold">
            {fieldValue(record, item.trailing)}
          </div>
          {item.trailing.label ? (
            <div className="text-[11px] text-secondary">
              {item.trailing.label}
            </div>
          ) : null}
        </div>
      ) : null}
    </>
  );

  if (!selectable) {
    return (
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3 rounded-xl px-3 py-2.5">
        {body}
      </div>
    );
  }

  return (
    <label
      className={[
        "group grid cursor-pointer grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-3 rounded-xl px-3 py-2.5 transition",
        checked ? "erp-selected-row" : "hover:bg-secondary/35",
      ].join(" ")}
    >
      {body}
    </label>
  );
}

function EmptyDetail({ config, selectedCount }) {
  const message =
    selectedCount > 0
      ? interpolate(config?.whenSelected, { count: selectedCount })
      : config?.whenEmpty;

  return (
    <div className="flex min-h-0 flex-1 items-center justify-center p-8">
      <div className="max-w-sm text-center">
        <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-2xl bg-secondary text-lg">
          {config?.icon ?? "↳"}
        </div>
        <h3 className="mt-3 text-base font-semibold">
          {config?.title ?? "詳細資料"}
        </h3>
        <p className="mt-1.5 text-sm text-secondary">{message}</p>
      </div>
    </div>
  );
}

function FullscreenWorkspace({
  view,
  detailView,
  clearDetail,
  renderDetail,
  activeAction,
  bridgeError,
  callTool,
  safeAreaInsets,
}) {
  const { presentation, data } = view;
  const records = data.records ?? [];
  const collection = presentation.collection ?? {};
  const selection = presentation.selection ?? {};
  const selectable = selection.mode === "multiple";
  const keyField = collection.key ?? "id";

  const [selectedIds, setSelectedIds] = useState([]);
  const [query, setQuery] = useState("");

  useEffect(() => {
    const validIds = new Set(records.map((record) => record?.[keyField]));
    setSelectedIds((current) =>
      current.filter((id) => validIds.has(id)),
    );
  }, [records, keyField]);

  const visibleRecords = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle || !presentation.search?.fields?.length) return records;

    return records.filter((record) =>
      presentation.search.fields
        .map((field) => getPath(record, field, ""))
        .join(" ")
        .toLowerCase()
        .includes(needle),
    );
  }, [presentation.search?.fields, query, records]);

  const allVisibleSelected =
    visibleRecords.length > 0 &&
    visibleRecords.every((record) =>
      selectedIds.includes(record?.[keyField]),
    );

  const toggle = (id) => {
    setSelectedIds((current) =>
      current.includes(id)
        ? current.filter((value) => value !== id)
        : [...current, id],
    );
  };

  const toggleVisible = () => {
    const visibleIds = visibleRecords.map((record) => record?.[keyField]);

    setSelectedIds((current) => {
      if (allVisibleSelected) {
        return current.filter((id) => !visibleIds.includes(id));
      }

      return Array.from(new Set([...current, ...visibleIds]));
    });
  };

  const runSelectionAction = () => {
    const action = selection.action;
    if (!action?.tool) return;

    callTool(
      action.tool,
      resolveArgs(action.input ?? {}, { selection: selectedIds }),
    );
  };

  const refresh = presentation.refresh;
  const count = getPath(data, presentation.count?.path, records.length);
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
            <BrandLockup brand={presentation.brand} compact />
            <div
              className="h-8 w-px bg-black/10 dark:bg-white/10"
              aria-hidden="true"
            />
            <div className="min-w-0">
              <p className="text-xs font-medium text-secondary">
                {presentation.brand?.section}
              </p>
              <h1 className="mt-0.5 truncate text-xl font-semibold tracking-tight">
                {presentation.title}
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Badge color="secondary" variant="soft" size="sm">
              {count}
              {presentation.count?.suffix ?? ""}
            </Badge>
            {presentation.statusText ? (
              <Badge color="secondary" variant="outline" size="sm">
                {presentation.statusText}
              </Badge>
            ) : null}
          </div>
        </div>
      </header>

      <div className="mx-auto flex min-h-0 w-full max-w-7xl flex-1 flex-col gap-0 lg:flex-row">
        <section className="flex min-h-0 w-full min-w-0 flex-col border-b border-subtle lg:w-[46%] lg:min-w-[420px] lg:border-b-0 lg:border-r">
          <div className="space-y-3 border-b border-subtle p-4">
            <div className="flex gap-2">
              {presentation.search ? (
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder={presentation.search.placeholder}
                  className="min-w-0 flex-1 rounded-xl border border-default bg-surface px-3 py-2 text-sm outline-none transition focus:border-strong"
                />
              ) : (
                <div className="min-w-0 flex-1" />
              )}

              {refresh?.tool ? (
                <Button
                  variant="ghost"
                  color="secondary"
                  size="sm"
                  disabled={activeAction === refresh.tool}
                  onClick={() => callTool(refresh.tool, refresh.args ?? {})}
                >
                  {activeAction === refresh.tool
                    ? "更新中…"
                    : refresh.label ?? "重新整理"}
                </Button>
              ) : null}
            </div>

            {selectable ? (
              <div className="flex items-center justify-between text-xs text-secondary">
                <span>
                  顯示 {visibleRecords.length} 筆 · 已選 {selectedIds.length} 筆
                </span>
                <button
                  type="button"
                  className="font-medium hover:text-primary"
                  onClick={toggleVisible}
                >
                  {allVisibleSelected
                    ? selection.clearVisibleLabel ?? "清除目前選取"
                    : selection.selectAllLabel ?? "全選目前結果"}
                </button>
              </div>
            ) : (
              <div className="text-xs text-secondary">
                顯示 {visibleRecords.length} 筆
              </div>
            )}
          </div>

          <div className="min-h-0 flex-1 space-y-1 overflow-y-auto p-2">
            {visibleRecords.length ? (
              visibleRecords.map((record, index) => {
                const key = record?.[keyField] ?? index;

                return (
                  <CollectionRecord
                    key={key}
                    record={record}
                    schema={collection}
                    selectable={selectable}
                    checked={selectedIds.includes(key)}
                    onToggle={toggle}
                  />
                );
              })
            ) : (
              <div className="px-4 py-12 text-center text-sm text-secondary">
                {collection.emptyText ?? "沒有符合條件的資料"}
              </div>
            )}
          </div>

          {selectable && selectedIds.length > 0 ? (
            <div className="flex items-center justify-between gap-3 border-t border-subtle px-4 py-3">
              <div className="flex items-center gap-3">
                <div>
                  <div className="text-sm font-semibold">
                    {selectedIds.length}
                    {selection.selectedSuffix ?? " 筆已選"}
                  </div>
                  {selection.note ? (
                    <div className="text-[11px] text-secondary">
                      {selection.note}
                    </div>
                  ) : null}
                </div>
                <button
                  type="button"
                  className="text-xs font-medium text-secondary hover:text-primary"
                  onClick={() => setSelectedIds([])}
                >
                  {selection.clearLabel ?? "清除"}
                </button>
              </div>

              {selection.action?.tool ? (
                <Button
                  variant="solid"
                  color="primary"
                  size="md"
                  pill={false}
                  className="erp-brand-primary"
                  loading={activeAction === selection.action.tool}
                  onClick={runSelectionAction}
                >
                  {selection.action.label ?? "執行"}
                  <ChevronRightMd />
                </Button>
              ) : null}
            </div>
          ) : selectable ? (
            <div className="border-t border-subtle px-4 py-3 text-xs text-secondary">
              {selection.emptyHint}
            </div>
          ) : null}
        </section>

        <section className="flex min-h-0 min-w-0 flex-1 flex-col">
          {detailView ? (
            renderDetail(detailView, { onBack: clearDetail })
          ) : (
            <EmptyDetail
              config={presentation.detail?.empty}
              selectedCount={selectedIds.length}
            />
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

export function CollectionWorkspace(props) {
  if (props.displayMode !== "fullscreen") {
    return (
      <InlineSummary
        view={props.view}
        bridgeError={props.bridgeError}
        requestFullscreen={props.requestFullscreen}
      />
    );
  }

  return <FullscreenWorkspace {...props} />;
}
