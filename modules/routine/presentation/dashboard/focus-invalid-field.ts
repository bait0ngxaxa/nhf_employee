export function focusFirstRoutineInvalidField(
    errors: Record<string, string>,
): void {
    const firstPath = Object.keys(errors)[0];
    if (!firstPath || typeof document === "undefined") return;

    window.requestAnimationFrame(() => {
        const field = Array.from(
            document.querySelectorAll<HTMLElement>("[data-routine-field]"),
        ).find((element) => element.dataset.routineField === firstPath);
        if (!field) return;

        const details = field.closest("details");
        if (details) details.open = true;

        const prefersReducedMotion = typeof window.matchMedia === "function"
            && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        field.focus({ preventScroll: true });
        field.scrollIntoView({
            behavior: prefersReducedMotion ? "auto" : "smooth",
            block: "center",
        });
    });
}
