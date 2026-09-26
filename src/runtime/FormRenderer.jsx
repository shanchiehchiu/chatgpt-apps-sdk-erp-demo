import { Badge } from "@openai/apps-sdk-ui/components/Badge";
import { Button } from "@openai/apps-sdk-ui/components/Button";
import { ChevronRightMd } from "@openai/apps-sdk-ui/components/Icon";
import { useEffect, useMemo, useRef, useState } from "react";

import { BrandLockup } from "./BrandLockup.jsx";
import {
  fieldValue,
  getPath,
  resolveArgs,
} from "./value.js";

function conditionMatches(condition, values) {
  if (!condition) return true;

  const value = getPath(values, condition.field, null);
  const operator = condition.operator ?? "equals";

  if (operator === "equals") return value === condition.value;
  if (operator === "not-equals") return value !== condition.value;
  if (operator === "truthy") return Boolean(value);
  if (operator === "falsy") return !value;
  if (operator === "in") {
    return Array.isArray(condition.values) && condition.values.includes(value);
  }

  return true;
}

function fieldVisible(field, values) {
  return conditionMatches(field.visibleWhen, values);
}

function fieldRequired(field, values) {
  return Boolean(
    field.required ||
      (field.requiredWhen && conditionMatches(field.requiredWhen, values)),
  );
}

function displayFieldValue(field, values) {
  const raw = values?.[field.name];

  if (field.type === "select") {
    const option = field.options?.find(
      (candidate) => String(candidate.value) === String(raw),
    );
    return option?.label ?? raw ?? "—";
  }

  if (field.type === "checkbox") {
    return raw ? "是" : "否";
  }

  if (field.type === "number" && field.prefix) {
    return `${field.prefix}${raw ?? ""}`;
  }

  return fieldValue(values, {
    field: field.name,
    format: field.type === "date" ? "date" : undefined,
    fallback: "—",
  });
}

function validateField(field, value, values) {
  if (!fieldVisible(field, values)) return "";

  const required = fieldRequired(field, values);
  const empty =
    value === null ||
    value === undefined ||
    value === "" ||
    (typeof value === "string" && value.trim() === "");

  if (required && empty) {
    return `${field.label}為必填`;
  }

  if (empty) return "";

  if (field.type === "number") {
    const numeric = Number(value);

    if (!Number.isFinite(numeric)) return `${field.label}需為數字`;
    if (field.min != null && numeric < Number(field.min)) {
      return `${field.label}不可小於 ${field.min}`;
    }
    if (field.max != null && numeric > Number(field.max)) {
      return `${field.label}不可大於 ${field.max}`;
    }
  }

  const text = String(value);

  if (field.minLength != null && text.length < Number(field.minLength)) {
    return `${field.label}至少需要 ${field.minLength} 個字元`;
  }

  if (field.maxLength != null && text.length > Number(field.maxLength)) {
    return `${field.label}不可超過 ${field.maxLength} 個字元`;
  }

  if (field.pattern) {
    try {
      if (!new RegExp(field.pattern).test(text)) {
        return field.patternMessage ?? `${field.label}格式不正確`;
      }
    } catch {
      return "";
    }
  }

  return "";
}

function validateForm(fields, values) {
  return Object.fromEntries(
    fields
      .map((field) => [
        field.name,
        validateField(field, values?.[field.name], values),
      ])
      .filter(([, error]) => error),
  );
}

function InlineForm({
  view,
  bridgeError,
  requestFullscreen,
}) {
  const { presentation, data } = view;
  const form = presentation.form ?? {};
  const values = getPath(data, form.valuesPath, {}) ?? {};
  const fieldsByName = new Map(
    (form.fields ?? []).map((field) => [field.name, field]),
  );
  const visibleFields = (presentation.inline?.fields ?? [])
    .map((name) => fieldsByName.get(name))
    .filter(Boolean);

  return (
    <article className="w-full max-w-xl overflow-hidden rounded-xl bg-surface ring-1 ring-subtle shadow-sm">
      <header className="flex items-start justify-between gap-3 border-b border-subtle px-4 py-3.5">
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
      </header>

      <dl className="grid grid-cols-2 gap-x-4 gap-y-3 px-4 py-3.5">
        {visibleFields.map((field) => (
          <div key={field.name} className="min-w-0">
            <dt className="text-[11px] text-secondary">{field.label}</dt>
            <dd className="mt-0.5 truncate text-sm font-medium">
              {displayFieldValue(field, values)}
            </dd>
          </div>
        ))}
      </dl>

      {bridgeError ? (
        <div className="border-t border-subtle px-4 py-2 text-xs text-danger">
          {bridgeError}
        </div>
      ) : null}

      <footer className="flex items-center justify-between gap-3 border-t border-subtle px-4 py-3">
        <span className="text-xs text-secondary">
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
          {presentation.inline?.openLabel ?? "開啟表單"}
          <ChevronRightMd />
        </Button>
      </footer>
    </article>
  );
}

