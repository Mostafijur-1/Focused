# Self-hosted UI fonts

Focused self-hosts the variable font subsets required by the bilingual interface so production builds, Docker builds, previews, and tests do not contact Google Fonts.

- `inter-latin.woff2` — Inter variable Latin subset
- `noto-sans-bengali.woff2` — Noto Sans Bengali variable Bengali subset

Both font families are distributed under the SIL Open Font License 1.1. Upstream projects:

- Inter: <https://github.com/rsms/inter>
- Noto Sans Bengali: <https://github.com/notofonts/bengali>

The files were emitted by Next.js font optimization from the approved upstream Google Fonts CSS during the pinned Next.js 16.2.12 production build. When updating a font, verify its license, Bangla shaping, weight range, rendered subset, layout shift, and visual regression before replacing these files.
