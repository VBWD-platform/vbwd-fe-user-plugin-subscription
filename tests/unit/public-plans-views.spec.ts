/**
 * S154 D10 — the public plan pages in vue mode (PublicPlans.vue, PublicPlanDetail.vue).
 *
 * - The list reads `GET /api/v1/tarif-plans` (active plans only, backend rule) and
 *   links every plan's detail page with a real anchor (crawlable, D5).
 * - The detail reads `GET /api/v1/tarif-plans/<slug>`: name, price, description,
 *   features, and the CTA into the existing private checkout
 *   (`/dashboard/checkout/<slug>`). An inactive or unknown plan is "not found".
 * - Each page sets its own SEO head through the cms `injectSeoMeta` seam: title
 *   "<subject> — <site>", description, self canonical, robots from the
 *   `seo_index_tarif_plans` switch, og:title / og:description.
 *
 * The fake sits at the transport (axios adapter on the host api singleton) and
 * answers the literal backend JSON (envelopes included).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount, flushPromises, RouterLinkStub } from '@vue/test-utils';
import { createI18n } from 'vue-i18n';
import { createPinia, setActivePinia } from 'pinia';
import { AxiosError, type AxiosInstance, type InternalAxiosRequestConfig } from 'axios';
import { api } from '@/api';
import en from '../../locales/en.json';
import { setPublicPlansConfig } from '../../subscription/publicPlans';

const { routeParams, injectSeoMeta } = vi.hoisted(() => ({
  routeParams: { planSlug: 'pro' } as Record<string, string>,
  injectSeoMeta: vi.fn(),
}));

vi.mock('vue-router', async () => {
  const actual = await vi.importActual<Record<string, unknown>>('vue-router');
  return { ...actual, useRoute: () => ({ params: routeParams }) };
});
vi.mock('../../../cms/src/composables/useSeoHandoff', () => ({ injectSeoMeta }));
vi.mock('vbwd-view-component', async () => {
  const actual = await vi.importActual<Record<string, unknown>>('vbwd-view-component');
  return { ...actual, useAuthStore: () => ({ user: null }) };
});

import PublicPlans from '../../subscription/views/PublicPlans.vue';
import PublicPlanDetail from '../../subscription/views/PublicPlanDetail.vue';

const PRODUCTION_BASE_URL = '/api/v1';
const HTTP_OK = 200;
const HTTP_NOT_FOUND = 404;

// GET /api/v1/tarif-plans (get_plan_with_pricing per plan, in the envelope).
const LIST_BODY = {
  plans: [
    {
      id: '1',
      name: 'Pro',
      slug: 'pro',
      display_currency: 'EUR',
      display_price: 29.0,
      prices_display_mode: 'brutto',
      effective_display_mode: 'brutto',
    },
  ],
  currency: 'EUR',
  country: null,
};

// GET /api/v1/tarif-plans/pro (TarifPlan.to_dict() merged with the pricing).
const DETAIL_BODY = {
  id: '1',
  name: 'Pro',
  slug: 'pro',
  description: '<p>For teams &amp; agencies</p>',
  price: 29.0,
  billing_period: 'MONTHLY',
  features: { users: 10 },
  trial_days: 0,
  is_active: true,
  is_recurring: true,
  categories: [],
  taxes: [],
  tax_ids: [],
  price_display_mode: null,
  vendor_id: null,
  display_currency: 'EUR',
  display_price: 29.0,
  prices_display_mode: 'brutto',
  effective_display_mode: 'brutto',
  tags: [],
  custom_fields: {},
  custom_field_defs: [],
};

type Respond = (path: string) => { status: number; data: unknown };

function installFakeTransport(respond: Respond): void {
  const transport = (api as unknown as { axiosInstance: AxiosInstance }).axiosInstance;
  transport.defaults.baseURL = PRODUCTION_BASE_URL;
  transport.defaults.adapter = async (config: InternalAxiosRequestConfig) => {
    const path = `${config.baseURL ?? ''}${config.url ?? ''}`;
    const { status, data } = respond(path);
    const response = { data, status, statusText: String(status), headers: {}, config };
    if (status >= 400) {
      throw new AxiosError(`Request failed with status code ${status}`, 'ERR_BAD_RESPONSE', config, {}, response);
    }
    return response;
  };
}

function backend(detail: { status: number; data: unknown } = { status: HTTP_OK, data: DETAIL_BODY }): Respond {
  return (path) => {
    if (path === '/api/v1/config') return { status: HTTP_OK, data: { site_name: 'Acme', default_currency: 'EUR' } };
    if (path === '/api/v1/tarif-plans') return { status: HTTP_OK, data: LIST_BODY };
    if (path.startsWith('/api/v1/tarif-plans/')) return detail;
    return { status: HTTP_NOT_FOUND, data: { error: 'Not found' } };
  };
}

const i18n = createI18n({ legacy: false, locale: 'en', missing: (_locale, key) => key, messages: { en } });

async function mountView(view: unknown) {
  const wrapper = mount(view as never, { global: { plugins: [i18n], stubs: { RouterLink: RouterLinkStub } } });
  await flushPromises();
  return wrapper;
}

function lastHead() {
  return injectSeoMeta.mock.calls[injectSeoMeta.mock.calls.length - 1][0];
}

describe('PublicPlans.vue / PublicPlanDetail.vue (S154 D10)', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    injectSeoMeta.mockClear();
    routeParams.planSlug = 'pro';
    setPublicPlansConfig({ plans_slug: 'plans', seo_index_tarif_plans: true });
    installFakeTransport(backend());
  });

  it('lists each plan with a link to its public detail and the checkout CTA', async () => {
    const wrapper = await mountView(PublicPlans);

    const links = wrapper.findAllComponents(RouterLinkStub);
    const targets = links.map((link) => link.props('to'));
    expect(targets).toContain('/plans/pro');
    expect(targets).toContain('/dashboard/checkout/pro');
    expect(wrapper.find('[data-testid="public-plan-card-pro"]').text()).toContain('Pro');
  });

  it('gives the list its own SEO head', async () => {
    await mountView(PublicPlans);

    expect(lastHead()).toEqual({
      meta_title: 'Plans — Acme',
      meta_description: 'Choose the plan that fits you best',
      robots: 'index,follow',
      canonical_url: `${window.location.origin}/plans`,
      og_title: 'Plans — Acme',
      og_description: 'Choose the plan that fits you best',
    });
  });

  it('shows the plan with price, features and the dashboard checkout CTA', async () => {
    const wrapper = await mountView(PublicPlanDetail);

    expect(wrapper.find('[data-testid="plan-name"]').text()).toBe('Pro');
    expect(wrapper.find('[data-testid="plan-price"]').text()).toContain('29');
    expect(wrapper.find('[data-testid="plan-features"]').text()).toContain('users: 10');
    const cta = wrapper
      .findAllComponents(RouterLinkStub)
      .find((link) => link.attributes('data-testid') === 'select-plan-btn');
    expect(cta?.props('to')).toBe('/dashboard/checkout/pro');
  });

  it('gives the detail its own SEO head', async () => {
    setPublicPlansConfig({ plans_slug: 'pricing', seo_index_tarif_plans: false });

    await mountView(PublicPlanDetail);

    expect(lastHead()).toEqual({
      meta_title: 'Pro — Acme',
      meta_description: 'For teams & agencies',
      robots: 'noindex,follow',
      canonical_url: `${window.location.origin}/pricing/pro`,
      og_title: 'Pro — Acme',
      og_description: 'For teams & agencies',
    });
  });

  it.each([
    ['an inactive plan', { status: HTTP_OK, data: { ...DETAIL_BODY, is_active: false } }],
    ['an unknown plan', { status: HTTP_NOT_FOUND, data: { error: 'Plan not found' } }],
  ])('treats %s as not found (noindex)', async (_label, detail) => {
    installFakeTransport(backend(detail));

    const wrapper = await mountView(PublicPlanDetail);

    expect(wrapper.find('[data-testid="public-plan-not-found"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="select-plan-btn"]').exists()).toBe(false);
    expect(lastHead()).toEqual({ robots: 'noindex,follow' });
  });
});
