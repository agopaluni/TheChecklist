"use client";

import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { api } from "./api";
import { supabase } from "./supabase";

export type AuthState = { ready: boolean; user: User | null };

let linking: Promise<unknown> | null = null;

// After Google sign-in, fold this device's guest spots into the account (once per load).
export function ensureGuestLinked(): Promise<unknown> {
  linking ??= api.linkGuestToAccount().catch(() => {
    linking = null;
  });
  return linking;
}

export function useAuth(): AuthState {
  const [state, setState] = useState<AuthState>({ ready: false, user: null });
  useEffect(() => {
    const { data } = supabase().auth.onAuthStateChange((event, session) => {
      const user = session?.user ?? null;
      if (!user) {
        linking = null;
        setState({ ready: true, user: null });
        return;
      }
      // Defer: supabase-js warns against awaiting other calls inside this callback.
      setTimeout(async () => {
        await ensureGuestLinked();
        setState({ ready: true, user });
      }, 0);
    });
    return () => data.subscription.unsubscribe();
  }, []);
  return state;
}

export async function signInWithGoogle(returnTo = window.location.href) {
  const { error } = await supabase().auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: returnTo },
  });
  if (error) throw error;
}

export async function signOut() {
  await supabase().auth.signOut();
}
