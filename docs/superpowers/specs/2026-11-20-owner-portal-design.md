# Owner portal and content manager — design

Status: approved by Nhen in conversation, 2026-11-20 (plan + Supabase choice). Calls marked **[my call]** are open to change.

## Why
Restaurants should be able to correct their own listing (README principle 3), without GitHub accounts and without Nhen retyping every change. Nhen needs one familiar place to see and manage all restaurant content.

## Goals
- Verified owners edit only their own restaurant: hours, oyster prices, happy hour, specialty note.
- Owner edits go live right away; Nhen is notified of each one and can undo it.
- Nhen manages everything from a spreadsheet-style editor (Supabase Table Editor), no code.
- Tourist side unchanged: no accounts, no extra taps, still under 60 seconds.

## Non-goals / anti-goals
- No accounts or login for tourists. Ever.
- Owners never get GitHub access.
- No paid services. No AI or API keys in the data checks (existing rule).
- If Supabase is down or slow, the app must still work exactly as it does today.

## Approaches considered
1. **Supabase (chosen):** hosted Postgres + magic-link login + per-row permissions + a built-in table editor. Free tier. Fits listing-style data.
2. Directus/Strapi: right permissions, but need a server or a paid plan.
3. Decap/Pages CMS: git-based; owners would need repo access.
4. Google Form + Sheet: familiar but ownership checks are weak and manual.

## Design
**Data.** `src/deals.json` stays the base data (the daily robots keep working on it). Supabase holds only *owner overrides* per restaurant id, plus claims and an edit log.

**Tables (all with row-level security):**
- `venues`: id, name, website_host. Seeded from deals.json. Read-only to the public.
- `claims`: venue_id, user_id, email, method (`domain` | `manual`), status (`approved` | `pending` | `rejected`).
- `overrides`: venue_id, data (json: hours, menu, deal, lore), updated_by, updated_at. Public read. An owner can write only where an approved claim links them to that venue.
- `edit_log`: venue_id, user_id, old, new, at, undone. Insert-only for owners; admin can undo.
- `admins`: Nhen's user id.

**Verification ladder.**
1. Email domain matches the restaurant's own website domain (checked in the database, not the browser) → claim auto-approved after the magic-link click.
2. Anything else (e.g. a Gmail address) → claim goes to a pending queue; Nhen approves with proof. **[my call]** The phone-code step from the earlier sketch is dropped: Supabase text-message login needs a paid SMS provider.
3. Name and address changes always wait for Nhen's approval.

**Owner page.** Route `#/owner` in the existing app (no new site): sign in by email link, pick or auto-load their restaurant, big senior-friendly fields, Save. Same fonts and contrast rules as the rest of the app.

**Nhen's view.** Supabase Table Editor over `claims`, `overrides`, `edit_log`. **[my call]** A plain "Approve / Undo" checklist in the table editor first; a custom admin screen only if that proves clumsy.

**App merge.** On load the app fetches `overrides` (public read key; small payload), merges over deals.json, tags merged fields "Confirmed by the restaurant · date". Fetch fails or times out (3 s) → silently use deals.json.

**Daily check interaction.** `check-restaurants` skips or labels fields that have an owner override instead of reporting them as "no longer on the page" every day. The robot never overwrites an owner value. If the website shows a different value, it lists it for Nhen under "owner vs website".

**Notifications.** Each owner change → email to Nhen (daily digest if noisy). **[my call]** Via a Supabase edge function and Resend's free tier; fallback: a GitHub issue per change (GitHub emails automatically, no new service).

**Keep-alive.** Free Supabase projects pause after inactivity. The existing daily workflow pings the database.

## Testing
- Unit: merge logic, staleness with overrides, domain-match rule.
- Database: row-level-security tests. A fake owner with an unrelated email must fail to claim, and must fail to write another venue's row.
- Browser: existing e2e/accessibility/hours suites still pass; new owner-page checks at phone width.
- Failure: Supabase unreachable → app identical to today.

## Left to the builder
Exact column types, owner-page layout details, how overrides are validated (hours format, price numbers) using the same rules as `logic.ts`.
