export function getEnv(name: string): string | undefined {
  const value = process.env[name];
  return typeof value === 'string' && value.trim().length > 0 ? value : undefined;
}

export function requireEnv(name: string): string {
  const value = getEnv(name);
  if (!value) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value;
}

export function getGeminiApiKey(): string | undefined {
  return (
    getEnv('GEMINI_API_KEY') ||
    getEnv('GOOGLE_AI_API_KEY') ||
    getEnv('GOOGLE_GENERATIVE_AI_API_KEY') ||
    getEnv('GOOGLE_API_KEY')
  );
}

