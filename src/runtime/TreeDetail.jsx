import { Badge } from "@openai/apps-sdk-ui/components/Badge";
import { Button } from "@openai/apps-sdk-ui/components/Button";
import { useMemo, useState } from "react";

import { getPath } from "./value.js";

function buildDepthMap(records, keyField, parentField) {
  const byKey = new Map(records.map((record) => [record[keyField], record]));
  const memo = new Map();

  const resolve = (record, guard = 0) => {
    const key = record?.[keyField];
    if (key == null || guard > 20) return 0;
    if (memo.has(key)) return memo.get(key);

    let depth = 0;
    const parentKey = record?.[parentField];

    if (parentKey != null && byKey.has(parentKey)) {
      depth = resolve(byKey.get(parentKey), guard + 1) + 1;
    }

    memo.set(key, depth);
    return depth;
  };

  records.forEach((record) => resolve(record));
  return memo;
}

function TreeRecord({ record, depth, topLevel, schema, expanded, onToggle }) {
  const materialsSchema = schema.materials ?? {};
  const materials = record?.[materialsSchema.field] ?? [];

  const code = record?.[schema.codeField] ?? "";
  const title = record?.[schema.titleField] ?? "";
  const serial = record?.[schema.serialField] ?? "";
  const quantity = record?.[schema.quantityField] ?? "";
  const date = record?.[schema.dateField] ?? "";
  const status = record?.[schema.statusField] ?? "";

  return (
    <div
      className="rounded-xl border border-subtle bg-surface p-3"
      style={{ marginLeft: Math.min(depth, 4) * 16 }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-1.5">
            {depth > 0 ? <span className="text-secondary">↳</span> : null}
            <span className="font-mono text-xs text-secondary">{code}</span>
            <Badge
              color={topLevel ? "success" : "secondary"}
              variant="soft"
              size="sm"
            >
              {topLevel ? schema.topLevelLabel : schema.childLabel}
            </Badge>
          </div>

          <div className="mt-1 text-sm font-semibold">{title}</div>
          <div className="mt-0.5 text-xs text-secondary">
            {serial}
            {serial ? " · " : ""}
            {schema.quantityPrefix ?? ""}
            {quantity}
            {date ? ` · ${date}` : ""}
          </div>
        </div>

        {status ? (
          <Badge color="secondary" variant="outline" size="sm">
            {status}
          </Badge>
        ) : null}
      </div>

      <div className="mt-2 flex items-center justify-between">
        <span className="text-xs text-secondary">
          {materialsSchema.countPrefix ?? ""}
          {materials.length}
          {materialsSchema.countSuffix ?? ""}
        </span>
        <Button
          variant="ghost"
          color="secondary"
          size="sm"
          onClick={onToggle}
        >
          {expanded
            ? materialsSchema.closeLabel ?? "收合"
            : materialsSchema.openLabel ?? "展開"}
        </Button>
      </div>

      {expanded ? (
        <div className="mt-2 overflow-hidden rounded-lg bg-secondary/40">
          {materials.length ? (
            materials.map((material, index) => {
              const materialKey =
                material?.[materialsSchema.keyField] ??
                `${code}-material-${index}`;

              return (
                <div
                  key={materialKey}
                  className="flex items-center justify-between gap-3 border-b border-subtle px-3 py-2 last:border-b-0"
                >
                  <div className="min-w-0">
                    <div className="truncate text-xs font-medium">
                      {material?.[materialsSchema.titleField] ?? ""}
                    </div>
                    <div className="truncate text-[11px] text-secondary">
                      {material?.[materialsSchema.serialField] ?? ""}
                    </div>
                  </div>
                  <div className="shrink-0 text-xs font-semibold">
                    {material?.[materialsSchema.quantityField] ?? ""}
                  </div>
                </div>
              );
            })
          ) : (
            <div className="px-3 py-2 text-xs text-secondary">
              {materialsSchema.emptyText ?? "無資料"}
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}

export function TreeDetail({ view, onBack }) {
  const { presentation, data } = view;
  const schema = presentation.tree ?? {};
  const records = getPath(data, schema.recordsPath, []) ?? [];
  const [expandedKeys, setExpandedKeys] = useState([]);

  const depths = useMemo(
    () => buildDepthMap(records, schema.key, schema.parentKey),
    [records, schema.key, schema.parentKey],
  );

  const topLevelIds = useMemo(
    () => new Set(getPath(data, schema.topLevelIdsPath, []) ?? []),
    [data, schema.topLevelIdsPath],
  );

  const toggle = (key) => {
    setExpandedKeys((current) =>
      current.includes(key)
        ? current.filter((value) => value !== key)
        : [...current, key],
    );
  };

  const summary = presentation.summary ?? {};
  const count = getPath(data, summary.countPath, 0);
  const sourceCount = getPath(data, summary.sourceCountPath, 0);

  return (
    <section className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center justify-between gap-3 border-b border-subtle px-5 py-4">
        <div>
          <p className="text-xs font-medium text-secondary">
            {presentation.eyebrow}
          </p>
          <div className="mt-0.5 flex items-baseline gap-2">
            <h3 className="heading-lg">
              {count}
              {summary.countSuffix ?? ""}
            </h3>
            <span className="text-xs text-secondary">
              {summary.sourceCountPrefix ?? ""}
              {sourceCount}
              {summary.sourceCountSuffix ?? ""}
            </span>
          </div>
        </div>

        {presentation.statusText ? (
          <Badge color="secondary" variant="soft" size="sm">
            {presentation.statusText}
          </Badge>
        ) : null}
      </div>

      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-4">
        {records.map((record) => {
          const key = record?.[schema.key];
          const compareValue = record?.[schema.topLevelCompareField];

          return (
            <TreeRecord
              key={key}
              record={record}
              depth={depths.get(key) ?? 0}
              topLevel={topLevelIds.has(compareValue)}
              schema={schema}
              expanded={expandedKeys.includes(key)}
              onToggle={() => toggle(key)}
            />
          );
        })}
      </div>

      <div className="flex items-center justify-between border-t border-subtle px-5 py-3">
        <span className="text-xs text-secondary">
          {presentation.footerText}
        </span>
        <Button variant="soft" color="secondary" size="sm" onClick={onBack}>
          {presentation.backLabel ?? "返回"}
        </Button>
      </div>
    </section>
  );
}
