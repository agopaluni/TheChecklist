import type { Metadata } from "next";
import { Wordmark } from "@/components/Wordmark";

export const metadata: Metadata = { title: "Offline" };

export default function Offline() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-xl flex-col items-start justify-center px-6">
      <Wordmark />
      <h1 className="mt-6 font-display text-3xl font-extrabold tracking-tight">You&rsquo;re offline</h1>
      <p className="mt-2 text-muted">
        This page hasn&rsquo;t been opened on this device yet, so there&rsquo;s nothing saved to show.
        Lists you&rsquo;ve opened before still work offline. Everything syncs when you&rsquo;re back.
      </p>
    </main>
  );
}
