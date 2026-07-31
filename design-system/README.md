# Focused Design System

Focused uses a Bangla-first semantic design system for Next.js, Tailwind CSS, and shadcn/ui.

## Source of truth

- `tokens.css`: light/dark semantic colors, glass surfaces, focus treatment, and accessibility fallbacks.
- `tokens.ts`: layout, spacing, typography, motion, control, and z-index primitives.
- `i18n/bn-BD.ts`: human-authored Bangla interface copy.
- `i18n/en.ts`: English secondary locale with the same typed key shape.
- `docs/Focused_UI_UX_Design_System.md`: product, component, page, responsive, content, and accessibility specification.

## Rules

1. Use semantic tokens; feature code must not introduce raw brand colors.
2. Default locale is `bn-BD`; English is optional and user-selectable.
3. Bangla copy must be written or reviewed by a native Bangla editor. Machine translation is prohibited.
4. Technical terms in the approved glossary remain English.
5. Glass is reserved for navigation, overlays, and AI surfaces. Normal content uses opaque cards.
6. Every interactive component implements keyboard, focus, loading, empty, error, disabled, offline, and reduced-motion behavior where applicable.
