import type { NewItem, Participant } from "./types";

// "Chips x2", "chips ×3", "2x chips" -> { name: "Chips", quantity: "2" }.
// Anything else is kept as typed ("2 bags of ice" stays a name).
export function parseItemLine(line: string): NewItem | null {
  const text = line
    .trim()
    .replace(/^(?:[-*•·]|\[\s?\]|\d+[.)])\s+/, "") // list bullets, checkboxes, "1."
    .trim();
  if (!text) return null;
  const trailing = text.match(/^(.+?)\s*[x×]\s*(\d{1,4})$/i);
  if (trailing) return { name: trailing[1].trim(), quantity: trailing[2] };
  const leading = text.match(/^(\d{1,4})\s*[x×]\s+(.+)$/i);
  if (leading) return { name: leading[2].trim(), quantity: leading[1] };
  return { name: text };
}

export function parseItemLines(text: string): NewItem[] {
  return text
    .split(/\r?\n/)
    .map(parseItemLine)
    .filter((i): i is NewItem => i !== null)
    .map((i) => ({ ...i, name: i.name.slice(0, 120) }));
}

// Edit distance where swapping two neighbouring letters (Pryia / Priya) counts as one typo.
function distance(a: string, b: string): number {
  const d = Array.from({ length: a.length + 1 }, (_, i) =>
    Array.from({ length: b.length + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)),
  );
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
      }
    }
  }
  return d[a.length][b.length];
}

const norm = (s: string) => s.trim().toLowerCase().normalize("NFD").replace(/\p{M}/gu, "");

// "Did you mean Priya?" Catches typos (Pryia), nicknames that start the same
// (Mark / Marcus), and the same first name with an initial (Sam / Sam K).
export function closeMatch(name: string, people: Participant[]): Participant | null {
  const n = norm(name);
  if (n.length < 2) return null;
  for (const p of people) {
    const m = norm(p.display_name);
    if (m === n) return p;
    const first = (s: string) => s.split(/\s+/)[0];
    if (first(m) === first(n)) return p;
    if (n.length >= 3 && m.length >= 3 && (m.startsWith(n) || n.startsWith(m))) return p;
    if (distance(n, m) <= (Math.max(n.length, m.length) > 5 ? 2 : 1)) return p;
  }
  return null;
}

export function formatDate(date: string | null): string | null {
  if (!date) return null;
  const d = new Date(date + "T12:00:00");
  const sameYear = d.getFullYear() === new Date().getFullYear();
  return d.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    ...(sameYear ? {} : { year: "numeric" }),
  });
}

export const initial = (name: string) => name.trim().charAt(0).toUpperCase();
