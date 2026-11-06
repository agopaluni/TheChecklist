import type { Metadata } from "next";
import { LegalPage } from "@/components/LegalPage";

export const metadata: Metadata = { title: "Privacy" };

export default function Privacy() {
  return (
    <LegalPage title="Privacy" updated="November 6, 2026">
      <p>
        TheChecklist is a shared bring-list for events. It&rsquo;s built to collect as little as
        possible. Here is everything it stores and why.
      </p>

      <h2>What we store</h2>
      <ul>
        <li>
          <strong>Events and lists:</strong> the event name, dates, place and note, the names of
          people on the list, and the items, quantities and notes people add.
        </li>
        <li>
          <strong>Guests:</strong> the first name you choose, plus a random device code saved in
          your browser. We only keep a one-way scrambled (hashed) copy of that code, which lets
          this device stay &ldquo;you&rdquo; in an event.
        </li>
        <li>
          <strong>Google sign-in (optional):</strong> if you sign in with Google, our sign-in
          provider (Supabase Auth) receives your Google account&rsquo;s basic profile, including
          your email address, to create your account. The app links that account to the names you
          picked using only an account id. Your email is never shown to other people in an event.
        </li>
      </ul>

      <h2>What we don&rsquo;t do</h2>
      <ul>
        <li>No ads, no tracking or analytics, and no selling or sharing of data.</li>
        <li>No phone numbers, addresses or payment details.</li>
      </ul>

      <h2>Who can see what</h2>
      <p>
        Anyone with an event&rsquo;s link can see and edit that event&rsquo;s list and the first
        names on it. Nobody can browse events they don&rsquo;t have the link to.
      </p>

      <h2>Where it lives</h2>
      <p>
        The app is hosted on Vercel, and the data is stored with Supabase in the United States.
        Your browser keeps your device code and a copy of lists you&rsquo;ve opened, so they still
        load offline.
      </p>

      <h2>Deleting your data</h2>
      <p>
        Whoever started an event can delete it, which removes its list and names for everyone. You
        can release your name from an event at any time. Clearing your browser&rsquo;s site data
        removes your device code. To delete a Google-linked account or anything else, contact the
        person who runs this app through the support email shown when you sign in with Google.
      </p>

      <h2>Changes</h2>
      <p>If this policy changes, this page will be updated and the date above will change.</p>
    </LegalPage>
  );
}
