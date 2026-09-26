import { Badge } from "@openai/apps-sdk-ui/components/Badge";
import { Button } from "@openai/apps-sdk-ui/components/Button";
import { ChevronRightMd } from "@openai/apps-sdk-ui/components/Icon";
import { useEffect, useMemo, useState } from "react";

import { BrandLockup } from "./BrandLockup.jsx";
import {
  fieldValue,
  getPath,
  resolveArgs,
} from "./value.js";

function InlineGrid({
  view,
  bridgeError,
  requestFullscreen,
}) {
  const { presentation, data } = view;
  const grid = presentation.grid ?? {};
  const records = getPath(data, grid.recordsPath, []) ?? [];
  const inline = presentation.inline ?? {};
  const columnsByField = new Map(
    (grid.columns ?? []).map((column) => [column.field, column]),
  );
  const columns = (inline.columns ?? [])
    .map((field) => columnsByField.get(field))
    .filter(Boolean);
  const visible = records.slice(0, inline.limit ?? 4);

  return (
    <article className="w-full max-w-2xl overflow-hidden rounded-xl bg-surface ring-1 ring-subtle shadow-sm">
      <header className="flex items-center justify-between gap-3 border-b border-subtle px-4 py-3.5">
        <div className="flex min-w-0 items-center gap-3">
          <BrandLockup brand={presentation.brand} compact />
          <div
            className="h-7 w-px bg-black/10 dark:bg-white/10"
            aria-hidden="true"
          />
          <div className="min-w-0">
            <h2 className="truncate text-base font-semibold">
              {presentation.title}
            </h2>
            {presentation.description ? (
              <p className="mt-0.5 truncate text-xs text-secondary">
                {presentation.description}
              </p>
            ) : null}
          </div>
        </div>

        <Badge color="secondary" variant="soft" size="sm">
          {getPath(data, presentation.count?.path, records.length)}
          {presentation.count?.suffix ?? ""}
        </Badge>
      </header>

      <div className="overflow-x-auto">
        <table className="erp-grid-table w-full text-left text-xs">
          <thead>
            <tr>
              {columns.map((column) => (
                <th key={column.field}>{column.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visible.map((record, index) => (
              <tr key={record?.[grid.key] ?? index}>
                {columns.map((column) => (
                  <td
                    key={column.field}
                    className={column.align === "right" ? "text-right" : ""}
                  >
                    <GridCell record={record} column={column} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {bridgeError ? (
        <div className="border-t border-subtle px-4 py-2 text-xs text-danger">
          {bridgeError}
        </div>
      ) : null}

      <footer className="flex items-center justify-between gap-3 border-t border-subtle px-4 py-3">
        <span className="text-xs text-secondary">
          {records.length > visible.length
            ? `顯示前 ${visible.length} 筆 · `
            : ""}
          {presentation.footerText}
        </span>

        <Button
          variant="solid"
          color="primary"
          size="sm"
          pill={false}
          className="erp-brand-primary"
          onClick={requestFullscreen}
        >
          {inline.openLabel ?? "開啟 Grid"}
          <ChevronRightMd />
        </Button>
      </footer>
    </article>
  );
}

function GridCell({ record, column }) {
  const raw = getPath(record, column.field, "");

  if (column.type === "badge") {
    const mapped = column.valueMap?.[raw] ?? {
      label: raw || "—",
      color: "secondary",
    };

    return (
      <Badge color={mapped.color ?? "secondary"} variant="soft" size="sm">
        {mapped.label}
      </Badge>
    );
  }

  return fieldValue(record, column) || "—";
}

function compareRows(left, right, column, direction) {
  const a = getPath(left, column.field, null);
  const b = getPath(right, column.field, null);
  const multiplier = direction === "desc" ? -1 : 1;

  if (a === b) return 0;
  if (a == null) return 1 * multiplier;
  if (b == null) return -1 * multiplier;

  if (
    column.format === "integer" ||
    column.format === "number" ||
    column.format === "currency"
  ) {
    return (Number(a) - Number(b)) * multiplier;
  }

  if (column.format === "date") {
    return (String(a).localeCompare(String(b))) * multiplier;
  }

  return String(a).localeCompare(String(b), "zh-Hant") * multiplier;
}

function matchesFilter(record, filter, state) {
  if (!state) return true;

  const value = getPath(record, filter.field, null);

  if (filter.type === "select") {
    return !state.value || String(value) === String(state.value);
  }

  if (filter.type === "date-range") {
    if (state.start && String(value) < state.start) return false;
    if (state.end && String(value) > state.end) return false;
    return true;
  }

  if (filter.type === "number-range") {
    const numeric = Number(value);
    if (state.min !== "" && state.min != null && numeric < Number(state.min)) {
      return false;
    }
    if (state.max !== "" && state.max != null && numeric > Number(state.max)) {
      return false;
    }
    return true;
  }

  return true;
}

function FilterControl({ filter, value, onChange }) {
  if (filter.type === "select") {
    return (
      <label className="flex min-w-[140px] flex-col gap-1 text-xs text-secondary">
        <span>{filter.label}</span>
        <select
          value={value?.value ?? ""}
          onChange={(event) => onChange({ value: event.target.value })}
          className="erp-grid-control"
        >
          <option value="">{filter.allLabel ?? `全部${filter.label}`}</option>
          {(filter.options ?? []).map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
    );
  }

  if (filter.type === "date-range") {
    return (
      <fieldset className="min-w-[250px]">
        <legend className="mb-1 text-xs text-secondary">{filter.label}</legend>
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={value?.start ?? ""}
            onChange={(event) =>
              onChange({ ...(value ?? {}), start: event.target.value })
            }
            className="erp-grid-control min-w-0"
            aria-label={`${filter.label}開始`}
          />
          <span className="text-xs text-secondary">～</span>
          <input
            type="date"
            value={value?.end ?? ""}
            onChange={(event) =>
              onChange({ ...(value ?? {}), end: event.target.value })
            }
            className="erp-grid-control min-w-0"
            aria-label={`${filter.label}結束`}
          />
        </div>
      </fieldset>
    );
  }

  if (filter.type === "number-range") {
    return (
      <fieldset className="min-w-[230px]">
        <legend className="mb-1 text-xs text-secondary">{filter.label}</legend>
        <div className="flex items-center gap-2">
          <input
            type="number"
            value={value?.min ?? ""}
            placeholder="最小"
            onChange={(event) =>
              onChange({ ...(value ?? {}), min: event.target.value })
            }
            className="erp-grid-control min-w-0"
            aria-label={`${filter.label}最小值`}
          />
          <span className="text-xs text-secondary">～</span>
          <input
            type="number"
            value={value?.max ?? ""}
            placeholder="最大"
            onChange={(event) =>
              onChange({ ...(value ?? {}), max: event.target.value })
            }
            className="erp-grid-control min-w-0"
            aria-label={`${filter.label}最大值`}
          />
        </div>
      </fieldset>
    );
  }

  return null;
}

function SortLabel({ active, direction }) {
  if (!active) {
    return <span className="ml-1 text-[10px] text-secondary">↕</span>;
  }

  return (
    <span className="ml-1 text-[10px]" aria-hidden="true">
      {direction === "asc" ? "↑" : "↓"}
    </span>
  );
}

function FullscreenGrid({
  view,
  activeAction,
  bridgeError,
  callTool,
  safeAreaInsets,
}) {
  const { presentation, data } = view;
  const grid = presentation.grid ?? {};
  const records = getPath(data, grid.recordsPath, []) ?? [];
  const filters = presentation.filters ?? [];
  const quickFilters = filters.filter((filter) => filter.type === "select");
  const advancedFilters = filters.filter((filter) => filter.type !== "select");
  const selection = presentation.selection ?? {};
  const selectable = selection.mode === "multiple";
  const keyField = grid.key ?? "id";
  const initialPageSize = presentation.pagination?.pageSize ?? 10;

  const [query, setQuery] = useState("");
  const [filterState, setFilterState] = useState({});
  const [sort, setSort] = useState({ field: null, direction: "asc" });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(initialPageSize);
  const [selectedIds, setSelectedIds] = useState([]);

  useEffect(() => {
    const validIds = new Set(records.map((record) => record?.[keyField]));
    setSelectedIds((current) =>
      current.filter((id) => validIds.has(id)),
    );
    setPage(1);
  }, [records, keyField]);

  const processedRecords = useMemo(() => {
    const needle = query.trim().toLowerCase();

    let next = records.filter((record) => {
      if (
        needle &&
        presentation.search?.fields?.length &&
        !presentation.search.fields
          .map((field) => getPath(record, field, ""))
          .join(" ")
          .toLowerCase()
          .includes(needle)
      ) {
        return false;
      }

      return filters.every((filter) =>
        matchesFilter(record, filter, filterState[filter.id]),
      );
    });

    if (sort.field) {
      const column = grid.columns?.find(
        (candidate) => candidate.field === sort.field,
      );
      if (column) {
        next = [...next].sort((left, right) =>
          compareRows(left, right, column, sort.direction),
        );
      }
    }

    return next;
  }, [
    filterState,
    filters,
    grid.columns,
    presentation.search?.fields,
    query,
    records,
    sort,
  ]);

  const pageCount = Math.max(
    1,
    Math.ceil(processedRecords.length / pageSize),
  );
  const safePage = Math.min(page, pageCount);
  const startIndex = (safePage - 1) * pageSize;
  const pageRecords = processedRecords.slice(
    startIndex,
    startIndex + pageSize,
  );

  useEffect(() => {
    if (page > pageCount) setPage(pageCount);
  }, [page, pageCount]);

  const pageIds = pageRecords.map((record) => record?.[keyField]);
  const allPageSelected =
    pageIds.length > 0 && pageIds.every((id) => selectedIds.includes(id));

  const toggleRow = (id) => {
    setSelectedIds((current) =>
      current.includes(id)
        ? current.filter((value) => value !== id)
        : [...current, id],
    );
  };

  const togglePage = () => {
    setSelectedIds((current) => {
      if (allPageSelected) {
        return current.filter((id) => !pageIds.includes(id));
      }
      return Array.from(new Set([...current, ...pageIds]));
    });
  };

  const toggleSort = (column) => {
    if (!column.sortable) return;

    setSort((current) => {
      if (current.field !== column.field) {
        return { field: column.field, direction: "asc" };
      }

      return {
        field: column.field,
        direction: current.direction === "asc" ? "desc" : "asc",
      };
    });
    setPage(1);
  };

  const hasFilters =
    query.trim() !== "" ||
    Object.values(filterState).some((value) =>
      Object.values(value ?? {}).some(
        (entry) => entry !== "" && entry != null,
      ),
    );

  const resetView = () => {
    setQuery("");
    setFilterState({});
    setSort({ field: null, direction: "asc" });
    setPage(1);
  };

  const composerClearance = Math.max(
    112,
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
      <header className="border-b border-subtle bg-surface px-5 py-4">
        <div className="mx-auto flex w-full max-w-[1500px] items-center justify-between gap-4">
          <div className="flex min-w-0 items-center gap-4">
            <BrandLockup brand={presentation.brand} compact />
            <div
              className="h-8 w-px bg-black/10 dark:bg-white/10"
              aria-hidden="true"
            />
            <div className="min-w-0">
              <h1 className="truncate text-xl font-semibold tracking-tight">
                {presentation.title}
              </h1>
              {presentation.description ? (
                <p className="mt-0.5 truncate text-xs text-secondary">
                  {presentation.description}
                </p>
              ) : null}
            </div>
          </div>

          <Badge color="secondary" variant="soft" size="sm">
            {getPath(data, presentation.count?.path, records.length)}
            {presentation.count?.suffix ?? ""}
          </Badge>
        </div>
      </header>

      <div className="mx-auto flex min-h-0 w-full max-w-[1500px] flex-1 flex-col">
        <section className="border-b border-subtle px-4 py-3">
          <div className="flex flex-wrap items-end gap-2">
            {presentation.search ? (
              <label className="min-w-[260px] flex-1">
                <span className="mb-1 block text-xs text-secondary">搜尋</span>
                <input
                  type="search"
                  value={query}
                  onChange={(event) => {
                    setQuery(event.target.value);
                    setPage(1);
                  }}
                  placeholder={presentation.search.placeholder}
                  className="erp-grid-control w-full"
                />
              </label>
            ) : null}

            {quickFilters.map((filter) => (
              <FilterControl
                key={filter.id}
                filter={filter}
                value={filterState[filter.id]}
                onChange={(value) => {
                  setFilterState((current) => ({
                    ...current,
                    [filter.id]: value,
                  }));
                  setPage(1);
                }}
              />
            ))}

            {hasFilters ? (
              <Button
                variant="ghost"
                color="secondary"
                size="sm"
                onClick={resetView}
              >
                清除篩選
              </Button>
            ) : null}

            {presentation.refresh?.tool ? (
              <Button
                variant="ghost"
                color="secondary"
                size="sm"
                disabled={activeAction === presentation.refresh.tool}
                onClick={() =>
                  callTool(
                    presentation.refresh.tool,
                    presentation.refresh.args ?? {},
                  )
                }
              >
                {activeAction === presentation.refresh.tool
                  ? "更新中…"
                  : presentation.refresh.label ?? "重新整理"}
              </Button>
            ) : null}
          </div>

          {advancedFilters.length ? (
            <details className="mt-2">
              <summary className="w-fit cursor-pointer text-xs font-medium text-secondary">
                進階篩選
              </summary>
              <div className="mt-2 flex flex-wrap items-end gap-3 rounded-lg bg-secondary/25 p-3">
                {advancedFilters.map((filter) => (
                  <FilterControl
                    key={filter.id}
                    filter={filter}
                    value={filterState[filter.id]}
                    onChange={(value) => {
                      setFilterState((current) => ({
                        ...current,
                        [filter.id]: value,
                      }));
                      setPage(1);
                    }}
                  />
                ))}
              </div>
            </details>
          ) : null}
        </section>

        <section className="min-h-0 flex-1 overflow-auto">
          <table className="erp-grid-table w-full text-left text-xs">
            <thead className="sticky top-0 z-10 bg-surface">
              <tr>
                {selectable ? (
                  <th className="erp-grid-checkbox-cell">
                    <label
                      className="erp-checkbox-hit"
                      title="選取目前頁面"
                    >
                      <input
                        type="checkbox"
                        checked={allPageSelected}
                        onChange={togglePage}
                        aria-label="選取目前頁面"
                      />
                    </label>
                  </th>
                ) : null}

                {(grid.columns ?? []).map((column) => (
                  <th
                    key={column.field}
                    style={{
                      minWidth: column.minWidth
                        ? `${column.minWidth}px`
                        : undefined,
                    }}
                    className={column.align === "right" ? "text-right" : ""}
                  >
                    {column.sortable ? (
                      <button
                        type="button"
                        className="erp-grid-sort-button"
                        onClick={() => toggleSort(column)}
                        aria-label={`依${column.label}排序`}
                      >
                        {column.label}
                        <SortLabel
                          active={sort.field === column.field}
                          direction={sort.direction}
                        />
                      </button>
                    ) : (
                      column.label
                    )}
                  </th>
                ))}
              </tr>
            </thead>

            <tbody>
              {pageRecords.length ? (
                pageRecords.map((record, index) => {
                  const key = record?.[keyField] ?? index;
                  const checked = selectedIds.includes(key);

                  return (
                    <tr
                      key={key}
                      className={checked ? "erp-grid-selected-row" : ""}
                    >
                      {selectable ? (
                        <td className="erp-grid-checkbox-cell">
                          <label className="erp-checkbox-hit">
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => toggleRow(key)}
                              aria-label={`選取第 ${startIndex + index + 1} 筆`}
                            />
                          </label>
                        </td>
                      ) : null}

                      {(grid.columns ?? []).map((column) => (
                        <td
                          key={column.field}
                          className={
                            column.align === "right" ? "text-right" : ""
                          }
                        >
                          <GridCell record={record} column={column} />
                        </td>
                      ))}
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td
                    colSpan={(grid.columns?.length ?? 0) + (selectable ? 1 : 0)}
                    className="py-14 text-center text-sm text-secondary"
                  >
                    {grid.emptyText ?? "沒有符合條件的資料"}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </section>

        {selectable && selectedIds.length > 0 ? (
          <section className="flex flex-wrap items-center justify-between gap-3 border-t border-subtle bg-surface px-4 py-3">
            <div className="flex items-center gap-3">
              <span className="text-sm font-semibold">
                {selectedIds.length}
                {selection.selectedSuffix ?? " 筆已選"}
              </span>
              <button
                type="button"
                className="text-xs font-medium text-secondary hover:text-primary"
                onClick={() => setSelectedIds([])}
              >
                {selection.clearLabel ?? "清除選取"}
              </button>
            </div>

            <div className="flex items-center gap-2">
              {(selection.actions ?? []).map((action, index) => (
                <Button
                  key={`${action.tool}-${index}`}
                  variant={index === 0 ? "solid" : "soft"}
                  color={index === 0 ? "primary" : "secondary"}
                  size="sm"
                  pill={false}
                  className={index === 0 ? "erp-brand-primary" : ""}
                  loading={activeAction === action.tool}
                  onClick={() =>
                    callTool(
                      action.tool,
                      resolveArgs(action.input ?? {}, {
                        selection: selectedIds,
                      }),
                    )
                  }
                >
                  {action.label ?? "執行"}
                </Button>
              ))}
            </div>
          </section>
        ) : null}

        <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-subtle bg-surface px-4 py-3">
          <div className="text-xs text-secondary">
            顯示 {processedRecords.length ? startIndex + 1 : 0}–
            {Math.min(startIndex + pageSize, processedRecords.length)} /{" "}
            {processedRecords.length} 筆
            {presentation.footerText
              ? ` · ${presentation.footerText}`
              : ""}
          </div>

          <div className="flex items-center gap-2">
            <label className="flex items-center gap-1 text-xs text-secondary">
              每頁
              <select
                value={pageSize}
                onChange={(event) => {
                  setPageSize(Number(event.target.value));
                  setPage(1);
                }}
                className="erp-grid-control !py-1"
              >
                {(presentation.pagination?.pageSizeOptions ?? [
                  initialPageSize,
                ]).map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </label>

            <Button
              variant="ghost"
              color="secondary"
              size="sm"
              disabled={safePage <= 1}
              onClick={() => setPage((value) => Math.max(1, value - 1))}
            >
              上一頁
            </Button>

            <span className="min-w-[70px] text-center text-xs text-secondary">
              {safePage} / {pageCount}
            </span>

            <Button
              variant="ghost"
              color="secondary"
              size="sm"
              disabled={safePage >= pageCount}
              onClick={() =>
                setPage((value) => Math.min(pageCount, value + 1))
              }
            >
              下一頁
            </Button>
          </div>
        </footer>

        {bridgeError ? (
          <div className="border-t border-subtle px-4 py-2 text-xs text-danger">
            {bridgeError}
          </div>
        ) : null}
      </div>
    </main>
  );
}

export function DataGrid(props) {
  if (props.displayMode === "fullscreen") {
    return <FullscreenGrid {...props} />;
  }

  return <InlineGrid {...props} />;
}
