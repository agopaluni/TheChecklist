import Link from "next/link";
import { MyEvents } from "@/components/MyEvents";
import { PlusIcon } from "@/components/icons";
import { Wordmark } from "@/components/Wordmark";

export default function Home() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-xl flex-col px-5 pt-[max(1.5rem,env(safe-area-inset-top))]">
      <header className="pt-6 pb-8">
        <Wordmark />
        <h1 className="mt-8 font-display text-[2.6rem] leading-[1.02] font-extrabold tracking-tight text-balance">
          One list for everything everyone&rsquo;s bringing.
        </h1>
        <p className="mt-3 max-w-md text-[17px] text-muted">
          Start an event, send the link, and see who&rsquo;s got the tent, the snacks and the
          speaker. No sign-up needed.
        </p>
      </header>

      <MyEvents />

      <p className="pb-4 text-center text-[13px] text-muted">
        <Link href="/privacy" className="hover:underline">Privacy</Link>
        <span aria-hidden> · </span>
        <Link href="/terms" className="hover:underline">Terms</Link>
      </p>

      <div className="bottom-safe sticky bottom-0 mt-auto -mx-5 bg-gradient-to-t from-paper via-paper to-transparent px-5 pt-6">
        <Link
          href="/new"
          className="flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl bg-accent text-[17px] font-semibold text-accent-ink shadow-[0_6px_18px_-8px_var(--accent)] active:scale-[0.98]"
        >
          <PlusIcon /> Start an event
        </Link>
      </div>
    </main>
  );
}
