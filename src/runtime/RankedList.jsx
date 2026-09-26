import { Button } from "@openai/apps-sdk-ui/components/Button";
import { ChevronRightMd } from "@openai/apps-sdk-ui/components/Icon";

import { BrandLockup } from "./BrandLockup.jsx";
import { fieldValue, formatValue, getPath, lineValue } from "./value.js";

function PeriodLabel({ data, presentation }) {
  const start = getPath(data, presentation.period?.startPath, "");
  const end = getPath(data, presentation.period?.endPath, "");

  if (!start && !end) return null;

  return (
    <span className="text-xs text-secondary">
      {start}
      {start && end ? " ～ " : ""}
      {end}
    </span>
  );
}

function SummaryStrip({ data, presentation }) {
  const items = presentation.summary ?? [];
  if (!items.length) return null;

  return (
    <dl className="grid grid-cols-3 divide-x divide-subtle border-y border-subtle">
      {items.map((item) => {
        const raw = getPath(data, item.path, 0);
        const value = `${formatValue(raw, item)}${item.suffix ?? ""}`;

        return (
          <div key={item.path} className="min-w-0 px-3 py-2.5">
            <dt className="truncate text-[11px] text-secondary">{item.label}</dt>
            <dd className="mt-0.5 truncate text-sm font-semibold tabular-nums">
              {value}
            </dd>
          </div>
        );
      })}
    </dl>
  );
}

function RankingRow({ record, schema }) {
  const progressRaw = Number(record?.[schema.progressField] ?? 0);
  const progress = Number.isFinite(progressRaw)
    ? Math.max(0, Math.min(100, progressRaw))
    : 0;

  return (
    <div className="px-4 py-3">
      <div className="grid grid-cols-[34px_minmax(0,1fr)_auto] items-start gap-3">
        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-secondary text-xs font-semibold tabular-nums">
          {fieldValue(record, schema.rank)}
        </div>

        <div className="min-w-0">
          <div className="truncate text-sm font-semibold">
            {fieldValue(record, schema.title)}
          </div>
          {schema.subtitle ? (
            <div className="mt-0.5 truncate text-xs text-secondary">
              {lineValue(record, schema.subtitle)}
            </div>
          ) : null}
        </div>

        <div className="min-w-[96px] text-right">
          <div className="text-sm font-semibold tabular-nums">
            {fieldValue(record, schema.value)}
          </div>
          {schema.secondaryValue ? (
            <div className="mt-0.5 text-[11px] text-secondary">
              {schema.secondaryLabel ? `${schema.secondaryLabel} ` : ""}
              {fieldValue(record, schema.secondaryValue)}
            </div>
          ) : null}
        </div>
      </div>

      {schema.progressField ? (
        <div className="erp-ranking-track ml-[46px] mt-2">
          <div
            className="erp-ranking-fill"
            style={{ width: `${progress}%` }}
          />
        </div>
      ) : null}
    </div>
  );
}

function RankingList({ records, schema, emptyText }) {
  if (!records.length) {
    return (
      <div className="px-4 py-12 text-center text-sm text-secondary">
        {emptyText}
      </div>
    );
  }

  return (
    <div className="erp-divider-list">
      {records.map((record, index) => (
        <RankingRow
          key={record?.[schema.key] ?? index}
          record={record}
          schema={schema}
        />
      ))}
    </div>
  );
}

function InlineRankedList({
  view,
  bridgeError,
  requestFullscreen,
}) {
  const { presentation, data } = view;
  const schema = presentation.ranking ?? {};
  const records = getPath(data, schema.recordsPath, []) ?? [];
  const limit = presentation.inlineLimit ?? 5;
  const visible = records.slice(0, limit);
  const remaining = Math.max(0, records.length - visible.length);

  return (
    <article className="w-full max-w-xl overflow-hidden rounded-xl bg-surface ring-1 ring-subtle shadow-sm">
      <header className="px-4 py-3.5">
        <div className="flex items-start justify-between gap-3">
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
              <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5">
                <PeriodLabel data={data} presentation={presentation} />
                {presentation.description ? (
                  <span className="text-xs text-secondary">
                    {presentation.description}
                  </span>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      </header>

      <SummaryStrip data={data} presentation={presentation} />

      <RankingList
        records={visible}
        schema={schema}
        emptyText={presentation.emptyText}
      />

      {bridgeError ? (
        <div className="border-t border-subtle px-4 py-2 text-xs text-danger">
          {bridgeError}
        </div>
      ) : null}

      <footer className="flex items-center justify-between gap-3 border-t border-subtle px-4 py-3">
        <span className="text-xs text-secondary">
          {remaining > 0 ? `另有 ${remaining} 名 · ` : ""}
          {presentation.footerText}
        </span>

        {remaining > 0 ? (
          <Button
            variant="solid"
            color="primary"
            size="sm"
            pill={false}
            className="erp-brand-primary"
            onClick={requestFullscreen}
          >
            {presentation.openLabel ?? "查看完整排行"}
            <ChevronRightMd />
          </Button>
        ) : null}
      </footer>
    </article>
  );
}

function FullscreenRankedList({
  view,
  bridgeError,
  safeAreaInsets,
}) {
  const { presentation, data } = view;
  const schema = presentation.ranking ?? {};
  const records = getPath(data, schema.recordsPath, []) ?? [];
  const composerClearance = Math.max(
    96,
    (safeAreaInsets?.bottom ?? 0) + 24,
  );

  return (
    <main
      className="box-border min-h-[100dvh] bg-surface"
      style={{
        paddingTop: safeAreaInsets?.top ?? 0,
        paddingRight: safeAreaInsets?.right ?? 0,
        paddingBottom: composerClearance,
        paddingLeft: safeAreaInsets?.left ?? 0,
      }}
    >
      <div className="mx-auto w-full max-w-4xl">
        <header className="flex items-start justify-between gap-4 border-b border-subtle px-6 py-5">
          <div className="flex min-w-0 items-center gap-4">
            <BrandLockup brand={presentation.brand} />
            <div
              className="h-9 w-px bg-black/10 dark:bg-white/10"
              aria-hidden="true"
            />
            <div className="min-w-0">
              <h1 className="truncate text-xl font-semibold tracking-tight">
                {presentation.title}
              </h1>
              <div className="mt-1 flex flex-wrap gap-x-2 text-xs text-secondary">
                <PeriodLabel data={data} presentation={presentation} />
                {presentation.description ? (
                  <span>{presentation.description}</span>
                ) : null}
              </div>
            </div>
          </div>
        </header>

        <SummaryStrip data={data} presentation={presentation} />

        <RankingList
          records={records}
          schema={schema}
          emptyText={presentation.emptyText}
        />

        <footer className="border-t border-subtle px-6 py-3 text-xs text-secondary">
          {presentation.footerText}
        </footer>

        {bridgeError ? (
          <div className="border-t border-subtle px-6 py-2 text-xs text-danger">
            {bridgeError}
          </div>
        ) : null}
      </div>
    </main>
  );
}

export function RankedList(props) {
  if (props.displayMode === "fullscreen") {
    return <FullscreenRankedList {...props} />;
  }

  return <InlineRankedList {...props} />;
}
