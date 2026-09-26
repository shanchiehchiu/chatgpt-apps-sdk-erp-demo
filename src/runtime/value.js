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

export function fieldValue(record, descriptor) {
  if (!descriptor) return "";

  const value = getPath(record, descriptor.field);
  if (value === null || value === undefined || value === "") {
    return descriptor.fallback ?? "";
  }

  return `${descriptor.prefix ?? ""}${value}${descriptor.suffix ?? ""}`;
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
