# Global UI Theme System

## AI Instructions

Always read and follow this theme specification before starting any UI design or frontend development task.

Use this file as the single source of truth for:

* Colors
* Typography
* Spacing
* Borders
* Shadows
* Buttons
* Forms
* Cards
* Icons
* Responsive behavior
* Accessibility
* Component consistency

Do not create separate visual styles for individual pages unless the task specifically requires them.

All pages and components must follow this design system.

---

# 1. Design Direction

Create a modern, premium, clean, and professional SaaS interface.

The design should feel:

* Simple
* Elegant
* Trustworthy
* Spacious
* Consistent
* Easy to understand
* Professional
* Client-friendly

Use a minimal visual style with clear hierarchy and subtle details.

Avoid:

* Excessive gradients
* Very bright neon colors
* Heavy shadows
* Too many border styles
* Unnecessary animations
* Overly rounded components
* Crowded layouts
* Inconsistent spacing

---

# 2. Primary Brand Color

Green is the main brand color.

## Primary Green

```css
--color-primary: #16A34A;
```

Use the primary green for:

* Primary buttons
* Active navigation items
* Links
* Selected controls
* Active tabs
* Progress indicators
* Focus states
* Important icons
* Success-oriented actions

## Primary Hover

```css
--color-primary-hover: #15803D;
```

## Primary Active

```css
--color-primary-active: #166534;
```

## Primary Light

```css
--color-primary-light: #F0FDF4;
```

Use this for:

* Selected menu backgrounds
* Soft highlights
* Active cards
* Success panels
* Hover backgrounds

## Primary Soft

```css
--color-primary-soft: #DCFCE7;
```

## Primary Border

```css
--color-primary-border: #86EFAC;
```

## Primary Text

```css
--color-primary-text: #166534;
```

---

# 3. Complete Color System

## Background Colors

```css
--color-background: #F8FAFC;
--color-surface: #FFFFFF;
--color-surface-secondary: #F1F5F9;
--color-surface-hover: #F8FAFC;
--color-overlay: rgba(15, 23, 42, 0.45);
```

## Text Colors

```css
--color-text-primary: #0F172A;
--color-text-secondary: #475569;
--color-text-muted: #64748B;
--color-text-placeholder: #94A3B8;
--color-text-disabled: #CBD5E1;
--color-text-inverse: #FFFFFF;
```

## Border Colors

```css
--color-border: #E2E8F0;
--color-border-strong: #CBD5E1;
--color-border-light: #F1F5F9;
--color-focus: #16A34A;
```

## Success Colors

```css
--color-success: #16A34A;
--color-success-hover: #15803D;
--color-success-background: #F0FDF4;
--color-success-border: #BBF7D0;
--color-success-text: #166534;
```

## Warning Colors

```css
--color-warning: #D97706;
--color-warning-background: #FFFBEB;
--color-warning-border: #FDE68A;
--color-warning-text: #92400E;
```

## Error Colors

```css
--color-error: #DC2626;
--color-error-hover: #B91C1C;
--color-error-background: #FEF2F2;
--color-error-border: #FECACA;
--color-error-text: #991B1B;
```

## Information Colors

```css
--color-info: #0284C7;
--color-info-background: #F0F9FF;
--color-info-border: #BAE6FD;
--color-info-text: #075985;
```

---

# 4. CSS Theme Variables

