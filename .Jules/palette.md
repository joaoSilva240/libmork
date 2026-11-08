# Palette's Journal - Critical Learnings

## 2025-02-17 - Shared Form Field Accessibility Pattern

**Learning:** Reusable form components like `Input` often receive `label` and `error` as plain strings without automatic `id`, `htmlFor`, and `aria-describedby` linkage. Using React's `useId()` (with fallback to provided `id`) provides seamless label association, automatic `aria-invalid`, and screen-reader announced error messages (`role="alert"`) across every form using the component without manual wiring at every call site.
**Action:** When designing or refactoring reusable input/form components in this design system, always integrate `useId()`, `htmlFor`, `aria-invalid`, and `aria-describedby` by default, including accessible required indicators (`<span aria-hidden="true">*</span>`).
