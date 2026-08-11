# Rilo Frontend Development Rules

## Stack

- Preact
- TypeScript
- Vite
- Tailwind/CSS
- Tauri v2
- Rust backend

## Current frontend architecture

`src/main.tsx` selects the main application or the standalone details-window host.
`src/App.tsx` composes the main window. Shared download mapping and status helpers live in
`src/lib/downloads/`; visual configuration lives in `src/lib/settings/`. UI components are in
`src/components/`, with reusable primitives under `src/components/ui/`. Shared frontend types
are in `src/types.ts` and general formatting helpers are in `src/utils.ts`.

## Frontend rules

- Use Preact, NOT React.
- Do not introduce React-specific libraries or APIs.
- Prefer existing UI primitives/components before creating duplicates.
- Reuse semantic theme tokens.
- Avoid hard-coded colors when a semantic token exists.
- Keep frontend state and presentation separate where practical.
- Keep IPC calls isolated from presentational components where practical.

## Backend boundary

Do not modify Rust download-engine behavior during frontend tasks unless explicitly requested.
Do not alter the downloader engine, segmentation, networking, persistence, scheduler, rate
limiting, retry behavior, native messaging host, browser extension, or download protocol/HTTP.

## Validation

Never claim PASS unless the command actually succeeded.

For frontend changes: `pnpm build`

For Tauri/backend changes: `cargo check --manifest-path src-tauri/Cargo.toml`

For tests: `cargo test --manifest-path src-tauri/Cargo.toml`

Do not fabricate test results.

## Git rules

Do not git push, create releases, create tags, or force push unless explicitly requested.
Do not automatically commit changes.

## UI rules

- Preserve Rilo's existing visual identity.
- Use semantic theme variables.
- Maintain dark/light, accent-color, density, and font settings compatibility.
- Keep the application usable at its intended desktop size.
- Avoid unnecessary dependencies.
