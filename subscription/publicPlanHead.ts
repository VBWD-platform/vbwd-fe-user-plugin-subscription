/**
 * S154 D10 — the public plan pages' own SEO head in vue mode.
 *
 * Reuses the cms plugin's `injectSeoMeta` (updates the `data-seo="ssr"` tags in
 * place, owns `document.title`) — the same tags theme mode renders server-side.
 * cms is a SOFT dependency (like the TariffPlanCollection widget registration):
 * without it the pages still render, only the head is left as is.
 */
const TITLE_SEPARATOR = ' — ';

export interface PublicPlanHead {
  subject: string;
  siteName: string;
  description: string;
  path: string;
  robots: string;
}

/** The `injectSeoMeta` source of one public plan page. */
export function publicPlanSeoSource(head: PublicPlanHead): Record<string, string> {
  const title = head.siteName ? `${head.subject}${TITLE_SEPARATOR}${head.siteName}` : head.subject;
  return {
    meta_title: title,
    meta_description: head.description,
    robots: head.robots,
    canonical_url: `${window.location.origin}${head.path}`,
    og_title: title,
    og_description: head.description,
  };
}

/** Apply a head source through the cms seam; a no-op when cms is not installed. */
export async function applySeoHead(source: Record<string, string>): Promise<void> {
  try {
    const { injectSeoMeta } = await import('../../cms/src/composables/useSeoHandoff');
    injectSeoMeta(source);
  } catch {
    // cms plugin not installed — keep the document head as is.
  }
}

/** Plain text of an HTML/plain description (tags dropped, entities decoded). */
export function plainText(html: string | null | undefined): string {
  if (!html) return '';
  const parsed = new DOMParser().parseFromString(html, 'text/html');
  return (parsed.body.textContent ?? '').replace(/\s+/g, ' ').trim();
}
