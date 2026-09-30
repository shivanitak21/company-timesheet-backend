export function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function isDuplicateKeyError(err: unknown): err is { code: number; keyPattern?: Record<string, number> } {
  return typeof err === 'object' && err !== null && 'code' in err && (err as { code?: number }).code === 11000;
}
