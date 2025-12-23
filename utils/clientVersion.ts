export function getClientVersion(): string {
  const injected = (import.meta as any)?.env?.VITE_APP_VERSION;
  if (typeof injected === 'string' && injected.trim()) return injected.trim();
  return `${(import.meta as any)?.env?.MODE ?? 'unknown'}:${(import.meta as any)?.env?.DEV ? 'dev' : 'prod'}`;
}

