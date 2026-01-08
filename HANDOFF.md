# Session Handoff - January 8, 2026

## Summary

This session addressed several issues with the inbox-zero email client and email-tracker service.

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

**Status:** Debugging in progress

**Symptoms:**
- User clicks "Connect Calendar"
- Redirected to Google OAuth, grants permissions
- Redirected back to `/calendars` but no calendar appears
- Logs show "OAuth code is being processed by another request" but no success/error logs

**Next Steps:**
1. Rebuild inbox-zero container with new logging
2. Try connecting calendar again
3. Check logs for:
   - `Calendar callback started` - confirms request reaches handler
   - `OAuth callback validated` - confirms validation passed
   - `Acquired OAuth lock` - confirms this request got the lock (not duplicate)
   - `Exchanging OAuth code for tokens` - confirms token exchange started
   - `Token exchange result` - shows if tokens were received
   - `Creating calendar connection` - confirms DB write attempted
   - `Calendar connected successfully` - confirms success

**Possible Causes:**
- Redis lock not releasing properly
- Token exchange failing silently
- Database write failing
- Multiple container instances causing race conditions

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
| `apps/web/app/(app)/layout.tsx` | Removed duplicate CSS import |
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
