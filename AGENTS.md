# Codex Project Instructions

## Global Theme Requirement

Before starting any frontend, UI, styling, component, layout, or design-related task, read:

```text
docs/THEME.md
```

Treat `docs/THEME.md` as the single source of truth for the application's visual design system.

All frontend work must follow its:

* Color tokens
* Green primary brand color
* Typography
* Font sizes
* Font weights
* Spacing system
* Border-radius values
* Shadows
* Form styles
* Button styles
* Card styles
* Navigation states
* Icon rules
* Responsive behavior
* Accessibility requirements
* Animation rules

Do not introduce random colors, fonts, spacing values, shadows, border radiuses, or component styles.

Do not create a new page-specific theme unless the user explicitly requests one.

Reuse the existing CSS variables and design tokens from `docs/THEME.md`.

When an existing implementation conflicts with the theme file, update the implementation to follow the theme while preserving functionality.

## Frontend Development Rules

For every frontend task:

1. Read `docs/THEME.md` before making changes.
2. Inspect the existing component and styling structure.
3. Reuse existing shared components where possible.
4. Use the established green primary color.
5. Use Inter as the primary font.
6. Use Lucide icons unless the project already uses another approved icon library.
7. Implement responsive layouts for mobile, tablet, and desktop.
8. Include hover, focus, active, disabled, loading, and error states where relevant.
9. Follow accessibility best practices.
10. Do not hardcode theme values when a design token is available.
11. Keep page-specific CSS limited to layout and content requirements.
12. Maintain visual consistency across the entire application.

## Validation

Before completing a frontend task, verify that:

* The theme file was followed.
* No unnecessary colors were introduced.
* Typography is consistent.
* Spacing follows the approved scale.
* Components work on mobile and desktop.
* Keyboard focus states are visible.
* Interactive elements have appropriate states.
* Existing functionality was not broken.