```css
:root {
  /* Brand */
  --color-primary: #16A34A;
  --color-primary-hover: #15803D;
  --color-primary-active: #166534;
  --color-primary-light: #F0FDF4;
  --color-primary-soft: #DCFCE7;
  --color-primary-border: #86EFAC;
  --color-primary-text: #166534;

  /* Backgrounds */
  --color-background: #F8FAFC;
  --color-surface: #FFFFFF;
  --color-surface-secondary: #F1F5F9;
  --color-surface-hover: #F8FAFC;
  --color-overlay: rgba(15, 23, 42, 0.45);

  /* Text */
  --color-text-primary: #0F172A;
  --color-text-secondary: #475569;
  --color-text-muted: #64748B;
  --color-text-placeholder: #94A3B8;
  --color-text-disabled: #CBD5E1;
  --color-text-inverse: #FFFFFF;

  /* Borders */
  --color-border: #E2E8F0;
  --color-border-strong: #CBD5E1;
  --color-border-light: #F1F5F9;
  --color-focus: #16A34A;

  /* Status */
  --color-success: #16A34A;
  --color-success-background: #F0FDF4;
  --color-warning: #D97706;
  --color-warning-background: #FFFBEB;
  --color-error: #DC2626;
  --color-error-background: #FEF2F2;
  --color-info: #0284C7;
  --color-info-background: #F0F9FF;

  /* Typography */
  --font-family-base: "Inter", "Segoe UI", Arial, sans-serif;

  /* Font Sizes */
  --font-size-xs: 12px;
  --font-size-sm: 14px;
  --font-size-md: 16px;
  --font-size-lg: 18px;
  --font-size-xl: 20px;
  --font-size-2xl: 24px;
  --font-size-3xl: 30px;
  --font-size-4xl: 36px;

  /* Font Weights */
  --font-weight-regular: 400;
  --font-weight-medium: 500;
  --font-weight-semibold: 600;
  --font-weight-bold: 700;

  /* Line Heights */
  --line-height-tight: 1.2;
  --line-height-heading: 1.3;
  --line-height-body: 1.5;
  --line-height-relaxed: 1.7;

  /* Spacing */
  --space-1: 4px;
  --space-2: 8px;
  --space-3: 12px;
  --space-4: 16px;
  --space-5: 20px;
  --space-6: 24px;
  --space-8: 32px;
  --space-10: 40px;
  --space-12: 48px;
  --space-16: 64px;

  /* Radius */
  --radius-xs: 4px;
  --radius-sm: 6px;
  --radius-md: 8px;
  --radius-lg: 12px;
  --radius-xl: 16px;
  --radius-full: 999px;

  /* Shadows */
  --shadow-xs: 0 1px 2px rgba(15, 23, 42, 0.04);
  --shadow-sm: 0 1px 3px rgba(15, 23, 42, 0.08);
  --shadow-md: 0 6px 18px rgba(15, 23, 42, 0.10);
  --shadow-lg: 0 16px 40px rgba(15, 23, 42, 0.14);

  /* Component Heights */
  --height-sm: 36px;
  --height-md: 44px;
  --height-lg: 52px;

  /* Transitions */
  --transition-fast: 120ms ease;
  --transition-default: 160ms ease;
  --transition-slow: 240ms ease;

  /* Layout */
  --content-max-width: 1280px;
  --sidebar-width: 240px;
  --sidebar-collapsed-width: 80px;
  --header-height: 64px;
}
```

---

# 5. Typography

Use **Inter** as the main font throughout the entire application.

```css
font-family: var(--font-family-base);
```

Recommended import:

```css
@import url("https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap");
```

## Typography Rules

Use only these font weights:

```css
400
500
600
700
```

Do not use font weights above 700.

## Heading Styles

### Display Heading

```css
font-size: 36px;
font-weight: 700;
line-height: 1.2;
letter-spacing: -0.03em;
color: var(--color-text-primary);
```

### Page Heading

```css
font-size: 30px;
font-weight: 700;
line-height: 1.3;
letter-spacing: -0.02em;
color: var(--color-text-primary);
```

### Section Heading

```css
font-size: 20px;
font-weight: 600;
line-height: 1.4;
color: var(--color-text-primary);
```

### Component Heading

```css
font-size: 16px;
font-weight: 600;
line-height: 1.5;
color: var(--color-text-primary);
```

## Body Styles

### Standard Body

```css
font-size: 14px;
font-weight: 400;
line-height: 1.6;
color: var(--color-text-secondary);
```

### Large Body

```css
font-size: 16px;
font-weight: 400;
line-height: 1.6;
color: var(--color-text-secondary);
```

### Small Text

```css
font-size: 12px;
font-weight: 400;
line-height: 1.5;
color: var(--color-text-muted);
```

### Label

```css
font-size: 14px;
font-weight: 600;
line-height: 1.4;
color: var(--color-text-primary);
```

---

# 6. Spacing System

Use an 8-point spacing system.

Approved spacing values:

```css
4px
8px
12px
16px
20px
24px
32px
40px
48px
64px
```

Do not use random spacing values unless technically required.

Recommended usage:

```css
Label to field: 8px
Field to helper text: 6px
Related items: 12px
Component padding: 16px
Card padding: 24px
Gap between cards: 16px
Section spacing: 32px
Major layout spacing: 48px
```

---

# 7. Border Radius

Use consistent border radius values.

```css
Small elements: 6px
Inputs: 8px
Buttons: 8px
Navigation items: 8px
Cards: 12px
Dropdowns: 12px
Modals: 16px
Avatars and badges: 999px
```

Avoid using large rounded corners everywhere.

Use pill shapes only for:

