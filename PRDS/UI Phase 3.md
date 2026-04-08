UI Phase 3 — Design System (RECONSTRUCTED)
Product: BWC Task Manager
Phase: UI Phase 3 — Design System & Component Library
Status: RECONSTRUCTED — Compiled from all references across UI Phase 4, 6, 7, 8, 9, 10, 10.1
Authority: This document is the single source of truth for all visual and component decisions.
Frozen: Yes — all subsequent UI phases reference this as locked. No new tokens or patterns without a new PRD.

1. Purpose
UI Phase 3 establishes the frozen design language for BWC Task Manager.
Every page, component, modal, and interaction must comply with this system.
No UI phase may:

Introduce new color tokens
Override typography rules
Create new component patterns that duplicate existing ones
Add decorative effects not listed here


2. Design Philosophy
BWC Task Manager is an internal operational tool, not a consumer product.
The design must be:

Calm — no visual noise, no attention-grabbing effects
Minimal — only what is necessary is shown
Structured — clear hierarchy, predictable layout
Premium — clean, intentional, professional
Readable — information density over decoration

Forbidden at all times:

Flashy animations
Saturated background colors
Gradient decorations
Heavy drop shadows across the board
Full-color urgency backgrounds
Anything that feels like a marketing page


3. Color System (FROZEN)
3.1 Brand Color
TokenValueUsagegold#D1AE62Primary accent — borders, active states, unread indicators, left-border highlights
This is the only brand color. It is frozen. It cannot be changed or extended.
3.2 Neutral Palette
TokenUsagewhite / #FFFFFFPage backgrounds, card surfaces, modal surfacesgray-50 / #F9FAFBSubtle section backgrounds, hover statesgray-100 / #F3F4F6Dividers, skeleton loader basegray-200 / #E5E7EBBorders, table lines, input bordersgray-400 / #9CA3AFPlaceholder text, timestamps, secondary labelsgray-600 / #4B5563Secondary body text, metadatagray-800 / #1F2937Primary body text, headingsgray-900 / #111827Page titles, strong emphasis
3.3 Semantic Colors
Used only for status indicators and feedback — never as background fills.
SemanticColorUsageSuccess#16A34A (green-600)Success toasts, completion badgesWarning#D97706 (amber-600)Warning toasts, near-due datesDanger#DC2626 (red-600)Error toasts, overdue, delete actionsInfo#2563EB (blue-600)Info toasts, neutral badges
3.4 Task Urgency Colors
These exist as badge/text colors only — never as full card backgrounds.
Urgency LabelColorUrgent & ImportantRed — #DC2626UrgentBlue — #2563EBImportantGreen — #16A34ANot Urgent & Not ImportantYellow/Amber — #D97706Same-Day (auto)Orange — #EA580C
Rule: Urgency colors appear as left-border stripes or small badge pills only. Never as full background fills on cards or rows.

4. Typography
4.1 Font

Font family: System font stack — ui-sans-serif, system-ui, -apple-system, sans-serif
No custom web fonts loaded

4.2 Scale (FROZEN)
RoleSizeWeightColorPage title (h1)24px700gray-900Section heading (h2)18px600gray-800Card heading (h3)16px600gray-800Body text15px400gray-800Secondary text14px400gray-600Label / caption13px400gray-400Timestamp12px400gray-400
15px body text is the standard. This is referenced in every UI phase as a hard rule.
4.3 Line Height

Body: 1.5
Headings: 1.25


5. Spacing System
Uses Tailwind's default 4px base unit.
TokenValueCommon usagespace-14pxIcon gaps, tight inline spacingspace-28pxInside badges, small paddingspace-312pxInput padding (vertical)space-416pxCard padding, section gapsspace-624pxSection separatorsspace-832pxPage section paddingspace-1248pxPage top padding

6. Surfaces & Elevation
BWC uses borders over shadows as the primary depth signal.
SurfaceStylePage backgroundwhite or gray-50Cardwhite, border border-gray-200, rounded-lgModalwhite, rounded-xl, shadow-xl — shadow-xl is the ONLY allowed shadowDropdownwhite, border border-gray-200, rounded-lg, shadow-smSidebarwhite or gray-50, border-r border-gray-200Headerwhite, border-b border-gray-200Table row hovergray-50 background
Shadows:

shadow-xl → modals only
shadow-sm → dropdowns only
No shadow-md, shadow-lg, or custom shadows elsewhere

Border radius:

Cards, modals, dropdowns: rounded-lg (8px) or rounded-xl (12px) for modals
Buttons: rounded-md (6px)
Badges: rounded-full
Inputs: rounded-md


7. Component Library
These components exist in the codebase. Always use them. Never rebuild from scratch.
7.1 Button
Variants:
  primary   — gold border + gold text or filled (use sparingly)
  secondary — gray border, gray-800 text
  danger    — red-600 text, shown only for destructive actions
  ghost     — no border, gray text, hover bg-gray-50

