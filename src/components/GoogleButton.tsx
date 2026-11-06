"use client";

import { useEffect, useRef, useState } from "react";
import { signInWithGoogle } from "@/lib/auth";
import { renderGoogleButton } from "@/lib/google";
import { GoogleIcon } from "./icons";
import { useToast } from "./ui";

// Google's own button (popup that names this site). If Google's script is blocked,
// falls back to our button and the redirect flow through Supabase.
export function GoogleButton({
  onSignedIn,
  beforeRedirect,
}: {
  onSignedIn?: () => void;
  beforeRedirect?: () => void;
}) {
  const slot = useRef<HTMLDivElement>(null);
  const [fallback, setFallback] = useState(false);
  const toast = useToast();
  const signedIn = useRef(onSignedIn);
  useEffect(() => {
    signedIn.current = onSignedIn;
  });

  useEffect(() => {
    if (!slot.current) return;
    let cancelled = false;
    renderGoogleButton(
      slot.current,
      () => signedIn.current?.(),
      () => toast("Google sign-in didn't go through. Try again."),
    ).then((ok) => !ok && !cancelled && setFallback(true));
    return () => {
      cancelled = true;
    };
  }, [toast]);

  if (fallback) {
    return (
      <button
        type="button"
        onClick={() => {
          beforeRedirect?.();
          signInWithGoogle().catch(() => toast("Couldn't open Google. Check your connection."));
        }}
        className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-full border border-line bg-card px-5 text-[16px] font-semibold"
      >
        <GoogleIcon /> Sign in with Google
      </button>
    );
  }
  // color-scheme: light stops the browser painting a white box behind Google's iframe
  // when the page is in dark mode.
  return <div ref={slot} style={{ colorScheme: "light" }} className="flex min-h-11 w-full justify-center" />;
}
