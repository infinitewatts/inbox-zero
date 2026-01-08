# Self-Hosting Changelog

This document tracks improvements made for self-hosted deployments.

## January 2026

### Layout Fixes

**Problem**: Email list content was stretching horizontally beyond the viewport on the inbox page.

**Root Cause**: Flexbox `min-width: auto` behavior - flex items don't shrink below their content size by default.

**Files Changed**:
- `apps/web/components/SideNavWithTopNav.tsx` - Added `min-w-0` to ContentWrapper and SidebarInset
- `apps/web/components/email-list/EmailListItem.tsx` - Added `min-w-0` to flex containers

---

### Email Open Tracking Integration

**Feature**: Track when recipients open your sent emails with invisible tracking pixels.

**Components**:
- External email-tracker service ([infinitewatts/email-tracker](https://github.com/infinitewatts/email-tracker))
- `OpenTrackingBadge` component displays open status in email threads

**Files Changed**:
- `apps/web/components/email-list/OpenTrackingBadge.tsx` - Fixed missing API key in fetch requests
- `apps/web/env.ts` - Added `NEXT_PUBLIC_EMAIL_TRACKER_API_KEY` environment variable
- `docker/Dockerfile.prod` - Added placeholder for runtime configuration
- `docker/scripts/start.sh` - Added placeholder replacement logic

**New Environment Variables**:
```env
# Server-side
EMAIL_TRACKING_ENABLED=true
EMAIL_TRACKER_API_URL=https://t.yourdomain.com
EMAIL_TRACKER_API_KEY=your-secret-api-key

# Client-side
NEXT_PUBLIC_EMAIL_TRACKER_URL=https://t.yourdomain.com
NEXT_PUBLIC_EMAIL_TRACKER_API_KEY=your-secret-api-key
```

---

### Feature Flag Environment Variables

**Feature**: Enable/disable features via environment variables instead of requiring PostHog feature flags.

**Source**: Adapted from [rsnodgrass/inbox-zero PR #1139](https://github.com/rsnodgrass/inbox-zero/pull/1139)

**Files Changed**:
- `apps/web/env.ts` - Added feature flag environment variables
- `apps/web/hooks/useFeatureFlags.ts` - Updated hooks to check env vars before PostHog
- `docker/Dockerfile.prod` - Added build-time placeholders
- `docker/scripts/start.sh` - Added runtime placeholder replacement

**New Environment Variables**:
```env
NEXT_PUBLIC_CLEANER_ENABLED=true      # Inbox cleaner for bulk cleanup
NEXT_PUBLIC_DIGEST_ENABLED=true       # Email digest summaries (requires QStash + Resend)
NEXT_PUBLIC_MEETING_BRIEFS_ENABLED=true  # Pre-meeting briefings
NEXT_PUBLIC_INTEGRATIONS_ENABLED=true # External service integrations
```

---

### Docker Runtime Configuration

**Problem**: Next.js `NEXT_PUBLIC_*` variables are baked at build time, making Docker images non-portable.

**Solution**: Placeholder replacement system - build with placeholders, replace at container startup.

**How It Works**:
1. `Dockerfile.prod` sets placeholders like `NEXT_PUBLIC_BASE_URL_PLACEHOLDER`
2. `start.sh` runs at container startup and replaces placeholders with actual env values
3. Uses `replace-placeholder.sh` to find/replace in the built JavaScript bundles

**Files Changed**:
- `docker/Dockerfile.prod` - Added ARG/ENV for all NEXT_PUBLIC variables
- `docker/scripts/start.sh` - Added replacement logic for each variable

---

### Beta Banner Disabled

**Change**: Disabled the beta banner that was causing layout issues for self-hosted deployments.

**File Changed**:
- `apps/web/app/(app)/[emailAccountId]/mail/BetaBanner.tsx` - Component returns null

---

## Configuration Reference

### Recommended Self-Hosted Environment Variables

```env
# Core (required)
NEXT_PUBLIC_BASE_URL=https://yourdomain.com
NEXT_PUBLIC_BYPASS_PREMIUM_CHECKS=true

# Feature Flags (optional - enable as needed)
NEXT_PUBLIC_CLEANER_ENABLED=true
NEXT_PUBLIC_MEETING_BRIEFS_ENABLED=true
NEXT_PUBLIC_INTEGRATIONS_ENABLED=true
# NEXT_PUBLIC_DIGEST_ENABLED=true  # Requires QStash + Resend

# Email Tracking (optional)
EMAIL_TRACKING_ENABLED=true
EMAIL_TRACKER_API_URL=https://t.yourdomain.com
EMAIL_TRACKER_API_KEY=your-tracker-api-key
NEXT_PUBLIC_EMAIL_TRACKER_URL=https://t.yourdomain.com
NEXT_PUBLIC_EMAIL_TRACKER_API_KEY=your-tracker-api-key
```

### Feature Dependencies

| Feature | Dependencies |
|---------|-------------|
| Inbox Cleaner | QStash (for bulk operations) |
| Email Digest | QStash + Resend |
| Meeting Briefs | Cron job + Perplexity API (optional) |
| Email Tracking | External email-tracker service |
| Integrations | None |

---

## Upstream Forks Reviewed

The following forks were reviewed for useful self-hosting improvements:

- **rsnodgrass/inbox-zero** - Feature flag env vars (incorporated)
- **Eventus-Whole-Health/inbox-zero** - Azure OpenAI support, encryption improvements (not needed for current setup)

---

## Known Issues

### Google OAuth Redirect URI
When configuring Google OAuth, ensure redirect URIs match exactly:
- `https://yourdomain.com/api/auth/callback/google`
- The domain must match `NEXT_PUBLIC_BASE_URL`

### NEXT_PUBLIC Variables in Docker
Must be set as shell environment variables when running `docker compose up`:
```bash
NEXT_PUBLIC_BASE_URL=https://yourdomain.com docker compose --env-file apps/web/.env --profile all up -d
```

Setting only in `.env` file will not work due to docker-compose.yml overrides.
