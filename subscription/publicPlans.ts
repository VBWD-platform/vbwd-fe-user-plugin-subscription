/**
 * S154 D10 — the single holder of the public tarif-plan pages' config, so the
 * route registrations (index.ts) and the views agree on where the pages live
 * and whether they are indexable.
 *
 * Set once at install time from the backend single source of truth
 * (`GET /api/v1/subscription/config` → `plans_slug`, `seo_index_tarif_plans`,
 * the ghrm catalogue-base pattern). The base is operator-configurable, so it
 * is never hardcoded; until (or unless) the fetch resolves it is `/plans`.
 */
const DEFAULT_PLANS_SLUG = 'plans';
const INDEXABLE_ROBOTS = 'index,follow';
const NOT_INDEXABLE_ROBOTS = 'noindex,follow';

export interface PublicPlansConfig {
  plans_slug?: string;
  seo_index_tarif_plans?: boolean;
}

let resolvedPlansBase = `/${DEFAULT_PLANS_SLUG}`;
let resolvedIndexable = true;

/** Adopt the backend config; blank or missing values keep the defaults. */
export function setPublicPlansConfig(config: PublicPlansConfig): void {
  const slug = (config.plans_slug ?? '').trim().replace(/^\/+/, '').replace(/\/+$/, '');
  resolvedPlansBase = `/${slug || DEFAULT_PLANS_SLUG}`;
  resolvedIndexable = config.seo_index_tarif_plans !== false;
}

/** The public plan list path — a leading slash, never a trailing one. */
export function publicPlansBase(): string {
  return resolvedPlansBase;
}

/** The public detail path of one plan (its slug as one encoded segment). */
export function publicPlanPath(planSlug: string): string {
  return `${resolvedPlansBase}/${encodeURIComponent(planSlug)}`;
}

/** The pages' robots, from the `seo_index_tarif_plans` switch (D7). */
export function publicPlansRobots(): string {
  return resolvedIndexable ? INDEXABLE_ROBOTS : NOT_INDEXABLE_ROBOTS;
}

/** A plan's `features` as display lines: a list's items, a mapping's `key: value`. */
export function planFeatures(features: unknown): string[] {
  if (Array.isArray(features)) {
    return features.map((feature) => String(feature).trim()).filter(Boolean);
  }
  if (features && typeof features === 'object') {
    return Object.entries(features).map(([name, value]) => `${name}: ${String(value)}`);
  }
  return [];
}
