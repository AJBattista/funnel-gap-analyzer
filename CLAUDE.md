# CLAUDE.md — Funnel Gap Analyzer

## Project Overview

Funnel Gap Analyzer: a diagnostic tool that identifies where a marketing/sales funnel is leaking revenue and recommends what to fix first.

## Tech Stack

- **Framework:** Next.js 14 with App Router
- **Language:** TypeScript (strict)
- **Styling:** Tailwind CSS
- **Hosting:** Vercel

## Commands

- `npm run dev` — start dev server
- `npm run build` — production build
- `npm run lint` — run ESLint

## Design System

### Color Palette

- **Background:** Deep charcoal / navy-black (`#0f1117`, `#141720`)
- **Panels:** Slate / graphite with subtle elevation (`#1c1f2e`, `#232738`)
- **Primary text:** Soft white (`#e8eaf0`)
- **Secondary text:** Muted gray-blue (`#8a8fa8`)

### Status Colors

- **Benchmark reference:** Cool blue (`#4a90d9`)
- **On or above benchmark:** Muted teal/green (`#3daa8c`)
- **Meaningful gap (warning):** Amber (`#d4a24e`)
- **Critical leak:** Red (`#d94a4a`)

### Labels — Executive Language Only

Use business-impact terminology. Every label must be immediately understandable by a non-technical executive.

- Largest Revenue Leak
- Revenue at Risk
- Best Next Fix
- Benchmark Gap
- Projected Revenue Recovery

### UI Principles

- No decorative UI elements — no floating chat windows, fake AI assistant boxes, rotating gauges, decorative 3D funnels, health scores with unclear math
- Every element must support one question: **where is the funnel leaking money and what should we fix first?**
- Mobile responsive required
- Dark premium aesthetic throughout — clean, dense, data-forward

## Code Conventions

- Use the `src/` directory for all source code
- App Router: pages in `src/app/`, components in `src/components/`
- Prefer server components by default; use `"use client"` only when necessary
- Tailwind for all styling — no CSS modules or styled-components
- Import alias: `@/*` maps to `src/*`
