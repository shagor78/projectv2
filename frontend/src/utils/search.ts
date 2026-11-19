export type ClientSearchField =
  | string
  | number
  | null
  | undefined
  | Array<string | number | null | undefined>;

export function normalizeClientQuery(raw: string): string {
  return raw.trim().replace(/\s+/g, ' ').toLowerCase();
}

/**
 * Case-insensitive, whitespace-trimmed, partial/substring and multi-token search matcher.
 * Returns true if the normalized query matches as a substring or all tokens appear
 * across the primary text or related metadata fields.
 */
export function matchesClientSearch(
  rawQuery: string,
  primaryText: string | null | undefined,
  relatedFields: ClientSearchField[] = []
): boolean {
  const normalized = normalizeClientQuery(rawQuery);
  if (!normalized) return true;

  const parts: string[] = [];
  if (primaryText) {
    parts.push(String(primaryText).trim().replace(/\s+/g, ' ').toLowerCase());
  }

  for (const field of relatedFields) {
    if (field === null || field === undefined) continue;
    if (Array.isArray(field)) {
      for (const item of field) {
        if (item !== null && item !== undefined) {
          const clean = String(item).trim().replace(/\s+/g, ' ').toLowerCase();
          if (clean) parts.push(clean);
        }
      }
    } else {
      const clean = String(field).trim().replace(/\s+/g, ' ').toLowerCase();
      if (clean) parts.push(clean);
    }
  }

  if (parts.some((p) => p.includes(normalized))) {
    return true;
  }

  const tokens = normalized.split(' ').filter(Boolean);
  if (tokens.length <= 1) return false;

  const combined = parts.join(' ');
  return tokens.every((tok) => combined.includes(tok));
}
