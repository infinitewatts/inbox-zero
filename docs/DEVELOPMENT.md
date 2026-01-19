# Inbox Zero Development Guide

## Critical: Git Commit Workflow

**MANDATORY PROCESS - Follow this EXACTLY for every commit:**

### 1. Make Code Changes
Write/edit files as needed.

### 2. Run Linter BEFORE Staging (REQUIRED)
```bash
npm run fix
```

This runs `ultracite fix` which will:
- Fix unused variables (prefix with `_`)
- Convert string concatenation to template literals
- Add missing keyboard event handlers
- Auto-fix other linting issues

**DO NOT SKIP THIS STEP - The pre-commit hook will fail if you do.**

### 3. Fix Any Remaining Errors
If `npm run fix` reports errors it can't auto-fix:
- Read the error messages carefully
- Fix them manually
- Run `npm run fix` again to verify

### 4. Stage Changes
```bash
git add -A
```

### 5. Commit
```bash
git commit -m "message"
```

The pre-commit hook will run `ultracite fix` again, but it should pass since you already ran it.

### 6. Push
```bash
git push
```

---

## Pre-commit Hook Configuration

Location: `.husky/pre-commit`
Runs: `lint-staged` which executes `ultracite fix` on staged files

Config in `package.json`:
```json
"lint-staged": {
  "*.{js,jsx,ts,tsx,json,jsonc,css,scss,md,mdx}": [
    "ultracite fix"
  ]
}
```

---

## Common Linting Issues & Fixes

### Unused Variables
```typescript
// ❌ Bad
catch (error) {
  // not using error
}

// ✅ Good
catch (_error) {
  // prefixed with underscore
}
```

### String Concatenation
```typescript
// ❌ Bad
description: "Failed: " + error.message

// ✅ Good
description: `Failed: ${error.message}`
```

### Missing Keyboard Events
```typescript
// ❌ Bad
<div onClick={handleClick}>

// ✅ Good
<div
  onClick={handleClick}
  onKeyDown={(e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      handleClick();
    }
  }}
>
```

---

## Technology Stack

- **Framework:** Next.js 14 (App Router)
- **Language:** TypeScript
- **Linter:** Biome (via ultracite wrapper)
- **Email APIs:** Gmail API, Microsoft Graph API
- **Database:** PostgreSQL (Prisma ORM)
- **UI:** React, Tailwind CSS, shadcn/ui
- **State:** Jotai (atoms)
- **Forms:** React Hook Form

---

## Project Structure

```
apps/web/
├── app/                    # Next.js app router pages
├── components/             # React components
├── providers/              # Context providers
├── utils/                  # Utility functions
│   ├── actions/           # Server actions
│   ├── email/             # Email provider abstraction
│   ├── gmail/             # Gmail-specific utilities
│   └── outlook/           # Outlook-specific utilities
└── __tests__/             # Tests
```

---

## Email Provider Architecture

The app uses a provider pattern to abstract Gmail and Outlook APIs:

- **Interface:** `utils/email/types.ts` - `EmailProvider` interface
- **Gmail Implementation:** `utils/email/google.ts` - `GmailProvider`
- **Outlook Implementation:** `utils/email/microsoft.ts` - `OutlookProvider`
- **Factory:** `utils/email/provider.ts` - `createEmailProvider()`

When adding new email functionality:
1. Add method to `EmailProvider` interface
2. Implement in both `GmailProvider` and `OutlookProvider`
3. Update test mocks in `__tests__/mocks/email-provider.mock.ts`

---

## Testing

Run tests:
```bash
npm run test
```

Update mocks when adding new EmailProvider methods:
- `apps/web/__tests__/mocks/email-provider.mock.ts`
- `apps/web/utils/__mocks__/email-provider.ts`

---

## Building

```bash
npm run build
```

Note: Build requires `DATABASE_URL` environment variable for Prisma migrations.

---

## Development

```bash
npm run dev
```

Runs on `http://localhost:3000`
