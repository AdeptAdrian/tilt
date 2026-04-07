# Tilt

A personal Apex Legends coaching web app that passively surfaces ranked improvement insights using public player and teammate data.

## Stack
- Framework: Next.js 14 (App Router) + TypeScript
- Styling: Tailwind CSS + shadcn/ui
- Database: Supabase (Postgres + Auth)
- AI: Claude API (insight generation)
- APIs: Tracker.gg, ApexLegendsStatus (mozambiquehe.re)
- Hosting: Vercel

## Project structure
/app              → Next.js App Router pages and layouts
/app/api          → API routes (server-side only)
/components       → Shared UI components
/lib/services     → All external API call abstractions (Tracker.gg, ALS, Claude)
/lib/db           → Supabase query helpers
/lib/insights     → Insight calculation logic (chemistry, fatigue, momentum)
/types            → Shared TypeScript types

## Data model (core tables)
- players         → username, platform, rank, cached_at
- matches         → match_id, player_id, date, placement, map
- match_players   → match_id, player_id, legend, kills, damage
- sessions        → player_id, started_at, ended_at, match_ids[]
- insights        → player_id, type, content, generated_at, seen

## Coding conventions
- All Tracker.gg and ALS API calls go through /lib/services/ — never call them directly from components or pages
- Use Supabase server client in Server Components and API routes
- Use Supabase browser client in Client Components only
- Cache all external API responses in Supabase — never hit Tracker.gg twice for the same player within 24 hours
- TypeScript strict mode is on — no `any` types unless absolutely necessary
- All DB queries must have try/catch error handling

## Key rules
- NEVER commit API keys — use .env.local for all secrets
- Rate limit all external API calls — Tracker.gg free tier is strict
- Enrich teammate data lazily via background jobs, not synchronously on page load
- Minimum 20 matches required before showing chemistry insights to the user
- All insight generation prompts go through /lib/services/claude.ts

## Environment variables
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
TRACKER_GG_API_KEY
ALS_API_KEY
ANTHROPIC_API_KEY

## Commands
- Dev server:     npm run dev
- Type check:     npm run typecheck
- Build:          npm run build
- Lint:           npm run lint