function FieldMessage({ error, help, maxLength, value }) {
  if (error) {
    return (
      <p className="mt-1 text-xs text-danger" role="alert">
        {error}
      </p>
    );
  }

  if (!help && maxLength == null) return null;

  return (
    <div className="mt-1 flex items-start justify-between gap-2 text-[11px] text-secondary">
      <span>{help}</span>
      {maxLength != null ? (
        <span className="shrink-0 tabular-nums">
          {String(value ?? "").length}/{maxLength}
        </span>
      ) : null}
    </div>
  );
}

function FormControl({
  field,
  value,
  error,
  onChange,
  required,
}) {
  const common = {
    id: `form-field-${field.name}`,
    name: field.name,
    disabled: field.disabled,
    readOnly: field.readonly,
    "aria-invalid": Boolean(error),
    "aria-describedby":
      error || field.help
        ? `form-field-${field.name}-message`
        : undefined,
  };

  if (field.type === "select") {
    return (
      <select
        {...common}
        value={value ?? ""}
        onChange={(event) => onChange(event.target.value)}
        className={[
          "erp-form-control w-full",
          error ? "erp-form-control-error" : "",
        ].join(" ")}
      >
        {!required ? <option value="">請選擇</option> : null}
        {(field.options ?? []).map((option) => (
          <option key={String(option.value)} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    );
  }

  if (field.type === "textarea") {
    return (
      <textarea
        {...common}
        rows={field.rows ?? 4}
        value={value ?? ""}
        maxLength={field.maxLength}
        placeholder={field.placeholder}
        onChange={(event) => onChange(event.target.value)}
        className={[
          "erp-form-control min-h-[96px] w-full resize-y py-2",
          error ? "erp-form-control-error" : "",
        ].join(" ")}
      />
    );
  }

  if (field.type === "checkbox") {
    return (
      <label className="erp-form-checkbox-row">
        <input
          id={common.id}
          name={common.name}
          type="checkbox"
          disabled={field.disabled}
          checked={Boolean(value)}
          onChange={(event) => onChange(event.target.checked)}
        />
        <span>{field.checkboxLabel ?? field.label}</span>
      </label>
    );
  }

  const input = (
    <input
      {...common}
      type={field.type === "number" ? "number" : field.type === "date" ? "date" : "text"}
      value={value ?? ""}
      min={field.min}
      max={field.max}
      step={field.step}
      minLength={field.minLength}
      maxLength={field.maxLength}
      placeholder={field.placeholder}
      onChange={(event) => onChange(event.target.value)}
      className={[
        "erp-form-control w-full",
        error ? "erp-form-control-error" : "",
      ].join(" ")}
    />
  );

  if (!field.prefix && !field.suffix) return input;

  return (
    <div className="erp-form-affix">
      {field.prefix ? (
        <span className="erp-form-affix-label">{field.prefix}</span>
      ) : null}
      {input}
      {field.suffix ? (
        <span className="erp-form-affix-label">{field.suffix}</span>
      ) : null}
    </div>
  );
}

function FormField({
  field,
  values,
  errors,
  onChange,
}) {
  if (!fieldVisible(field, values)) return null;

  const required = fieldRequired(field, values);
  const error = errors?.[field.name] ?? "";
  const value = values?.[field.name];

  return (
    <div
      className={field.span === 2 ? "erp-form-span-2" : ""}
      data-form-field={field.name}
    >
      {field.type !== "checkbox" ? (
        <label
          htmlFor={`form-field-${field.name}`}
          className="mb-1.5 flex items-center gap-1 text-sm font-medium"
        >
          <span>{field.label}</span>
          {required ? (
            <span className="text-danger" aria-label="必填">
              *
            </span>
          ) : null}
          {field.readonly ? (
            <Badge color="secondary" variant="soft" size="sm">
              唯讀
            </Badge>
          ) : null}
        </label>
      ) : (
        <div className="mb-1.5 text-sm font-medium">{field.label}</div>
      )}

      <FormControl
        field={field}
        value={value}
        error={error}
        required={required}
        onChange={(next) => onChange(field.name, next)}
      />

      <div id={`form-field-${field.name}-message`}>
        <FieldMessage
          error={error}
          help={field.help}
          maxLength={field.maxLength}
          value={value}
        />
      </div>
    </div>
  );
}

function formatSubmittedAt(value) {
  if (!value) return "";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  return new Intl.DateTimeFormat("zh-TW", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(date);
}

function ResultBanner({ result }) {
  if (!result?.message && !result?.title) return null;

  const success = result.status === "success";
  const submittedAt = formatSubmittedAt(result.submitted_at);

  return (
    <div
      className={[
        "erp-form-result",
        success ? "erp-form-result-success" : "erp-form-result-error",
      ].join(" ")}
      role={success ? "status" : "alert"}
    >
      <div
        className={[
          "erp-form-result-icon",
          success
            ? "erp-form-result-icon-success"
            : "erp-form-result-icon-error",
        ].join(" ")}
        aria-hidden="true"
      >
        {success ? "✓" : "!"}
      </div>

      <div className="min-w-0 flex-1">
        <div className="text-sm font-semibold">
          {result.title ?? (success ? "已儲存" : "無法儲存")}
        </div>
        {result.message ? (
          <div className="mt-0.5 text-xs text-secondary">{result.message}</div>
        ) : null}
        {submittedAt ? (
          <div className="mt-1 text-[11px] text-secondary">
            {success ? "最後儲存" : "最後嘗試"} {submittedAt}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function createSubmissionId() {
  if (globalThis.crypto?.randomUUID) {
    return globalThis.crypto.randomUUID();
  }

  return `form-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function FullscreenForm({
  view,
  activeAction,
  bridgeError,
  callTool,
  safeAreaInsets,
}) {
  const { presentation, data } = view;
  const form = presentation.form ?? {};
  const initialValues = useMemo(
    () => getPath(data, form.valuesPath, {}) ?? {},
    [data, form.valuesPath],
  );
  const result = getPath(data, form.resultPath, null);
  const fields = form.fields ?? [];
  const fieldsByName = useMemo(
    () => new Map(fields.map((field) => [field.name, field])),
    [fields],
  );

  const [values, setValues] = useState(initialValues);
  const [errors, setErrors] = useState(result?.errors ?? {});
  const [dirty, setDirty] = useState(result?.status === "error");
  const [localFeedback, setLocalFeedback] = useState(null);
  const submissionIdRef = useRef(result?.submission_id ?? null);

  const focusFirstError = (nextErrors) => {
    const name = Object.keys(nextErrors ?? {})[0];
    if (!name) return;

    requestAnimationFrame(() => {
      const field = document.querySelector(
        `[data-form-field="${name}"] input, [data-form-field="${name}"] select, [data-form-field="${name}"] textarea`,
      );
      field?.focus?.();
      field?.scrollIntoView?.({ block: "center", behavior: "smooth" });
    });
  };

  useEffect(() => {
    setValues(initialValues);
    setErrors(result?.errors ?? {});
    setDirty(result?.status === "error");
    setLocalFeedback(null);

    if (result?.status === "success") {
      submissionIdRef.current = null;
    } else if (result?.submission_id) {
      submissionIdRef.current = result.submission_id;
    }

    if (result?.status === "error" && result?.errors) {
      focusFirstError(result.errors);
    }
  }, [initialValues, result]);

  const updateField = (name, value) => {
    setValues((current) => ({
      ...current,
      [name]: value,
    }));
    setErrors((current) => {
      if (!current?.[name]) return current;
      const next = { ...current };
      delete next[name];
      return next;
    });
    setLocalFeedback(null);
    submissionIdRef.current = null;
    setDirty(true);
  };

  const submit = async (event) => {
    event.preventDefault();

    const nextErrors = validateForm(fields, values);
    setErrors(nextErrors);

    if (Object.keys(nextErrors).length > 0) {
      setLocalFeedback({
        status: "error",
        title: "尚有欄位需要修正",
        message: `有 ${Object.keys(nextErrors).length} 個欄位尚未完成，請修正後再儲存。`,
        errors: nextErrors,
      });
      focusFirstError(nextErrors);
      return;
    }

    if (!presentation.submit?.tool) return;

    if (!submissionIdRef.current) {
      submissionIdRef.current = createSubmissionId();
    }

    setLocalFeedback(null);

    await callTool(
      presentation.submit.tool,
      resolveArgs(presentation.submit.input ?? {}, {
        form: values,
        submissionId: submissionIdRef.current,
      }),
    );
  };

  const reset = () => {
    setValues(initialValues);
    setErrors(result?.errors ?? {});
    setLocalFeedback(null);
    submissionIdRef.current = null;
    setDirty(result?.status === "error");
  };

  const composerClearance = Math.max(
    112,
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
      <div className="mx-auto w-full max-w-5xl">
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
              {presentation.description ? (
                <p className="mt-1 text-xs text-secondary">
                  {presentation.description}
                </p>
              ) : null}
            </div>
          </div>

          {activeAction === presentation.submit?.tool ? (
            <Badge color="secondary" variant="soft" size="sm">
              儲存中…
            </Badge>
          ) : dirty ? (
            <Badge color="secondary" variant="soft" size="sm">
              尚未儲存
            </Badge>
          ) : result?.status === "success" ? (
            <Badge color="success" variant="soft" size="sm">
              已儲存
            </Badge>
          ) : null}
        </header>

        <form onSubmit={submit} noValidate>
          <div className="px-6 py-4">
            <ResultBanner result={localFeedback ?? result} />

            {(form.sections ?? []).map((section, index) => {
              const sectionFields = (section.fields ?? [])
                .map((name) => fieldsByName.get(name))
                .filter(Boolean)
                .filter((field) => fieldVisible(field, values));

              if (!sectionFields.length) return null;

              return (
                <section
                  key={section.id ?? index}
                  className={index > 0 ? "erp-form-section" : ""}
                >
                  <div className="mb-4">
                    <h2 className="text-sm font-semibold">{section.title}</h2>
                    {section.description ? (
                      <p className="mt-1 text-xs text-secondary">
                        {section.description}
                      </p>
                    ) : null}
                  </div>

                  <div className="erp-form-grid">
                    {sectionFields.map((field) => (
                      <FormField
                        key={field.name}
                        field={field}
                        values={values}
                        errors={errors}
                        onChange={updateField}
                      />
                    ))}
                  </div>
                </section>
              );
            })}
          </div>

          {bridgeError ? (
            <div className="border-t border-subtle px-6 py-2 text-xs text-danger">
              {bridgeError}
            </div>
          ) : null}

          <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-subtle bg-surface px-6 py-4">
            <span className="text-xs text-secondary">
              {presentation.footerText}
            </span>

            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="ghost"
                color="secondary"
                size="sm"
                disabled={!dirty}
                onClick={reset}
              >
                {presentation.resetLabel ?? "重設"}
              </Button>

              <Button
                type="submit"
                variant="solid"
                color="primary"
                size="md"
                pill={false}
                className="erp-brand-primary"
                disabled={!dirty && result?.status === "success"}
                loading={activeAction === presentation.submit?.tool}
              >
                {activeAction === presentation.submit?.tool
                  ? presentation.submit?.loadingLabel ?? "儲存中…"
                  : !dirty && result?.status === "success"
                    ? presentation.submit?.successLabel ?? "已儲存"
                    : presentation.submit?.label ?? "儲存變更"}
              </Button>
            </div>
          </footer>
        </form>
      </div>
    </main>
  );
}

export function FormRenderer(props) {
  if (props.displayMode === "fullscreen") {
    return <FullscreenForm {...props} />;
  }

  return <InlineForm {...props} />;
}
