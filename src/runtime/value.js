export function getPath(source, path, fallback = null) {
  if (!path) return source ?? fallback;

  const parts = String(path).split(".");
  let current = source;

  for (const part of parts) {
    if (current == null) return fallback;

    if (part === "length" && Array.isArray(current)) {
      current = current.length;
      continue;
    }

    current = current[part];
  }

  return current ?? fallback;
}

export function formatValue(value, descriptor = {}) {
  if (value === null || value === undefined || value === "") return "";

  if (descriptor.format === "integer") {
    return new Intl.NumberFormat("zh-TW", {
      maximumFractionDigits: 0,
    }).format(Number(value));
  }

  if (descriptor.format === "number") {
    return new Intl.NumberFormat("zh-TW", {
      maximumFractionDigits: descriptor.maximumFractionDigits ?? 2,
      minimumFractionDigits: descriptor.minimumFractionDigits ?? 0,
    }).format(Number(value));
  }

  if (descriptor.format === "percent") {
    const formatted = new Intl.NumberFormat("zh-TW", {
      maximumFractionDigits: descriptor.maximumFractionDigits ?? 2,
      minimumFractionDigits: descriptor.minimumFractionDigits ?? 0,
    }).format(Number(value));

    return `${formatted}%`;
  }

  if (descriptor.format === "currency" && descriptor.currency) {
    return new Intl.NumberFormat("zh-TW", {
      style: "currency",
      currency: descriptor.currency,
      maximumFractionDigits: descriptor.maximumFractionDigits ?? 2,
    }).format(Number(value));
  }

  return String(value);
}

export function fieldValue(record, descriptor) {
  if (!descriptor) return "";

  const value = getPath(record, descriptor.field);
  if (value === null || value === undefined || value === "") {
    return descriptor.fallback ?? "";
  }

  return `${descriptor.prefix ?? ""}${formatValue(value, descriptor)}${descriptor.suffix ?? ""}`;
}

export function lineValue(record, descriptor) {
  if (!descriptor?.fields?.length) return "";

  return descriptor.fields
    .map((field) => fieldValue(record, field))
    .filter((value) => value !== "")
    .join(descriptor.separator ?? " · ");
}

export function resolveArgs(template, context = {}) {
  if (Array.isArray(template)) {
    return template.map((value) => resolveArgs(value, context));
  }

  if (template && typeof template === "object") {
    return Object.fromEntries(
      Object.entries(template).map(([key, value]) => [
        key,
        resolveArgs(value, context),
      ]),
    );
  }

  if (template === "$selection") {
    return context.selection ?? [];
  }

  return template;
}

export function interpolate(template, values = {}) {
  return String(template ?? "").replace(
    /\{([^}]+)\}/g,
    (_, key) => values[key] ?? "",
  );
}
