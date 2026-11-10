/**
 * S154 D10 — `publicPlans`: the single holder of the public plan pages' base path
 * and indexable switch (set once at install from `GET /api/v1/subscription/config`),
 * plus the shared plan-features normaliser the public detail renders.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import {
  planFeatures,
  publicPlanPath,
  publicPlansBase,
  publicPlansRobots,
  setPublicPlansConfig,
} from '../../subscription/publicPlans';

describe('publicPlans config holder', () => {
  beforeEach(() => {
    setPublicPlansConfig({});
  });

  it('defaults to /plans and index,follow', () => {
    expect(publicPlansBase()).toBe('/plans');
    expect(publicPlansRobots()).toBe('index,follow');
  });

  it('normalises a slashed slug to one absolute base', () => {
    setPublicPlansConfig({ plans_slug: ' /pricing/ ' });
    expect(publicPlansBase()).toBe('/pricing');
  });

  it('falls back to /plans for a blank slug', () => {
    setPublicPlansConfig({ plans_slug: '  ' });
    expect(publicPlansBase()).toBe('/plans');
  });

  it('is noindex,follow when the switch is off', () => {
    setPublicPlansConfig({ seo_index_tarif_plans: false });
    expect(publicPlansRobots()).toBe('noindex,follow');
  });

  it('builds a detail path with the plan slug as one encoded segment', () => {
    setPublicPlansConfig({ plans_slug: 'pricing' });
    expect(publicPlanPath('pro')).toBe('/pricing/pro');
    expect(publicPlanPath('a b/c')).toBe('/pricing/a%20b%2Fc');
  });
});

describe('planFeatures', () => {
  it('keeps a list of non-blank items', () => {
    expect(planFeatures(['A', ' ', 'B'])).toEqual(['A', 'B']);
  });

  it('turns a mapping into "key: value" lines', () => {
    expect(planFeatures({ users: 10, storage_gb: 5 })).toEqual(['users: 10', 'storage_gb: 5']);
  });

  it('ignores anything else', () => {
    expect(planFeatures(null)).toEqual([]);
    expect(planFeatures('free text')).toEqual([]);
  });
});
