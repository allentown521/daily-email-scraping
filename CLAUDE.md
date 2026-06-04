# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**product-hunt-email-scraper** is a browser extension that scrapes email addresses from various product launch and startup websites. It's built with WXT (a modern web extension framework) and includes a React frontend, TypeScript backend, and content scripts for multiple websites.

**Supported/Target Websites:**
- Product Hunt
- Peerlist
- TinyLaunch
- StartupFA.st
- Uneed.best
- Fazier.com
- Open-Launch
- Firsto.co
- And others (see README.md for full list)

The extension uses Supabase for authentication and storage, with Lemonsqueezy for premium features.

## Architecture

### High-Level Structure

```
├── src/app/              # WXT entrypoints (built by WXT)
│   ├── popup/            # Popup UI
│   ├── sidepanel/        # Side panel UI
│   ├── background/       # Service worker
│   ├── help/             # Help/instructions page
│   └── *.content/        # Content scripts for each website
├── src/components/       # React UI components (Radix UI based)
├── src/lib/              # Core utilities (messaging, storage, auth, analytics)
├── src/service/          # External service integrations (Supabase, Lemonsqueezy)
├── src/types/            # TypeScript type definitions
└── src/utils/            # Helper functions
```

### Key Architecture Patterns

**WXT Framework:** Uses `wxt.config.ts` to define manifest, permissions, and build config. Entrypoints in `src/app/` are automatically detected and bundled.

**Content Scripts:** Each website gets its own content script (e.g., `producthunt.content`, `peerlist.content`). These are injected into target pages and parse/scrape email addresses. Follow the naming pattern `sitename.content/index.tsx`.

**Messaging System:** Communication between content scripts, popup, sidepanel, and background worker uses `src/lib/messaging.ts` with message types defined in `Message` enum. Background worker listens with `onMessage()`.

**Storage:** Unified storage layer via `src/lib/storage.ts` with `StorageKey` enum. Uses browser's storage API.

**Authentication:** Supabase integration via `src/lib/supabase.ts`. BetterAuth handles session management in the background worker.

### Component Patterns

- **UI Components:** Use Radix UI primitives (in `src/components/ui/`). All are forwardRef'd and support `className` prop for Tailwind customization.
- **Forms:** Use React Hook Form + Zod. Pattern: `FormField` + `FormControl` + validation rules.
- **State Management:** React Query for server state, React hooks for local state.
- **Styling:** Tailwind CSS v4 via `@tailwindcss/vite` plugin.

## Development Setup

### Commands

```bash
# Development (Chrome)
npm run dev

# Development (Firefox)
npm run dev:firefox

# Build (both Chrome and Firefox)
npm run build

# Build specific browser
npm run build:chrome
npm run build:firefox

# Linting and formatting
npm run lint              # Check with Biome
npm run lint:fix          # Auto-fix with Biome

# Type checking
npm run typecheck

# Post-install (prepares extension)
npm run postinstall
```

### Package Manager

The project uses **pnpm** (via `pnpm-lock.yaml`). If you see npm errors, ensure you're using pnpm:
```bash
pnpm install
pnpm run dev
```

### Commit Standards

Uses conventional commits enforced by commitlint:
- `feat:` new features
- `fix:` bug fixes
- `chore:` non-code changes
- `docs:` documentation
- Body messages must be ≤100 chars per line (see `commitlint.config.ts`)

## Adding Support for New Websites

### Steps to Add a New Content Script

1. **Create the content script file:** `src/app/[sitename].content/index.tsx`
2. **Implement email scraping:** Parse the DOM and extract email addresses
3. **Send data to popup:** Use the messaging system to communicate with the popup:
   ```typescript
   import { sendMessage, Message } from "~/lib/messaging";
   
   sendMessage(Message.EMAILS_SCRAPED, { emails: ['email@example.com'] });
   ```
4. **Update manifest (if needed):** If the site requires specific permissions, update `wxt.config.ts` manifest

### Content Script Template

```typescript
export default defineContentScript({
  matches: ['https://example.com/*'],
  main() {
    // Parse page and extract emails
    const emails = Array.from(document.querySelectorAll('[data-email]'))
      .map(el => el.textContent)
      .filter(Boolean);
    
    // Send to popup
    sendMessage(Message.EMAILS_FOUND, { emails });
  }
});
```

### Detail Scripts

Some sites have separate list and detail pages. Use the pattern:
- `sitename.content` — handles the listing page
- `sitenameDetail.content` — handles individual product/item detail pages

## Code Quality

### Linting

Biome is configured for formatting and linting. Run `npm run lint:fix` before committing. The CI will check formatting, so fixing locally prevents rejected commits.

### TypeScript

Run `npm run typecheck` to catch type errors. This is enforced in the build and should pass before merging.

### Testing

The project uses **Vitest** (installed, can be added to scripts). Currently, focus is on type safety and linting rather than unit tests.

## Key Dependencies

- **wxt** — Web extension framework with automatic entry point detection
- **react** & **react-dom** — UI framework (v19)
- **@webext-core/messaging** — Cross-context messaging
- **@supabase/supabase-js** — Backend auth and storage
- **better-auth** — Session management
- **react-hook-form** — Form state management
- **zod** — Runtime schema validation
- **@radix-ui/* — Accessible UI primitives
- **tailwindcss** — CSS utilities
- **@tanstack/react-query** — Server state management

## Important Notes

- **Browser Support:** Builds for both Chrome and Firefox. Use `wxt -b firefox` for Firefox-specific development.
- **Permissions:** Defined in `wxt.config.ts` manifest. Common: `storage`, `tabs`, `sidePanel`, `alarms`, `notifications`.
- **Build Output:** Outputs to `build/` directory. WXT automatically zips for distribution.
- **Environment Variables:** Loaded via `@t3-oss/env-core` in `src/lib/env.ts`. Supports `.env.local` overrides.
- **Icon Generation:** WXT auto-generates icons from `icon.png` via `@wxt-dev/auto-icons` module.

## Debugging Tips

- **Content scripts:** Inject `console.log` or use Chrome DevTools on the target website's console.
- **Popup/Sidepanel:** Right-click extension → "Inspect popup" or "Inspect sidepanel".
- **Background worker:** Chrome DevTools → Service Workers, or Firefox: `about:debugging`.
- **Storage:** Use `browser.storage.local.get()` in DevTools console.
- **Messaging:** Log in `onMessage` handlers to debug communication.
