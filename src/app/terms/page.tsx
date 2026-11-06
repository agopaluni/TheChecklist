import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage } from "@/components/LegalPage";

export const metadata: Metadata = { title: "Terms" };

export default function Terms() {
  return (
    <LegalPage title="Terms" updated="November 6, 2026">
      <p>TheChecklist is a free tool for planning who brings what. By using it, you agree to these terms.</p>
      <h2>Using it</h2>
      <ul>
        <li>Anyone with an event&rsquo;s link can view and edit its list, so only share links with people you trust.</li>
        <li>Don&rsquo;t put sensitive personal information in event names, notes or items.</li>
        <li>Don&rsquo;t use it for anything illegal, abusive or spammy.</li>
      </ul>
      <h2>No guarantees</h2>
      <p>
        TheChecklist is provided as is, without warranties. It may change, pause or stop, and lists
        may be lost. Keep your own copy of anything important.
      </p>
      <h2>Your content</h2>
      <p>
        What you add stays yours. You allow the app to store and show it to people who have the
        event&rsquo;s link. Event creators can remove people, items or the whole event.
      </p>
      <p>
        See the <Link className="font-semibold underline" href="/privacy">privacy page</Link> for what&rsquo;s stored.
      </p>
    </LegalPage>
  );
}
