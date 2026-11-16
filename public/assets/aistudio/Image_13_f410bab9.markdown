---
name: Obsidian Grandmaster
colors:
  surface: '#0f1511'
  surface-dim: '#0f1511'
  surface-bright: '#343b36'
  surface-container-lowest: '#0a100c'
  surface-container-low: '#171d19'
  surface-container: '#1b211d'
  surface-container-high: '#252b27'
  surface-container-highest: '#303632'
  on-surface: '#dee4dd'
  on-surface-variant: '#c3c8bf'
  inverse-surface: '#dee4dd'
  inverse-on-surface: '#2c322d'
  outline: '#8d928a'
  outline-variant: '#434842'
  surface-tint: '#b0ceb1'
  primary: '#d5f3d4'
  on-primary: '#1d3621'
  primary-container: '#b9d7b9'
  on-primary-container: '#445e47'
  inverse-primary: '#4a654d'
  secondary: '#afceba'
  on-secondary: '#1b3628'
  secondary-container: '#334f40'
  on-secondary-container: '#a1c0ac'
  tertiary: '#efebdf'
  on-tertiary: '#323129'
  tertiary-container: '#d3cfc3'
  on-tertiary-container: '#5a584f'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#cceacc'
  primary-fixed-dim: '#b0ceb1'
  on-primary-fixed: '#07200d'
  on-primary-fixed-variant: '#334d36'
  secondary-fixed: '#cbead6'
  secondary-fixed-dim: '#afceba'
  on-secondary-fixed: '#042014'
  on-secondary-fixed-variant: '#314c3e'
  tertiary-fixed: '#e6e2d6'
  tertiary-fixed-dim: '#cac6bb'
  on-tertiary-fixed: '#1d1c15'
  on-tertiary-fixed-variant: '#48473e'
  background: '#0f1511'
  on-background: '#dee4dd'
  surface-variant: '#303632'
typography:
  display-lg:
    fontFamily: Space Grotesk
    fontSize: 48px
    fontWeight: '600'
    lineHeight: 56px
    letterSpacing: -0.03em
  display-lg-mobile:
    fontFamily: Space Grotesk
    fontSize: 32px
    fontWeight: '600'
    lineHeight: 40px
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Space Grotesk
    fontSize: 32px
    fontWeight: '500'
    lineHeight: 40px
    letterSpacing: -0.02em
  headline-lg-mobile:
    fontFamily: Space Grotesk
    fontSize: 24px
    fontWeight: '500'
    lineHeight: 32px
    letterSpacing: -0.01em
  headline-md:
    fontFamily: Space Grotesk
    fontSize: 20px
    fontWeight: '500'
    lineHeight: 28px
  headline-sm:
    fontFamily: Space Grotesk
    fontSize: 16px
    fontWeight: '600'
    lineHeight: 24px
    letterSpacing: 0.01em
  body-lg:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  body-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  body-sm:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '400'
    lineHeight: 16px
  label-mono-lg:
    fontFamily: JetBrains Mono
    fontSize: 20px
    fontWeight: '500'
    lineHeight: 24px
    letterSpacing: -0.02em
  label-mono-md:
    fontFamily: JetBrains Mono
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 18px
    letterSpacing: 0em
  label-mono-sm:
    fontFamily: JetBrains Mono
    fontSize: 11px
    fontWeight: '500'
    lineHeight: 14px
    letterSpacing: 0.05em
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  gutter: 1rem
  gutter-desktop: 1.5rem
  margin: 1rem
  margin-desktop: 2rem
  space-xs: 0.25rem
  space-sm: 0.5rem
  space-md: 1rem
  space-lg: 1.5rem
  space-xl: 2rem
---

## Brand & Style

This design system embodies the calculated silence and cerebral tension of competitive master-level chess. The aesthetic is architectural, disciplined, and restrained—evoking the atmosphere of a soundproof tournament chamber constructed from deep volcanic stone and muted botanical green marble.

### Principles
- **Calculated Restraint**: Interface elements surrender the visual stage to the board. Distractions, gratuitous blurs, and hyperactive micro-animations are eliminated.
- **Architectural Precision**: Every alignment, border weight, and coordinate marker is strictly engineered on structured grids, projecting intellectual rigor and authority.
- **Tactile Weight**: Digital chess pieces, controls, and timers possess palpable mass through subtle borders and deep tonal contrast rather than playful gloss.

## Colors

The palette is rooted in cold mineral depths and vintage botanical study tones, strictly calibrated for low eye strain during prolonged analytical sessions.

### Core Color Roles
- **Canvas Base (`#111713`)**: Obsidian tone used exclusively for the root application background and viewport margins.
- **Surface Level 1 (`#19221C`)**: The workhorse container tone for sidebars, evaluation drawers, and move trees.
- **Surface Level 2 (`#202C24`)**: Elevated containers such as active player cards, floating popovers, and analysis toolbars.
- **Primary Accent (`#B9D7B9`)**: Desaturated mint leaf reserved for active moves, primary call-to-actions, and decisive state confirmations.
- **Support Green (`#203B2D`)**: Deep forest tone for subtle fills, active tabs, and secondary interactive states.
- **Ivory Accent (`#E9E5D9`)**: Editorial highlights, high-tier membership markers, and tactical focal points.
- **Text Hierarchies**: `#F7F7F2` for primary legible copy and notations; `#9BA89E` for non-critical telemetry, engine depth, and coordinates.
- **Structural Bounds (`#344239`)**: 1px structural framing across all card borders and dividers.

