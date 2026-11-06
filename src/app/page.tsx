import Link from "next/link";
import { MyEvents } from "@/components/MyEvents";
import { PlusIcon } from "@/components/icons";
import { Wordmark } from "@/components/Wordmark";

const steps = [
  ["Start an event", "A trip, a potluck, game night."],
  ["Send the link", "Friends tap their name. No sign-up."],
  ["Everyone grabs something", "See who's bringing what, live."],
];

export default function Home() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-xl flex-col px-5 pt-[max(1.5rem,env(safe-area-inset-top))] lg:max-w-6xl lg:px-10">
      <div className="lg:grid lg:flex-1 lg:grid-cols-[1.15fr_1fr] lg:items-center lg:gap-16 lg:py-12">
        <header className="pt-6 pb-8 lg:pt-0 lg:pb-0">
          <Wordmark />
          <h1 className="mt-8 font-display text-[2.6rem] leading-[1.02] font-extrabold tracking-tight text-balance lg:mt-14 lg:text-[4.25rem] lg:leading-[0.98]">
            One list for everything everyone&rsquo;s bringing.
          </h1>
          <p className="mt-3 max-w-md text-[17px] text-muted lg:mt-6 lg:text-[19px]">
            Start an event, send the link, and see who&rsquo;s got the tent, the snacks and the
            speaker. No sign-up needed.
          </p>
          <Link
            href="/new"
            className="mt-9 hidden min-h-14 items-center gap-2 rounded-2xl bg-accent px-7 text-[17px] font-semibold text-accent-ink shadow-[0_6px_18px_-8px_var(--accent)] transition hover:brightness-105 active:scale-[0.98] lg:inline-flex"
          >
            <PlusIcon /> Start an event
          </Link>
          <ol className="mt-14 hidden gap-6 lg:grid lg:grid-cols-3">
            {steps.map(([title, text], i) => (
              <li key={title}>
                <span className="font-display text-[15px] font-extrabold text-accent">0{i + 1}</span>
                <p className="mt-1 text-[15px] font-semibold">{title}</p>
                <p className="mt-0.5 text-[14px] text-muted">{text}</p>
              </li>
            ))}
          </ol>
        </header>

        <div className="lg:rounded-[2rem] lg:border lg:border-line lg:bg-card lg:p-8 lg:shadow-[0_20px_60px_-30px_rgba(0,0,0,0.25)]">
          <MyEvents />
        </div>
      </div>

      <p className="pb-4 text-center text-[13px] text-muted lg:pb-8">
        <Link href="/privacy" className="hover:underline">Privacy</Link>
        <span aria-hidden> · </span>
        <Link href="/terms" className="hover:underline">Terms</Link>
      </p>

      <div className="bottom-safe sticky bottom-0 mt-auto -mx-5 bg-gradient-to-t from-paper via-paper to-transparent px-5 pt-6 lg:hidden">
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