* Tags
* Status badges
* Filters
* Small selection controls

---

# 8. Shadows

Use subtle shadows.

## Cards

```css
box-shadow: var(--shadow-xs);
border: 1px solid var(--color-border);
```

## Dropdowns

```css
box-shadow: var(--shadow-md);
```

## Modals

```css
box-shadow: var(--shadow-lg);
```

Do not use dark or heavy shadows on normal cards.

---

# 9. Buttons

All buttons must have clear states:

* Default
* Hover
* Active
* Focus
* Disabled
* Loading

## Primary Button

```css
.button-primary {
  height: 44px;
  padding: 0 20px;
  border: none;
  border-radius: 8px;
  background: var(--color-primary);
  color: var(--color-text-inverse);
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition:
    background var(--transition-default),
    box-shadow var(--transition-default),
    transform var(--transition-fast);
}
```

```css
.button-primary:hover {
  background: var(--color-primary-hover);
}
```

```css
.button-primary:active {
  background: var(--color-primary-active);
  transform: translateY(1px);
}
```

```css
.button-primary:focus-visible {
  outline: none;
  box-shadow: 0 0 0 4px rgba(22, 163, 74, 0.18);
}
```

```css
.button-primary:disabled {
  background: #A7F3D0;
  color: #FFFFFF;
  cursor: not-allowed;
  opacity: 0.75;
}
```

## Secondary Button

```css
.button-secondary {
  height: 44px;
  padding: 0 20px;
  border: 1px solid var(--color-border-strong);
  border-radius: 8px;
  background: var(--color-surface);
  color: var(--color-text-secondary);
  font-size: 14px;
  font-weight: 600;
}
```

```css
.button-secondary:hover {
  background: var(--color-surface-hover);
  border-color: var(--color-primary-border);
  color: var(--color-primary-text);
}
```

## Destructive Button

```css
background: var(--color-error);
color: #FFFFFF;
```

Use destructive buttons only for dangerous actions such as:

* Delete
* Remove permanently
* Cancel subscription
* Revoke access

---

# 10. Form Controls

All form controls should use the same visual system.

## Input Style

```css
.input {
  width: 100%;
  height: 44px;
  padding: 0 14px;
  border: 1px solid var(--color-border-strong);
  border-radius: 8px;
  background: var(--color-surface);
  color: var(--color-text-primary);
  font-size: 14px;
  transition:
    border-color var(--transition-default),
    box-shadow var(--transition-default);
}
```

## Placeholder

```css
.input::placeholder {
  color: var(--color-text-placeholder);
}
```

## Input Hover

```css
.input:hover {
  border-color: #94A3B8;
}
```

## Input Focus

```css
.input:focus {
  outline: none;
  border-color: var(--color-primary);
  box-shadow: 0 0 0 3px rgba(22, 163, 74, 0.14);
}
```

## Error State

```css
.input-error {
  border-color: var(--color-error);
  box-shadow: 0 0 0 3px rgba(220, 38, 38, 0.10);
}
```

## Disabled State

```css
.input:disabled {
  background: var(--color-surface-secondary);
  color: var(--color-text-disabled);
  cursor: not-allowed;
}
```

## Form Rules

Every form field should include:

* Visible label
* Input or control
* Optional helper text
* Validation message
* Required indicator when necessary

Do not use placeholders as replacements for labels.

---

# 11. Cards

Cards should be clean and subtle.

```css
.card {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: 12px;
  box-shadow: var(--shadow-xs);
  padding: 24px;
}
```

## Interactive Card

```css
.card-interactive {
  transition:
    border-color var(--transition-default),
    box-shadow var(--transition-default),
    transform var(--transition-default);
}
```

```css
.card-interactive:hover {
  border-color: var(--color-primary-border);
  box-shadow: var(--shadow-sm);
  transform: translateY(-1px);
}
```

## Selected Card

```css
.card-selected {
  border-color: var(--color-primary);
  background: var(--color-primary-light);
}
```

---

# 12. Navigation

Use the primary green for active navigation states.

## Default Navigation Item

```css
color: var(--color-text-secondary);
background: transparent;
```

## Hover State

```css
background: var(--color-surface-secondary);
color: var(--color-text-primary);
```

## Active State

```css
background: var(--color-primary-light);
color: var(--color-primary-text);
```

The active navigation icon should use:

```css
color: var(--color-primary);
```

Navigation item dimensions:

```css
min-height: 44px;
padding: 0 12px;
border-radius: 8px;
gap: 12px;
```

---

