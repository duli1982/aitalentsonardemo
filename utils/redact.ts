const SENSITIVE_KEY_RE = /(key|token|secret|password|authorization|cookie)/i;

export function redactForDebugBundle(input: unknown): unknown {
  const seen = new WeakSet<object>();
  const replacer = (_key: string, value: unknown) => {
    if (value && typeof value === 'object') {
      if (seen.has(value as object)) return '[Circular]';
      seen.add(value as object);
    }
    return value;
  };

  try {
    const json = JSON.stringify(input, (key, value) => {
      if (SENSITIVE_KEY_RE.test(key)) return '[REDACTED]';
      return replacer(key, value);
    });
    if (!json) return input;
    return JSON.parse(json);
  } catch {
    return '[Unserializable input]';
  }
}

export function summarizeRedactedInput(input: unknown, maxChars = 1200): string {
  const redacted = redactForDebugBundle(input);
  try {
    const json = JSON.stringify(redacted, null, 2) ?? '';
    if (json.length <= maxChars) return json;
    return `${json.slice(0, maxChars)}\n…(truncated)…`;
  } catch {
    return String(redacted);
  }
}

