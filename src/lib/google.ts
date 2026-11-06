// Google Identity Services: Google's own sign-in button and popup. Unlike the redirect
// flow, which tells people they're continuing to "<project>.supabase.co", the popup names
// this site. The ID token it returns is traded for a Supabase session.
import { supabase } from "./supabase";

export const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? "";

type CredentialResponse = { credential: string };
type GoogleId = {
  initialize(options: Record<string, unknown>): void;
  renderButton(parent: HTMLElement, options: Record<string, unknown>): void;
};
declare global {
  interface Window {
    google?: { accounts?: { id?: GoogleId } };
  }
}

let loading: Promise<GoogleId> | null = null;

function load(): Promise<GoogleId> {
  loading ??= new Promise<GoogleId>((resolve, reject) => {
    if (window.google?.accounts?.id) return resolve(window.google.accounts.id);
    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.onload = () =>
      window.google?.accounts?.id ? resolve(window.google.accounts.id) : reject(new Error("gsi missing"));
    script.onerror = () => reject(new Error("gsi blocked"));
    document.head.append(script);
    // Content blockers sometimes swallow the script without an error event.
    setTimeout(() => reject(new Error("gsi timeout")), 8000);
  }).catch((err) => {
    loading = null;
    throw err;
  });
  return loading;
}

function randomNonce(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(24));
  return btoa(String.fromCharCode(...bytes)).replace(/[+/=]/g, "");
}

async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Draws Google's button into `parent`. `onSignedIn` runs once Supabase has a session.
 * Resolves false when Google's script can't load, so the caller can show the
 * redirect button instead.
 */
export async function renderGoogleButton(
  parent: HTMLElement,
  onSignedIn: () => void,
  onError: () => void,
): Promise<boolean> {
  if (!GOOGLE_CLIENT_ID) return false;
  let gid: GoogleId;
  try {
    gid = await load();
  } catch {
    return false;
  }
  // Google gets the hash of the nonce; Supabase checks the raw value against it.
  const nonce = randomNonce();
  gid.initialize({
    client_id: GOOGLE_CLIENT_ID,
    nonce: await sha256Hex(nonce),
    callback: async ({ credential }: CredentialResponse) => {
      const { error } = await supabase().auth.signInWithIdToken({
        provider: "google",
        token: credential,
        nonce,
      });
      if (error) onError();
      else onSignedIn();
    },
    ux_mode: "popup",
    auto_select: false,
    itp_support: true,
    use_fedcm_for_button: true,
  });
  const dark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  parent.replaceChildren();
  gid.renderButton(parent, {
    type: "standard",
    theme: dark ? "filled_black" : "outline",
    size: "large",
    shape: "pill",
    text: "signin_with",
    logo_alignment: "center",
    width: Math.min(400, Math.max(220, parent.clientWidth || 300)),
  });
  return true;
}
