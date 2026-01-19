# Changelog

All notable changes to this fork will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

## [Unreleased]

### Fixed - 2026-01-18

#### Draft Email Display Issue
- **Problem**: Draft emails in the Drafts folder (`?type=draft`) were not displaying any body content
- **Root Cause**: The `EmailThread` component was filtering all DRAFT-labeled messages into a drafts map for display as replies, but standalone drafts (with no parent message) were being silently discarded
- **Solution**: Track standalone drafts separately and display them as regular messages when viewing the drafts folder
- **Files Changed**: `apps/web/components/email-list/EmailThread.tsx`
- **Commit**: `1a6ef832e` - fix: display standalone draft emails in draft folder view

#### SSR Hydration Mismatch
- **Problem**: React Error #418 causing infinite flickering on bulk-archive/analyze pages
- **Root Cause**: `archive-queue.ts` was using `atomWithStorage` with localStorage in a way that caused hydration mismatch between server and client renders
- **Solution**:
  - Modified `createStorage()` to return a no-op storage during SSR that always returns the initial value
  - Changed `getOnInit: true` to `getOnInit: false` to delay localStorage read until after client-side hydration
  - Added proper null/object checking to prevent runtime errors
- **Files Changed**: `apps/web/store/archive-queue.ts`
- **Commit**: `79000c479` - fix: resolve SSR hydration mismatch in queue causing page flickers

#### TypeScript Build Errors
- **Problem**: CI builds failing with TypeScript errors after SSR hydration fix
- **Root Cause**:
  1. Improper handling of Promise vs synchronous return types in storage.getItem()
  2. Missing type annotations in filter callback causing 'unknown' type errors
  3. Invalid modelType value "fast" (not in allowed types: "default" | "economy" | "chat")
- **Solution**:
  1. Properly handle SSR by returning minimal storage object on server-side with synchronous returns
  2. Added explicit type annotation `[string, QueueItem]` to filter destructuring
  3. Changed invalid "fast" to "economy" in ai/search route
- **Files Changed**:
  - `apps/web/store/archive-queue.ts`
  - `apps/web/app/api/ai/search/route.ts`
- **Commit**: `b18675cd9` - fix: resolve TypeScript build errors from SSR hydration fix

### Added - 2026-01-18

#### Upstream Sync
- **Merged**: 85 commits from upstream `elie222/inbox-zero` (through commit `a74ec7df3`)
- **Notable Updates**:
  - Prisma v7 upgrade
  - CORS fixes for auth routes
  - Unsubscribe detection for non-English emails
  - OAuth proxy support for preview deployments
  - Organization member removal fixes
  - E2E test infrastructure improvements
  - Gmail API refactors and threading fixes
- **Conflicts Resolved**:
  - `.env.example` - Combined custom feature flags + email tracking with new OAuth proxy settings
  - `apps/web/CLAUDE.md` - Removed (deleted in fork, modified upstream)
- **Lint Issues Fixed**:
  - Removed unused `emailAccountId` variable in `Members.tsx`
  - Replaced `any` types with proper type annotations in `microsoft.ts`
  - Fixed duplicate `getMessagesWithAttachments` key in email-provider mock
  - Added missing `createNewDraft` method to mock provider
- **Commit**: `e411d92d1` - Merge remote-tracking branch 'upstream/main'

## Version Notes

This fork maintains custom features while periodically syncing with upstream:
- Email open tracking (Shortwave-style)
- Custom feature flags
- Enhanced UI components
- Additional integrations

### Custom Features Preserved
- Email tracking infrastructure (`EMAIL_TRACKING_ENABLED`, `EMAIL_TRACKER_API_URL`, etc.)
- Extended feature flags (`NEXT_PUBLIC_CLEANER_ENABLED`, `NEXT_PUBLIC_CONTACTS_ENABLED`, etc.)
- Custom UI enhancements and components

## Deployment

After these fixes, the application should:
- ✅ Build successfully on CI/CD
- ✅ Display draft email content properly
- ✅ Not flicker on bulk-archive/analyze pages
- ✅ Include all upstream improvements through Jan 19, 2026
