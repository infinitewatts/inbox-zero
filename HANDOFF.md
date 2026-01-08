# Session Handoff - January 8, 2026 (Updated)

## Summary

This session addressed several issues with the inbox-zero email client and email-tracker service.

---

## Latest Fixes (Session 2)

### 6. Calendar OAuth Lock Fix

**Commit:** `48b149e0d` - Fix calendar OAuth and font portal inheritance

**Problem:** Calendar connection was failing with "OAuth code is being processed by another request (duplicate request blocked)" even on first attempt. The noop Redis client returned `null` for `set` operations, but the lock code expected `"OK"` for success.

**Root Cause:** When Upstash Redis is not configured, the noop Redis in `index.ts` returned `null` for all `set` operations. The `acquireOAuthCodeLock` function checks if `result === "OK"`, so it always returned `false` (lock not acquired).

**Solution:**
- Changed noop Redis `set` to return `"OK"` instead of `null`
- This allows lock acquisition to succeed when Redis isn't configured
- Without distributed Redis, locking isn't needed anyway (single instance)

**Files Changed:**
- `apps/web/utils/redis/index.ts` - Fixed noop Redis set return value

---

### 7. Font Portal Inheritance Fix

**Problem:** The previous dialog font fix didn't fully work because `--font-inter` CSS variable was scoped to a wrapper div in the app layout, but Radix UI portals render to `document.body`, outside that DOM subtree.

**Solution:**
- Added Inter font to root layout (`app/layout.tsx`)
- Added `inter.variable` class to `<body>` so all portals inherit the font variable
- Removed duplicate Inter font definition from app layout
- Simplified app layout by removing unnecessary wrapper div

**Files Changed:**
- `apps/web/app/layout.tsx` - Added Inter font and variable to body
- `apps/web/app/(app)/layout.tsx` - Removed duplicate Inter font, simplified JSX

---

## Completed Changes

### 1. Email Tracker - Bot/Proxy Filtering (email-tracker repo)

**Commit:** `1d843c5` - Add bot/proxy filtering for accurate open tracking

**Problem:** Email tracking showed 3 opens when only 1 actual open occurred. Gmail pre-fetches tracking pixels via proxy servers.

**Solution:**
- Added detection for Google image proxies (192.178.x.x, 66.249.x.x, etc.)
- Added user-agent filtering for known bots (Googlebot, Gmail proxy, social media crawlers)
- Database schema updated with `is_bot` and `bot_reason` columns
- API endpoints filter bot opens by default (add `?includeBots=true` to see all)
- Dashboard shows human opens with separate bot count badge
- Added migration to handle existing database tables

**Files Changed:**
- `src/server.js` - Bot detection, schema migration, updated queries

**Deployment:** Push to main triggers GitHub Actions build. Pull new image on production server.

---

### 2. Inbox Zero - UI Font Consistency

**Commit:** `ac273a21c` - Fix UI font consistency and add calendar OAuth debugging

**Problem:** Compose popup editor used wrong font family and size.

**Solution:**
- Removed duplicate `globals.css` import from `apps/web/app/(app)/layout.tsx`
- Added `font-inter` class to Dialog portal component
- Added ProseMirror/Tiptap font styling in `globals.css`

**Files Changed:**
- `apps/web/app/(app)/layout.tsx` - Removed duplicate import
- `apps/web/components/ui/dialog.tsx` - Added font-inter class
- `apps/web/styles/globals.css` - Added .ProseMirror font rules

---

### 3. Inbox Zero - Email Activity Page Fix

**Problem:** Activity page wasn't showing email opens.

**Solution:**
- Added missing `X-API-Key` header to activity page fetch requests
- Updated `OpenEvent` type to include bot fields

**Files Changed:**
- `apps/web/app/(app)/[emailAccountId]/activity/page.tsx`
- `apps/web/components/email-list/OpenTrackingBadge.tsx`

---