### Board Tokens
- **Dark Squares**: `#55745F`
- **Light Squares**: `#D9D7C8`
- **Move Destination Indicators**: Translucent primary accent tint (`rgba(185, 215, 185, 0.28)` with a 30% center pip).
- **Check / Threat State**: Controlled danger wash (`rgba(215, 107, 107, 0.35)`).

## Typography

Typography establishes an instant boundary between narrative thought, operational commands, and high-frequency analytical data.

### Font Hierarchy Roles
- **Space Grotesk**: Reserved for section titles, modal headers, player usernames, and brand headlines. Features geometric structural tension without feeling ungrounded.
- **Inter**: Drives all administrative panels, settings, chat messages, system alerts, and primary instructional content.
- **JetBrains Mono**: Assigned to algebraic move notation (e.g., `14. Nxd4!`), precision countdown clocks, centipawn evaluation tags (`+1.42`), ELO rating metrics, and rank/file board coordinates.

## Layout & Spacing

The layout is structured around an immutable 8px grid increment, scaling outward from the central board frame.

### Layout Mechanics
- **The Board Sanctuary**: The board container is rendered as an aspect-ratio-locked square (`1:1`). Surrounding analysis toolbars and move lists lock to its dynamic height.
- **Desktop (1200px+)**: A 3-column asymmetric layout: Player/Engine status rail (280px fixed), Central chessboard (fluid to max 720px), and Notation/Analysis panel (360px fixed).
- **Tablet (768px - 1199px)**: Two-column split: Chessboard expands to fill dominant column; game notation and timers stack in an adjacent 320px sidebar.
- **Mobile (<768px)**: Strict vertical stack. Timers anchor above and below the full-width board; notation collapses into an expandable horizontal sheet at the bottom viewport.

## Elevation & Depth

Visual depth is achieved through surgical surface stacking and subtle light-blocking rims rather than high-diffusion shadows.

### Surface Tiers
- **Base Level (`#111713`)**: Canvas background. No shadow.
- **Tier 1 (`#19221C`)**: Sidebars, move sheet container. Outlined with `1px solid #344239`.
- **Tier 2 (`#202C24`)**: Active clocks, dialog cards, dropdown menus. Outlined with `1px solid #344239` with an ambient shadow: `box-shadow: 0 4px 20px rgba(0, 0, 0, 0.45)`.
- **Tier 3 (Floating Board Overlay)**: Move evaluation overlays, draw offer modals. Outlined with `1px solid #4a5c51` with direct elevation: `box-shadow: 0 12px 36px rgba(0, 0, 0, 0.65)`.

## Shapes

The geometric personality balances industrial engineering with physical gamecraft.

- **Interactive Controls (Inputs, Buttons, Segmented Tabs)**: Range between 8px (`rounded`) and 12px for comfortable touch and pointer alignment.
- **Structural Modules (Cards, Board Frame, Evaluation Panel)**: Built strictly with 16px corner radii to frame complex game states cleanly.
- **Notation Chips & Pills**: 6px for compact list integration.
- **The Chessboard**: Sharp internal cells (0px radius) framed within an outer container rounded to 16px.

## Components

### Buttons & Interactive Controls
- **Primary Action (Resign, Accept, New Match)**: Background `#B9D7B9`, text color `#111713`, font JetBrains Mono 14px weight 600, radius 8px, border none. Hover state shifts to `#d1e5d1`.
- **Secondary / Ghost Action**: Background `#202C24`, text color `#F7F7F2`, border `1px solid #344239`, radius 8px. Hover state shifts border to `#55745F`.
- **Danger (Resign Confirmation)**: Background transparent, border `1px solid #D76B6B`, text `#D76B6B`. Hover state applies `rgba(215, 107, 107, 0.12)` fill.

### Chess Clocks & Timers
- Surface: `#19221C` framed with `#344239`.
- Font: JetBrains Mono at 24px or 32px depending on viewport.
- Active Clock: Highlighted with an inset left border of 3px in `#B9D7B9` and crisp white numerals (`#F7F7F2`). Inactive clocks dim to `#9BA89E`.
- Time Trouble (< 30s): Clock border transitions dynamically to `#D76B6B` with a subtle rhythmic pulse.

### Move List & Notation
- Structured in two-column rows using JetBrains Mono 13px.
- Odd/Even rows alternate subtly between transparent and `rgba(25, 34, 28, 0.4)`.
- Current Selected Move: Background `#203B2D`, text `#B9D7B9`, border-radius 4px, accompanied by engine evaluation badge.

### Input Fields & Selectors
- Background: `#111713`.
- Border: `1px solid #344239`, radius 8px.
- Focus State: Border shifts to `#B9D7B9` with a zero-spread 1px ring; placeholder text rendered in `#9BA89E`.

### Cards & Dialog Panels
- Background: `#19221C`.
- Border: `1px solid #344239`, corner radius 16px.
- Modal backdrops apply a restrained obsidian wash: `rgba(17, 23, 19, 0.85)` with `backdrop-filter: blur(4px)`.
