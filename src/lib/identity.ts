// A guest's identity is one random token kept in this browser. The database only ever
// sees its sha256 hash, attached to the person they picked in each event.
const TOKEN_KEY = "tc:device-token";

export function deviceToken(): string {
  let token = localStorage.getItem(TOKEN_KEY);
  if (!token) {
    const bytes = crypto.getRandomValues(new Uint8Array(32));
    token = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
    localStorage.setItem(TOKEN_KEY, token);
  }
  return token;
}

// Arriving from an old address: it put that browser's guest token in the #fragment.
// Returns it once and removes it from the address bar.
export function takeHandoffToken(): string | null {
  const match = location.hash.match(/[#&]handoff=([^&]+)/);
  if (!match) return null;
  history.replaceState(history.state, "", location.pathname + location.search);
  const old = decodeURIComponent(match[1]);
  return /^[0-9a-f]{64}$/.test(old) ? old : null;
}

// Remembers who someone picked while they're away signing in with Google.
const PENDING_KEY = "tc:pending-join";

export type PendingJoin =
  | { slug: string; kind: "claim"; participantId: string; name: string }
  | { slug: string; kind: "new"; name: string };

export function setPendingJoin(join: PendingJoin) {
  sessionStorage.setItem(PENDING_KEY, JSON.stringify(join));
}

export function takePendingJoin(slug: string): PendingJoin | null {
  const raw = sessionStorage.getItem(PENDING_KEY);
  if (!raw) return null;
  const join = JSON.parse(raw) as PendingJoin;
  if (join.slug !== slug) return null;
  sessionStorage.removeItem(PENDING_KEY);
  return join;
}