### 4. Inbox Zero - SWR Refetch Logic Improvement

**Problem:** Emails sometimes disappeared from view due to stale SWR cache.

**Solution:**
- Added `revalidate` option to refetch callback
- Auto-revalidates from server when called without `removedThreadIds`

**Files Changed:**
- `apps/web/app/(app)/[emailAccountId]/mail/page.tsx`

---

### 5. Inbox Zero - Calendar OAuth Debugging

**Problem:** Calendar connection flow silently fails - redirects back to /calendars but no calendar appears.

**Solution (Diagnostic):**
- Added comprehensive logging throughout calendar callback flow
- Logs at: callback start, after validation, after lock acquisition, token exchange, connection creation

**Files Changed:**
- `apps/web/utils/calendar/handle-calendar-callback.ts`
- `apps/web/utils/calendar/providers/google.ts`

---

## Outstanding Issues

### Calendar OAuth Not Connecting

**Status:** FIXED in Session 2 (commit `48b149e0d`)

**Root Cause Identified:** The noop Redis `set` returned `null`, but lock acquisition expected `"OK"`. This caused every OAuth callback to be blocked as a "duplicate request."

**Fix Applied:** Changed noop Redis to return `"OK"` for `set` operations.

**To Test:**
1. Wait for Watchtower to pull the new image (check container logs)
2. Navigate to Calendars page
3. Click "Connect Calendar"
4. Complete Google OAuth flow
5. Calendar should now appear in the list

**If Still Not Working:**
Check logs for:
- `Acquired OAuth lock` - should now appear
- `Exchanging OAuth code for tokens` - confirms token exchange started
- `Calendar connected successfully` - confirms success

---

## Environment Notes

- **Inbox Zero:** Self-hosted Docker deployment at `mail.affordablesolar.io`
- **Email Tracker:** Separate service at `t.affordablesolar.io` (Docker)
- **Database:** PostgreSQL in Docker
- **Redis:** Used for OAuth locks and queue state

---

## Quick Commands

```bash
# Rebuild inbox-zero
cd /path/to/inbox-zero
docker-compose pull && docker-compose up -d --build

# Rebuild email-tracker
cd /path/to/email-tracker
docker pull ghcr.io/infinitewatts/email-tracker:latest
docker-compose up -d

# Check calendar connections in database
docker-compose exec postgres psql -U postgres -d inbox_zero -c \
  "SELECT id, email, provider, \"isConnected\" FROM \"CalendarConnection\" ORDER BY \"createdAt\" DESC LIMIT 5;"

# View inbox-zero logs
docker-compose logs -f inbox-zero | grep -E "calendar|Calendar"
```

---

## Files Modified This Session

### inbox-zero repo
| File | Change |
|------|--------|
| `apps/web/app/layout.tsx` | Added Inter font variable to body (Session 2) |
| `apps/web/app/(app)/layout.tsx` | Removed duplicate Inter font, simplified JSX (Session 2) |
| `apps/web/utils/redis/index.ts` | Fixed noop Redis set return value (Session 2) |
| `apps/web/app/(app)/[emailAccountId]/mail/page.tsx` | Improved refetch logic |
| `apps/web/app/(app)/[emailAccountId]/activity/page.tsx` | Added API key header, updated types |
| `apps/web/components/ui/dialog.tsx` | Added font-inter class |
| `apps/web/components/email-list/OpenTrackingBadge.tsx` | Added botOpenCount type |
| `apps/web/styles/globals.css` | Added ProseMirror font styles |
| `apps/web/utils/calendar/handle-calendar-callback.ts` | Added debugging logs |
| `apps/web/utils/calendar/providers/google.ts` | Added token exchange logging |

### email-tracker repo
| File | Change |
|------|--------|
| `src/server.js` | Bot detection, schema migration, query updates |

---

## Contact

Session conducted with Claude Opus 4.5 via Claude Code CLI.
