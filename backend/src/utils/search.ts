export type SearchFieldValue =
  | string
  | number
  | null
  | undefined
  | Array<string | number | null | undefined>;

/**
 * Trims leading/trailing whitespace and collapses internal runs of whitespace
 * into single spaces so queries like "  samsung   galaxy  " normalize cleanly.
 */
export function normalizeSearchQuery(raw: unknown): string {
  if (typeof raw !== 'string') return '';
  return raw.trim().replace(/\s+/g, ' ');
}

/**
 * Escapes SQL LIKE/ILIKE wildcard characters (`\`, `%`, `_`) so user input
 * containing those characters matches literally.
 */
export function escapeLikePattern(value: string): string {
  return value.replace(/[\\%_]/g, '\\$&');
}

/**
 * Splits a normalized query into unique lowercase search terms.
 */
export function tokenizeSearchQuery(normalizedQuery: string): string[] {
  if (!normalizedQuery) return [];
  return Array.from(
    new Set(
      normalizedQuery
        .toLowerCase()
        .split(' ')
        .map((t) => t.trim())
        .filter(Boolean)
    )
  );
}

function flattenSearchFields(fields: SearchFieldValue[]): string[] {
  const out: string[] = [];
  for (const field of fields) {
    if (field === null || field === undefined) continue;
    if (Array.isArray(field)) {
      for (const item of field) {
        if (item !== null && item !== undefined) {
          const text = String(item).trim().toLowerCase();
          if (text) out.push(text);
        }
      }
    } else {
      const text = String(field).trim().toLowerCase();
      if (text) out.push(text);
    }
  }
  return out;
}

/**
 * Case-insensitive, partial/substring, and multi-word token search matcher
 * with relevance scoring across primary and related metadata fields.
 */
export function matchesSearchFields(
  rawQuery: string,
  primaryText: string | null | undefined,
  secondaryFields: SearchFieldValue[] = []
): { matches: boolean; score: number } {
  const normalized = normalizeSearchQuery(rawQuery);
  if (!normalized) return { matches: true, score: 0 };

  const qLower = normalized.toLowerCase();
  const tokens = tokenizeSearchQuery(normalized);
  const primary = String(primaryText || '')
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase();
  const secondaries = flattenSearchFields(secondaryFields).map((s) =>
    s.replace(/\s+/g, ' ')
  );

  // 1. Exact or phrase substring match on primary title/name
  if (primary === qLower) return { matches: true, score: 1000 };
  if (primary.startsWith(qLower)) return { matches: true, score: 850 };
  if (primary.includes(qLower)) return { matches: true, score: 700 };

  // 2. Full phrase substring match in any secondary field (category, director, tags, cast, etc.)
  if (secondaries.some((s) => s.includes(qLower))) {
    return { matches: true, score: 500 };
  }

  // 3. Multi-word token match: all tokens exist in primary text (even out-of-order or gapped)
  if (tokens.length > 1 && tokens.every((tok) => primary.includes(tok))) {
    return { matches: true, score: 400 };
  }

  // 4. Multi-word token match across combined primary + related fields
  const combined = [primary, ...secondaries].filter(Boolean).join(' ');
  if (tokens.length > 0 && tokens.every((tok) => combined.includes(tok))) {
    return { matches: true, score: 250 };
  }

  return { matches: false, score: 0 };
}
