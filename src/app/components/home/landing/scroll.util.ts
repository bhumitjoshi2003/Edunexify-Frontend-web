/** Smooth-scrolls to a section by id, instantly when the user prefers reduced motion. Returns whether it found it. */
export function scrollToSection(id: string): boolean {
  if (typeof document === 'undefined') return false;
  const el = document.getElementById(id);
  if (!el) return false;
  const reduce = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  el.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
  if (typeof history !== 'undefined') history.replaceState(null, '', `#${id}`);
  return true;
}
