/**
 * S154 D10 — public tarif-plan pages: install-time routes from the backend config.
 *
 * The subscription plugin reads `plans_slug` + `seo_index_tarif_plans` from the
 * public `GET /api/v1/subscription/config` at install time (the ghrm catalogue
 * base pattern) and mounts two PUBLIC routes under that base:
 *   /<plans_slug>              → PublicPlans.vue        name public-plans
 *   /<plans_slug>/:planSlug    → PublicPlanDetail.vue   name public-plan-detail
 * The base is never hardcoded; a failed fetch keeps the documented default
 * `/plans` (install must never throw). The private /dashboard routes stay.
 *
 * The fake sits at the transport (axios adapter on the host api singleton) and
 * answers the literal backend JSON.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AxiosError, type AxiosInstance, type InternalAxiosRequestConfig } from 'axios';
import { api } from '@/api';

vi.mock('@/plugins/userNavRegistry', () => ({
  userNavRegistry: { register: vi.fn(), unregister: vi.fn() },
}));
vi.mock('@/registries/checkoutSourceRegistry', () => ({
  checkoutSourceRegistry: { register: vi.fn(), unregister: vi.fn() },
}));
vi.mock('../../../cms/src/registry/vueComponentRegistry', () => ({
  registerCmsVueComponent: vi.fn(),
}));

import { subscriptionPlugin } from '../../index';
import { publicPlansBase, publicPlansRobots } from '../../subscription/publicPlans';

const PRODUCTION_BASE_URL = '/api/v1';
const HTTP_OK = 200;
const HTTP_SERVER_ERROR = 500;

interface CapturedRoute {
  path: string;
  name: string;
  meta?: Record<string, unknown>;
}

function installFakeTransport(status: number, data: unknown): void {
  const transport = (api as unknown as { axiosInstance: AxiosInstance }).axiosInstance;
  transport.defaults.baseURL = PRODUCTION_BASE_URL;
  transport.defaults.adapter = async (config: InternalAxiosRequestConfig) => {
    const path = `${config.baseURL ?? ''}${config.url ?? ''}`;
    if (path !== '/api/v1/subscription/config') {
      throw new AxiosError('unexpected request', 'ERR_BAD_REQUEST', config);
    }
    const response = { data, status, statusText: String(status), headers: {}, config };
    if (status >= 400) {
      throw new AxiosError(`Request failed with status code ${status}`, 'ERR_BAD_RESPONSE', config, {}, response);
    }
    return response;
  };
}

async function install(): Promise<Record<string, CapturedRoute>> {
  const routes: CapturedRoute[] = [];
  const sdk = { addTranslations: vi.fn(), addRoute: (route: CapturedRoute) => routes.push(route) };
  await subscriptionPlugin.install!(sdk as never);
  return Object.fromEntries(routes.map((route) => [route.name, route]));
}

describe('subscription plugin — public plan routes (S154 D10)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('mounts the public list and detail under the configured plans_slug', async () => {
    installFakeTransport(HTTP_OK, {
      dashboard_plans_widget_slug: '',
      plans_slug: 'pricing',
      seo_index_tarif_plans: true,
    });

    const byName = await install();

    expect(byName['public-plans'].path).toBe('/pricing');
    expect(byName['public-plan-detail'].path).toBe('/pricing/:planSlug');
    expect(publicPlansBase()).toBe('/pricing');
  });

  it('marks both routes public (no auth, no dashboard layout)', async () => {
    installFakeTransport(HTTP_OK, { plans_slug: 'plans', seo_index_tarif_plans: true });

    const byName = await install();

    for (const name of ['public-plans', 'public-plan-detail']) {
      expect(byName[name].meta).toMatchObject({ requiresAuth: false, noLayout: true });
      expect(byName[name].meta?.requiredUserPermission).toBeUndefined();
    }
  });

  it('keeps the indexable switch for the pages robots', async () => {
    installFakeTransport(HTTP_OK, { plans_slug: 'plans', seo_index_tarif_plans: false });

    await install();

    expect(publicPlansRobots()).toBe('noindex,follow');
  });

  it('falls back to /plans when the config fetch fails', async () => {
    installFakeTransport(HTTP_SERVER_ERROR, { error: 'down' });

    const byName = await install();

    expect(byName['public-plans'].path).toBe('/plans');
    expect(byName['public-plan-detail'].path).toBe('/plans/:planSlug');
    expect(publicPlansRobots()).toBe('index,follow');
  });

  it('keeps the private dashboard plan routes', async () => {
    installFakeTransport(HTTP_OK, { plans_slug: 'plans', seo_index_tarif_plans: true });

    const byName = await install();

    expect(byName.plans.path).toBe('/dashboard/plans');
    expect(byName.checkout.path).toBe('/dashboard/checkout/:planSlug');
  });
});
