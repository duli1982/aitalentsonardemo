export function getEnv(name: string): string | undefined {
  const value = process.env[name];
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

export function getGeminiApiKey(): string | undefined {
  return getEnv('GEMINI_API_KEY') || getEnv('GOOGLE_API_KEY');
}
