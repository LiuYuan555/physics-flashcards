import { stemmer } from 'stemmer';

// Tokenize: lowercase, strip punctuation, split on whitespace, drop tokens ≤ 2 chars.
function tokenize(s) {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(t => t.length > 2);
}

// All keywords must appear (strict). Returns { ok, missing }.
// keywords is string[], each keyword compared after stemming.
export function grade(userText, keywords) {
  if (!keywords || keywords.length === 0) return { ok: false, missing: [] };
  const userStems = new Set(tokenize(userText).map(stemmer));
  const missing = keywords.filter(k => !userStems.has(stemmer(k.toLowerCase())));
  return { ok: missing.length === 0, missing };
}