# 13. Icons

Use one consistent icon library.

Recommended:

```text
Lucide Icons
```

Icon rules:

```css
Small icon: 16px
Default icon: 20px
Large icon: 24px
Stroke width: 1.75px to 2px
```

Use outline icons by default.

Do not mix multiple icon styles.

Icons should support labels, not replace important text.

---

# 14. Status Badges

## Success Badge

```css
background: var(--color-success-background);
color: var(--color-success-text);
border: 1px solid var(--color-success-border);
```

## Warning Badge

```css
background: var(--color-warning-background);
color: var(--color-warning-text);
border: 1px solid var(--color-warning-border);
```

## Error Badge

```css
background: var(--color-error-background);
color: var(--color-error-text);
border: 1px solid var(--color-error-border);
```

## Information Badge

```css
background: var(--color-info-background);
color: var(--color-info-text);
border: 1px solid var(--color-info-border);
```

Badge shape:

```css
padding: 4px 8px;
border-radius: 999px;
font-size: 12px;
font-weight: 600;
```

---

# 15. Layout Rules

## Main Content

```css
max-width: 1280px;
margin: 0 auto;
padding: 32px;
```

## Desktop

* Full sidebar
* Spacious content area
* Multi-column layouts where appropriate
* Maximum content width of 1280px

## Tablet

* Collapsed or hidden sidebar
* Reduced content padding
* Two-column layouts only when enough space is available

## Mobile

* Single-column layouts
* Sidebar becomes a drawer
* Full-width primary buttons when appropriate
* Page padding reduces to 16px
* Minimum touch target size of 44px

## Breakpoints

```css
--breakpoint-sm: 640px;
--breakpoint-md: 768px;
--breakpoint-lg: 1024px;
--breakpoint-xl: 1280px;
```

---

# 16. Accessibility

All designs must follow accessibility best practices.

Requirements:

* Minimum text contrast ratio of 4.5:1
* Visible keyboard focus states
* Proper labels for all form controls
* Keyboard-accessible navigation
* Accessible dropdowns and modals
* Descriptive button labels
* Error messages connected to fields
* Do not communicate status using color alone
* Minimum interactive target size of 44px
* Use semantic HTML wherever possible
* Support screen readers
* Respect reduced-motion preferences

Example:

```css
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}
```

---

# 17. Animation Rules

Use simple and subtle transitions.

```css
transition-duration: 120ms to 200ms;
transition-timing-function: ease;
```

Allowed animations:

* Button hover
* Input focus
* Dropdown opening
* Modal entrance
* Tab switching
* Card hover
* Loading indicator
* Toast notification

Avoid:

* Long animations
* Bouncing effects
* Excessive movement
* Large zoom effects
* Animations that delay user actions

---

# 18. Dark Theme Preparation

The default theme is light.

Structure the code so a dark theme can be added later through CSS variables.

Do not hardcode colors directly inside components when a theme variable already exists.

Use:

```css
color: var(--color-text-primary);
background: var(--color-surface);
border-color: var(--color-border);
```

Do not use:

```css
color: #0F172A;
background: #FFFFFF;
```

inside individual components unless absolutely necessary.

---

# 19. Global Development Rules

The AI developer must follow these rules:

1. Read this theme file before starting every frontend task.
2. Reuse existing design tokens.
3. Do not introduce random colors.
4. Do not introduce random spacing values.
5. Do not create a new font system.
6. Do not mix icon libraries.
7. Use the green brand color consistently.
8. Keep the interface clean and professional.
9. Maintain consistent component heights.
10. Use CSS variables instead of repeated hardcoded values.
11. Make every component responsive.
12. Include hover, focus, active, disabled, error, and loading states.
13. Maintain accessibility standards.
14. Avoid page-specific styling inside the global theme.
15. Create reusable components instead of duplicating styles.
16. Preserve visual consistency across the entire application.

---

# 20. Final Theme Summary

The application should use:

```text
Primary color: Green
Primary hex: #16A34A
Primary hover: #15803D
Primary light background: #F0FDF4
Main background: #F8FAFC
Card background: #FFFFFF
Main text: #0F172A
Secondary text: #475569
Default border: #E2E8F0
Font: Inter
Input height: 44px
Button height: 44px
Card radius: 12px
Input and button radius: 8px
Maximum content width: 1280px
Spacing system: 8-point system
Icon library: Lucide Icons
Default theme: Light
```

This theme must remain consistent across every page, feature, component, modal, form, dashboard, table, navigation item, and responsive layout.