Sizes:
  sm  — px-3 py-1.5 text-sm
  md  — px-4 py-2 text-[15px]  (default)
  lg  — px-5 py-2.5 text-base

States:
  loading   — spinner replaces label, pointer-events-none
  disabled  — opacity-50, pointer-events-none

Rules:
  - Loading state on ALL submit buttons while awaiting API
  - Never show a 403 because the user clicked — hide the button instead
  - Destructive buttons always require confirmation
7.2 Input
Base:    w-full border border-gray-200 rounded-md px-3 py-2 text-[15px] text-gray-800
Focus:   border-[#D1AE62] ring-1 ring-[#D1AE62] outline-none
Error:   border-red-400 ring-1 ring-red-400
Disabled: bg-gray-50 text-gray-400 cursor-not-allowed

Label:   text-[13px] font-medium text-gray-600 mb-1
Error message: text-[13px] text-red-600 mt-1

Rules:
  - Every input has a label
  - Error messages appear below input, never as toasts for validation
  - Placeholder text: gray-400
7.3 Modal
Overlay:   fixed inset-0 bg-black/40 backdrop-blur-sm z-50
Container: bg-white rounded-xl shadow-xl max-w-lg w-full mx-4 p-6

Header:    text-lg font-semibold text-gray-900 + X close button (top right)
Body:      mt-4 space-y-4 text-[15px]
Footer:    mt-6 flex justify-end gap-3

Rules:
  - ESC key always closes modals
  - Click outside overlay closes modal (unless critical confirmation)
  - shadow-xl ONLY here
  - No scrolling body behind modal (lock scroll)
  - Confirmation modals for all destructive actions
7.4 Card
Base:    bg-white border border-gray-200 rounded-lg p-4

Hover (if clickable): border-gray-300 cursor-pointer transition-colors

Rules:
  - No shadow on cards (border only)
  - Clickable cards show pointer cursor + border darkens on hover
7.5 Table
Container:  border border-gray-200 rounded-lg overflow-hidden
Header row: bg-gray-50 border-b border-gray-200 text-[13px] font-medium text-gray-600 uppercase tracking-wide px-4 py-3
Body row:   border-b border-gray-100 last:border-0 px-4 py-3 text-[15px] text-gray-800 hover:bg-gray-50
Action cell: text-right — action buttons/links right-aligned

Rules:
  - Always use this table structure — no custom table rebuilds
  - Sortable columns show sort icon (up/down arrow)
  - Row click behavior must be clear (cursor-pointer + hover state)
7.6 Badge
Base:    inline-flex items-center px-2 py-0.5 rounded-full text-[12px] font-medium

Variants:
  default  — bg-gray-100 text-gray-700
  success  — bg-green-50 text-green-700
  warning  — bg-amber-50 text-amber-700
  danger   — bg-red-50 text-red-700
  info     — bg-blue-50 text-blue-700
  gold     — bg-[#D1AE62]/10 text-[#D1AE62]

Rules:
  - Badge backgrounds are ALWAYS light tints (bg-color-50 or /10 opacity)
  - Never use full-saturated badge backgrounds
  - Urgency badges: left-border stripe on cards, pill badge in tables/lists
7.7 Dropdown
Trigger:   Button (secondary variant) with chevron icon
Menu:      bg-white border border-gray-200 rounded-lg shadow-sm py-1 z-10 min-w-[160px]
Item:      px-4 py-2 text-[15px] text-gray-800 hover:bg-gray-50 cursor-pointer
Separator: border-t border-gray-100 my-1
Danger item: text-red-600

Rules:
  - Keyboard navigable (arrow keys + enter)
  - ESC closes
  - Click outside closes
  - Position: below trigger, right-aligned preferred
7.8 EmptyState
Container: flex flex-col items-center justify-center py-16 text-center
Icon:      text-gray-300 w-12 h-12 mb-4 (subtle icon, not decorative)
Title:     text-[16px] font-medium text-gray-500
Message:   text-[14px] text-gray-400 mt-1 max-w-xs
Action:    Optional — primary button below message

Rules:
  - Every list view MUST have an EmptyState
  - Message must be contextual (explain what goes here, not just "No data")
  - Never show a blank white area
7.9 ErrorState
Container: flex flex-col items-center justify-center py-16 text-center
Icon:      text-red-300 w-12 h-12 mb-4
Title:     "Something went wrong" text-[16px] font-medium text-gray-700
Message:   text-[14px] text-gray-500 mt-1
Action:    "Try again" button (secondary variant)

Rules:
  - Used on API failure — replaces the content area
  - Never show raw error messages or status codes to users
  - Always offer a retry action
7.10 LoadingSkeleton
Base:      bg-gray-200 rounded animate-pulse

Variants:
  line     — h-4 rounded w-full or specific width
  card     — h-32 rounded-lg w-full
  table    — rows of alternating full-width lines (simulate table rows)
  circle   — rounded-full (for avatars)

Rules:
  - Replace content area during initial fetch (not spinner-only)
  - Match the shape of the content it represents
  - No text inside skeleton
  - animate-pulse only — no other animation
7.11 Toast Notifications
Position:  top-right, fixed, z-50, stacked (newest on top)
Width:     max-w-sm
Duration:  success/info = 3s auto-dismiss, error/warning = 5s or manual dismiss

Variants:
  success  — green-600 left border + check icon
  error    — red-600 left border + x icon
  warning  — amber-600 left border + warning icon
  info     — blue-600 left border + info icon

Structure:
  - Left colored border (4px)
  - Icon + Title (font-medium)
  - Optional message below title (text-sm text-gray-600)
  - X dismiss button (top right)

Rules:
  - Never show passwords or sensitive data in toasts
  - Error toasts for API failures — not for form validation (inline errors instead)
  - Don't spam: if a polling endpoint fails, show ONE toast, not one every 30s
  - Toast text is user-friendly — no raw error codes or stack traces

8. Layout System
8.1 Global Layout
Structure:
  ┌─────────────────────────────────────────┐
  │ Header (h-16, border-b, white)          │
  ├──────────┬──────────────────────────────┤
  │ Sidebar  │ Main Content Area            │
  │ (w-64)   │ (flex-1, overflow-auto)      │
  │          │                              │
  │          │                              │
  └──────────┴──────────────────────────────┘

Header:
  - Height: h-16 (64px)
  - Background: white
  - Border: border-b border-gray-200
  - Contains: Logo/Brand + Nav items + Notification bell + User menu

Sidebar:
  - Width: w-64 (256px) desktop, collapsible on mobile
  - Background: white or gray-50
  - Border: border-r border-gray-200
  - Nav items: px-4 py-2.5 rounded-md text-[15px]
  - Active item: bg-[#D1AE62]/10 text-[#D1AE62] font-medium
  - Inactive item: text-gray-600 hover:bg-gray-50
  - Admin section: visually separated, only visible to Admin users

Main content:
  - Padding: p-6 or p-8
  - Max width: none (full width) or max-w-7xl centered
8.2 Page Structure
Every page follows:
  1. Page header row: Title (h1) + primary action button (right-aligned)
  2. Filter bar (if applicable): below header, border-b separator
  3. Content area: table, card grid, or board
  4. Pagination (if applicable): below content, centered
8.3 Responsive Breakpoints
mobile:   < 768px  — sidebar collapses to hamburger menu
tablet:   768px–1024px — sidebar may remain but content adapts
desktop:  > 1024px — full sidebar + content layout

Minimum supported width: 320px

Rules:
  - Sidebar collapses on mobile (hamburger trigger in header)
  - Modals: full-width with mx-4 padding on mobile
  - Tables: horizontal scroll on mobile (overflow-x-auto)
  - Card grids: stack to single column on mobile
  - Kanban boards: horizontal scroll (don't collapse columns)

9. Sidebar Navigation Structure
Navigation items (in order):
  Dashboard
  Tasks
  Projects
  Events
  Documents
  Contacts          ← Phase 12
  Companies         ← Phase 11
  Payments          ← Phase 13
  Cars              ← Phase 15
  Analytics         ← Phase 16
  ── (separator) ──
  Chat              ← Phase 14
  ── (separator) ──
  Admin ▼           ← Admin only (hidden for all other roles)
    Users
    Activity Log

Rules:
  - Active route: gold accent (bg-[#D1AE62]/10 text-[#D1AE62])
  - Admin section: only rendered if user.user_type === 'Admin'
  - No disabled ghost items — hide items the user has no access to
  - No nested nav beyond Admin section
  - Notification bell: in Header, not sidebar

10. Header Structure
Left:    Logo / Brand name "BWC"
Center:  (empty or global search trigger)
Right:   Notification Bell → User name + Role badge → Logout

Notification Bell:
  - Bell icon (🔔 or Heroicon)
  - Unread badge: red circle, count capped at 99+, hidden when 0
  - Opens dropdown panel on click

User info:
  - Full Name (First + Last)
  - Role badge (Admin | Manager | etc.) — subtle, not decorative
  - Logout button or dropdown

11. Interaction Rules
11.1 Loading States
Rules:
  - ALL data fetches show LoadingSkeleton (not spinners alone)
  - ALL form submits disable + show spinner on the button
  - No blank screens during loading
  - No layout shifting after load
11.2 Form Behavior
Rules:
  - Validation errors: inline, below the field, red-600 text-[13px]
  - Required fields: marked with * (asterisk)
  - Submit button: loading state during API call, disabled after success until modal closes
  - On success: close modal + toast + refetch list
  - On error: keep modal open + show inline or toast error
  - ESC: always closes modal (even mid-form)
11.3 Confirmation Dialogs
Used for:
  - All delete actions
  - Irreversible status changes
  - Password reset display

Pattern:
  Modal with:
    Title: "Delete [Entity Name]?"
    Message: "This action cannot be undone." (or relevant warning)
    Buttons: Cancel (secondary) + Confirm (danger variant)
11.4 Permission-Gated UI
Rules:
  - HIDE buttons the user cannot use (do not disable them)
  - Never rely on backend 403 as primary UX feedback
  - Check user permission level BEFORE rendering action buttons
  - Admin-only controls: only rendered if user.user_type === 'Admin'
11.5 Navigation
Rules:
  - Row clicks (table rows, card clicks) navigate to detail page
  - Back navigation: browser back or explicit back link
  - No full page reload on navigation (Next.js client routing)
  - Active nav item highlighted in sidebar

12. Accessibility Requirements
Required on all interactive elements:
  - aria-label on icon-only buttons
  - focus: outline-2 ring-[#D1AE62] on keyboard focus
  - ESC key closes modals and dropdowns
  - Keyboard navigation in dropdowns (arrow keys + enter + escape)
  - Focus trap inside open modals

Color contrast:
  - All text meets WCAG AA (4.5:1 for body text)
  - Gray-400 on white is acceptable for timestamps/captions
  - Never use color alone to convey meaning — always pair with text/icon

13. File Structure (Frontend Components)
frontend/
  components/
    ui/
      Button.tsx
      Input.tsx
      Modal.tsx
      Card.tsx
      Table.tsx
      Badge.tsx
      Dropdown.tsx
      EmptyState.tsx
      ErrorState.tsx
      LoadingSkeleton.tsx
      Toast.tsx (or use a library like react-hot-toast)
    layout/
      Sidebar.tsx
      Header.tsx
      ProtectedLayout.tsx
      AdminRoute.tsx
    notifications/
      NotificationBell.tsx
      NotificationDropdown.tsx

14. What Is Explicitly Forbidden
The following are banned across all UI phases and modules:
❌ Full saturated background colors on cards or rows
❌ New color tokens beyond what's listed in Section 3
❌ Custom shadow scales (only shadow-sm and shadow-xl allowed)
❌ Gradient backgrounds or decorative gradients
❌ Animations beyond animate-pulse (skeleton) and standard transitions
❌ Inline styles (use Tailwind classes only)
❌ Showing raw API errors or stack traces to users
❌ Optimistic UI updates (wait for API response)
❌ Passwords or tokens in toast messages or logs
❌ Disabled buttons where hiding is more appropriate
❌ Blank white screens during loading
❌ New component patterns that duplicate existing ones
❌ Emoji as primary UI elements (exception: EmptyState subtle use is OK)

15. Design Tokens Quick Reference (Cursor Cheatsheet)
Brand gold:        #D1AE62
Body text:         15px, gray-800
Secondary text:    14px, gray-600
Labels/timestamps: 13px / 12px, gray-400
Border color:      gray-200
Card background:   white + border-gray-200
Page background:   white or gray-50
Modal shadow:      shadow-xl (ONLY here)
Dropdown shadow:   shadow-sm
Button radius:     rounded-md
Card radius:       rounded-lg
Modal radius:      rounded-xl
Focus ring:        ring-[#D1AE62]
Active nav:        bg-[#D1AE62]/10 text-[#D1AE62]
Skeleton:          bg-gray-200 animate-pulse

16. Acceptance Criteria
UI Phase 3 is considered satisfied when:

 Every page uses white/gray-50 surfaces — no colored page backgrounds
 All body text is 15px
 Gold (#D1AE62) is used only for accents, active states, and left-border indicators
 No new color tokens introduced in any subsequent phase
 All modals use shadow-xl exclusively
 Cards use borders only (no shadow)
 All interactive elements have keyboard + focus support
 EmptyState, ErrorState, LoadingSkeleton are used on every list/data page
 No raw API errors shown to users
 All destructive actions behind confirmation modal


RECONSTRUCTION NOTE
This document was reconstructed from cross-references in:

UI Phase 4 (Interaction Model)
UI Phase 6 (Admin Authority Surfaces)
UI Phase 7 (Audit Surfaces)
UI Phase 8 (Notifications UI)
UI Phase 9 (System Polish)
Phase 10.1 (Notification hardening)

All rules marked as "frozen" or "must follow Phase 3" across those documents have been compiled here.
If the original UI Phase 3 file is found, it takes precedence. This reconstruction should be treated as authoritative until then.