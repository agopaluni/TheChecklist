# TheChecklist

A shared bring-list for events. Someone starts an event (a trip, a potluck, a camping weekend), sends the link, and everyone sees one list of what's needed and who's bringing it.

- **No sign-up.** Open the link, tap "I'm Priya" (or "I'm someone new"), and you're in as a guest on that device.
- **Outstanding items** sit at the top until someone taps "I'll bring this".
- **Check things off** when they're packed or bought, with progress per person and for the whole event.
- **Live.** Everyone viewing the event sees changes as they happen.
- **Optional Google sign-in** keeps your identity across devices and lists all your events in one place.
- **Installable PWA.** Add it to a phone's home screen, and lists you've opened still load offline.

Built with Next.js (App Router, TypeScript), Tailwind CSS 4 and Supabase (Postgres, Realtime, Auth). Deploys to Vercel.

## Run it locally

You need Node 20+, Docker (or [colima](https://github.com/abiosoft/colima)), and the [Supabase CLI](https://supabase.com/docs/guides/local-development/cli/getting-started).

```bash
npm install
supabase start          # starts Postgres, Auth and Realtime in Docker, applies the migration
cp .env.example .env.local
```

Put the `API_URL` and `PUBLISHABLE_KEY` that `supabase start` (or `supabase status`) prints into `.env.local`, then:

```bash
npm run dev
```

Open http://localhost:3000. Supabase Studio, a database browser, runs at http://127.0.0.1:54323.

To try two people on one computer, use separate browser profiles or origins. `localhost:3000`, `127.0.0.1:3000` and `anything.localhost:3000` each get their own storage, so each counts as a separate device. The dev server only serves hot reload to `localhost`, so for the other origins run `npm run build && npm start`. The service worker is also registered only in production builds.

### Environment variables

| Variable | Where | What |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | app | Supabase API URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | app | Publishable key (the legacy `anon` key also works) |
| `NEXT_PUBLIC_GOOGLE_SIGN_IN` | app | `true` shows the Google options. Leave it `false` until Google is configured. |
| `NEXT_PUBLIC_GOOGLE_CLIENT_ID` | app | The Google OAuth client id (public). Turns on Google's own sign-in button, so the popup names your site instead of `<project>.supabase.co`. |
| `SUPABASE_SECRET_KEY` | tests only | Lets `npm run test:db` create a throwaway user for the Google-merge test. Never ship it. |

### Tests

```bash
npm run test:db
```

These tests call the same database functions the app calls, against your running Supabase. They cover the claim rules: one claim per person, including eight simultaneous taps on the same name; one person per device or account per event; self release vs. creator release; removed people's items going back to Outstanding; atomic "I'll bring this"; only the owner can check an item off; list order; and the Google merge. Add `SUPABASE_SECRET_KEY=...` before the command to include the merge test.

## Google sign-in

1. In Google Cloud Console, create an OAuth client of type **Web application**. Add an authorized redirect URI:
   - local: `http://127.0.0.1:54321/auth/v1/callback`
   - hosted: `https://<project-ref>.supabase.co/auth/v1/callback`
2. **Local:** put the client id and secret in `supabase/.env`:
   ```
   SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID=...
   SUPABASE_AUTH_EXTERNAL_GOOGLE_SECRET=...
   ```
   Then set `enabled = true` under `[auth.external.google]` in `supabase/config.toml` and run `supabase stop && supabase start`.
   **Hosted:** Dashboard → Authentication → Providers → Google: paste the client id and secret.
3. Add your app URLs to Supabase's redirect allow list (Authentication → URL Configuration), e.g. `https://your-app.vercel.app/**`. Locally, `config.toml` already allows `http://localhost:3000/**`.
4. Set `NEXT_PUBLIC_GOOGLE_SIGN_IN=true` and `NEXT_PUBLIC_GOOGLE_CLIENT_ID=<client id>`. Add every origin the app runs on (e.g. `http://localhost:3000`) to the client's **Authorized JavaScript origins**.

The app uses Google's own button (Google Identity Services). Its popup says you're signing in to your site, and the ID token it returns is exchanged for a Supabase session with `signInWithIdToken`, using a nonce. If an ad blocker stops Google's script, the app falls back to the redirect flow through Supabase, which shows the `<project>.supabase.co` address.

When a guest signs in, their guest spots on that device move onto the Google account (`link_guest_to_account`). If the account already holds a different person in the same event, the account's person wins and the device's guest spot goes back to unclaimed, because a person can only be one participant per event. Other participants never see email addresses. The app's tables store only the Supabase auth user id.

## Deploy (Vercel + hosted Supabase)

1. Create a Supabase project, then push the schema:
   ```bash
   supabase link --project-ref <project-ref>
   supabase db push
   ```
2. Import the repo into Vercel and set `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` and (once Google is set up) `NEXT_PUBLIC_GOOGLE_SIGN_IN=true`.
3. In Supabase → Authentication → URL Configuration, set the Site URL to your Vercel URL and add `https://<your-domain>/**` to the redirect URLs.

## How it works

**Everything goes through Postgres functions.** The browser can't read or write the tables directly: row level security is on with no policies, and table privileges are revoked. It calls `security definer` functions in [`supabase/migrations`](supabase/migrations/20261106000000_init.sql) that enforce the rules. Anyone with an event's slug can read and edit it, but nobody can list events they don't belong to. A future native app can call the same functions.

**Data model**

| Table | Columns |
| --- | --- |
| `events` | id, slug, name, date, location, note, created_by (participant), created_at |
| `participants` | id, event_id, display_name, is_claimed, created_at |
| `claims` | participant_id (PK), event_id, guest_token_hash, user_id |
| `items` | id, event_id, name, quantity, note, assigned_to (null = Outstanding), is_checked, created_by, created_at, position |

One change from the original sketch: who claimed a person lives in a separate `claims` table instead of on `participants`. That keeps identity out of everything the browser receives, so guests never see each other's tokens or account ids. `participants.is_claimed` is kept in sync by a trigger.

**Claim rules**, enforced by constraints rather than by UI checks:

- `claims.participant_id` is the primary key, so a person can be claimed once. Two people tapping the same name at the same moment race on that key; one insert wins and the other gets `already_claimed`.
- `unique (event_id, guest_token_hash)` and `unique (event_id, user_id)` mean one device or one account holds at most one person per event.
- Releasing deletes the claim row. The person and their items stay put. Only the person themselves or the event creator can release a spot. The creator's own spot can't be released.

**Guests** get a random 256-bit device token in `localStorage`. The database stores only its SHA-256 hash.

**Live updates.** A trigger on `events`, `participants` and `items` calls `realtime.send()` on the public broadcast channel `event:<event id>` with a tiny "changed" message that carries no data. Clients refetch the event when they hear it, and also on reconnect, tab focus and coming back online.

**Offline.** `public/sw.js` serves pages network-first with a cache fallback, and build assets cache-first. The event page keeps its last copy in `localStorage`, so a list you've opened still shows offline, with an "offline" banner.

## Known limits

- If a guest **event creator** loses their device, nobody can release spots or edit the event. The creator should sign in with Google to avoid that; the app offers it in the event menu.
- There's no rate limiting beyond Supabase's defaults. Anyone with a link can edit that event's list. That's by design.
- Realtime channels are public but keyed by the event's UUID. Someone who learned the id could see that *something* changed, though never what.
