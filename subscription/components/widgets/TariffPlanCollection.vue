<template>
  <div
    class="tariff-plan-collection"
    :class="themeClass"
  >
    <div class="tariff-plan-collection__header">
      <h2
        class="tariff-plan-collection__heading"
        data-testid="tariff-plan-collection-heading"
      >
        {{ headingText }}
      </h2>
      <p
        class="tariff-plan-collection__subtitle"
        data-testid="tariff-plan-collection-subtitle"
      >
        {{ subtitleText }}
      </p>
    </div>

    <div
      v-if="loading"
      class="tariff-plan-collection__state"
      data-testid="tariff-plan-loading"
    >
      <div class="tariff-plan-collection__spinner" />
    </div>

    <div
      v-else-if="error"
      class="tariff-plan-collection__state"
      data-testid="tariff-plan-error"
    >
      <p>{{ error }}</p>
    </div>

    <div
      v-else-if="plans.length === 0"
      class="tariff-plan-collection__state"
      data-testid="tariff-plan-empty"
    >
      <p>{{ $t('plans.noPlans') }}</p>
    </div>

    <template v-else>
      <CollectionToolbar
        v-model:search-query="collection.searchQuery.value"
        :view-mode="collection.viewMode.value"
        :sort-direction="collection.sortDirection.value"
        :search-placeholder="$t('common.search')"
        :sort-label="$t('plans.sortByPrice')"
        :cards-label="$t('common.view')"
        :table-label="$t('common.view')"
        @toggle-sort="collection.toggleSort"
        @set-view="collection.setView"
      />

      <!-- Cards View -->
      <div
        v-if="collection.viewMode.value === 'cards'"
        class="tariff-plan-collection__grid"
        data-testid="tariff-plan-grid"
      >
        <div
          v-for="plan in collection.visibleItems.value"
          :key="plan.id"
          class="tariff-plan-card"
          :class="{ 'tariff-plan-card--featured': isFeatured(plan) }"
          :data-testid="`tariff-plan-card-${plan.slug}`"
        >
          <div
            v-if="isFeatured(plan)"
            class="tariff-plan-card__badge"
            data-testid="tariff-plan-badge"
          >
            {{ badgeText }}
          </div>

          <img
            v-if="imageUrl"
            class="tariff-plan-card__image"
            data-testid="tariff-plan-image"
            :src="imageUrl"
            :alt="plan.name"
          >

          <h3>{{ plan.name }}</h3>
          <div class="tariff-plan-card__price">
            <PriceDisplay
              convert-to-display
              :effective-display-mode="plan.effective_display_mode"
              :global-mode="plan.prices_display_mode"
              :net-amount="plan.net_price ?? plan.display_price"
              :gross-amount="plan.gross_price ?? plan.display_price"
              :currency="plan.display_currency"
              :account-type="accountType"
            />
            <span class="tariff-plan-card__period">/{{ formatBillingPeriod(plan.billing_period) }}</span>
          </div>
          <p
            v-if="plan.description"
            class="tariff-plan-card__description"
          >
            {{ plan.description }}
          </p>

          <ul
            v-if="features.length"
            class="tariff-plan-card__features"
            data-testid="tariff-plan-features"
          >
            <li
              v-for="(feature, index) in features"
              :key="index"
              class="tariff-plan-card__feature"
            >
              <svg
                class="tariff-plan-card__check"
                viewBox="0 0 20 20"
                aria-hidden="true"
              >
                <path
                  d="M7.5 13.5 4 10l-1.2 1.2L7.5 16 17 6.5 15.8 5.3z"
                  fill="currentColor"
                />
              </svg>
              <span>{{ feature }}</span>
            </li>
          </ul>

          <button
            type="button"
            class="tariff-plan-card__select"
            :data-testid="`select-plan-${plan.slug}`"
            @click="selectPlan(plan)"
          >
            {{ ctaText }}
          </button>
        </div>
      </div>

      <!-- Table View -->
      <div
        v-else
        class="tariff-plan-collection__table-wrapper"
      >
        <table
          class="tariff-plan-collection__table"
          data-testid="tariff-plan-table"
        >
          <thead>
            <tr>
              <th>{{ $t('plans.tableHeaders.name') }}</th>
              <th>{{ $t('plans.tableHeaders.price') }}</th>
              <th>{{ $t('plans.tableHeaders.billingPeriod') }}</th>
              <th>{{ $t('plans.tableHeaders.actions') }}</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="plan in collection.visibleItems.value"
              :key="plan.id"
              :data-testid="`tariff-plan-row-${plan.slug}`"
            >
              <td>{{ plan.name }}</td>
              <td>
                <PriceDisplay
                  convert-to-display
                  :effective-display-mode="plan.effective_display_mode"
                  :global-mode="plan.prices_display_mode"
                  :net-amount="plan.net_price ?? plan.display_price"
                  :gross-amount="plan.gross_price ?? plan.display_price"
                  :currency="plan.display_currency"
                  :account-type="accountType"
                />
              </td>
              <td>{{ formatBillingPeriod(plan.billing_period) }}</td>
              <td>
                <button
                  type="button"
                  class="tariff-plan-collection__select-sm"
                  :data-testid="`select-plan-${plan.slug}`"
                  @click="selectPlan(plan)"
                >
                  {{ ctaText }}
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
/**
 * TariffPlanCollection — a CMS ``vue-component`` widget rendering a searchable /
 * sortable card-or-table collection of tariff plans, with a user-facing view
 * toggle. Receives the single ``config`` prop the CmsWidgetRenderer passes
 * (``{ ...widget.config, widget_slug }``).
 *
 * Reuses the subscription plans store for data and the shared
 * ``useCollectionView`` + ``CollectionToolbar`` for the search/sort/view logic
 * (DRY). Selecting a plan routes to checkout, mirroring Plans.vue.
 */
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { useAuthStore } from 'vbwd-view-component';
import { usePlansStore, type Plan } from '../../stores/plans';
import { useCollectionView } from '@/composables/useCollectionView';
import CollectionToolbar from '@/components/CollectionToolbar.vue';
import PriceDisplay from '@/components/PriceDisplay.vue';

interface TariffPlanCollectionConfig {
  component_name?: string;
  widget_slug?: string;
  source_mode?: 'category' | 'slugs';
  category?: string;
  plan_slugs?: string[];
  default_view?: 'cards' | 'table';
  heading?: string;
  css?: string;
  // Presentation controls — mirror NativePricingPlans/Landing1View so an
  // operator's config is portable between the two widgets. All optional and
  // backward-compatible: a config with only heading/default_view renders as
  // before (image/features/badge/highlight are cards-only and stay absent).
  subtitle?: string;
  theme?: string;
  image_url?: string;
  features?: string[];
  highlight_slug?: string;
  highlight_badge?: string;
  cta_label?: string;
}

// Six shared theme names (Landing1View parity); an unknown value → 'default'.
const ALLOWED_THEMES = ['default', 'light', 'dark', 'teal', 'indigo', 'emerald'];

const props = defineProps<{ config: TariffPlanCollectionConfig }>();

const router = useRouter();
const { t } = useI18n();
const authStore = useAuthStore();
const plansStore = usePlansStore();

const accountType = computed(() => authStore.user?.account_type);
const loading = computed(() => plansStore.loading);
const error = computed(() => plansStore.error);

const sourceMode = computed(() => props.config.source_mode ?? 'category');
const selectedCurrency = ref('EUR');

// Presentation config — blank/absent text falls back to the subscription i18n
// keys; an unknown theme falls back to 'default'.
const themeClass = computed(() => {
  const theme = props.config.theme && ALLOWED_THEMES.includes(props.config.theme)
    ? props.config.theme
    : 'default';
  return `tariff-plan-collection--${theme}`;
});
const headingText = computed(() => props.config.heading?.trim() || t('plans.title'));
const subtitleText = computed(() => props.config.subtitle?.trim() || t('plans.subtitle'));
const ctaText = computed(() => props.config.cta_label?.trim() || t('plans.selectPlan'));
const badgeText = computed(() => props.config.highlight_badge?.trim() || t('plans.mostPopular'));
const imageUrl = computed(() => props.config.image_url?.trim() || '');
const features = computed<string[]>(() =>
  (props.config.features ?? []).map((feature) => String(feature).trim()).filter(Boolean),
);

function isFeatured(plan: Plan): boolean {
  return !!props.config.highlight_slug && plan.slug === props.config.highlight_slug;
}

const plans = computed<Plan[]>(() => {
  const all = plansStore.plans;
  if (sourceMode.value === 'slugs') {
    const wanted = props.config.plan_slugs ?? [];
    return all.filter((plan) => wanted.includes(plan.slug));
  }
  return all;
});

const collection = useCollectionView<Plan>({
  items: plans,
  searchableText: (plan) => `${plan.name} ${plan.description ?? ''}`,
  sortKey: (plan) => Number(plan.net_price ?? plan.display_price ?? 0),
  initialView: props.config.default_view ?? 'cards',
});

function selectPlan(plan: Plan): void {
  // Public widget: route to the PUBLIC checkout (?tarif_plan_id=…), never the
  // dashboard checkout (/dashboard/checkout/:planSlug), which is reserved for
  // logged-in in-dashboard purchases.
  router.push({ name: 'checkout-public', query: { tarif_plan_id: plan.slug } });
}

function formatBillingPeriod(period?: string): string {
  if (!period) return t('common.billingPeriods.month');
  const periodMap: Record<string, string> = {
    monthly: t('common.billingPeriods.month'),
    yearly: t('common.billingPeriods.year'),
    annual: t('common.billingPeriods.year'),
    weekly: t('common.billingPeriods.week'),
  };
  return periodMap[period.toLowerCase()] || period;
}

onMounted(async () => {
  // Category mode narrows server-side; slugs mode fetches all then filters.
  const category = sourceMode.value === 'category' ? props.config.category : undefined;
  try {
    await plansStore.fetchPlans(selectedCurrency.value, undefined, category);
  } catch {
    // Error surfaced through the store.
  }
});

// Admin "CSS" tab override (config.css) — injected into <head> so it can target
// the widget's classes, mirroring NativePricingPlans / ContactForm. Without this
// the CSS tab is inert (CSS saved but never applied).
let styleEl: HTMLStyleElement | null = null;
function applyCss(): void {
  if (styleEl) { styleEl.remove(); styleEl = null; }
  const css = props.config.css;
  if (!css) return;
  styleEl = document.createElement('style');
  styleEl.setAttribute('data-tariff-plan-collection-css', '');
  styleEl.textContent = css;
  document.head.appendChild(styleEl);
}
onMounted(applyCss);
watch(() => props.config.css, applyCss);
onUnmounted(() => { if (styleEl) { styleEl.remove(); styleEl = null; } });
</script>

<style scoped>
/* Theme tokens — overridden per .tariff-plan-collection--<theme> below. Fall
   back to the shared fe-user vbwd-* tokens so the widget still tracks the active
   CMS style. Colour comes ONLY from these variables (theme-token purity). */
.tariff-plan-collection {
  --tpc-primary: var(--vbwd-color-primary, #3498db);
  --tpc-primary-hover: var(--vbwd-color-primary-hover, #2980b9);
  --tpc-card-bg: var(--vbwd-card-bg, #fff);
  --tpc-text-heading: var(--vbwd-text-heading, #2c3e50);
  --tpc-text-muted: var(--vbwd-text-muted, #666);
  --tpc-border: var(--vbwd-border-light, #f0f0f0);
  --tpc-check: var(--tpc-primary);
  --tpc-card-shadow: var(--vbwd-card-shadow, 0 2px 5px rgba(0, 0, 0, 0.05));
  --tpc-page-bg: var(--vbwd-page-bg, #f8f9fa);
}

/* ── Themes ──────────────────────────────────────────────────────────────── */
.tariff-plan-collection--light {
  --tpc-card-bg: #ffffff;
  --tpc-text-heading: #1f2937;
  --tpc-text-muted: #6b7280;
  --tpc-border: #e5e7eb;
}

.tariff-plan-collection--dark {
  --tpc-primary: #3b82f6;
  --tpc-primary-hover: #2563eb;
  --tpc-card-bg: #1f2937;
  --tpc-text-heading: #f9fafb;
  --tpc-text-muted: #9ca3af;
  --tpc-border: #374151;
  --tpc-page-bg: #111827;
  --tpc-card-shadow: 0 2px 14px rgba(0, 0, 0, 0.5);
}

.tariff-plan-collection--teal {
  --tpc-primary: #14b8a6;
  --tpc-primary-hover: #0d9488;
  --tpc-check: #14b8a6;
}

.tariff-plan-collection--indigo {
  --tpc-primary: #6366f1;
  --tpc-primary-hover: #4f46e5;
  --tpc-check: #6366f1;
}

.tariff-plan-collection--emerald {
  --tpc-primary: #10b981;
  --tpc-primary-hover: #059669;
  --tpc-check: #10b981;
}

.tariff-plan-collection__header {
  text-align: center;
  margin-bottom: 24px;
}

.tariff-plan-collection__heading {
  color: var(--tpc-text-heading);
  margin-bottom: 8px;
}

.tariff-plan-collection__subtitle {
  color: var(--tpc-text-muted);
  font-size: 1.05rem;
  margin: 0;
}

.tariff-plan-collection__state {
  text-align: center;
  padding: 40px 20px;
  color: var(--tpc-text-muted);
}

.tariff-plan-collection__spinner {
  width: 36px;
  height: 36px;
  border: 3px solid var(--tpc-border);
  border-top: 3px solid var(--tpc-primary);
  border-radius: 50%;
  animation: tariff-plan-spin 1s linear infinite;
  margin: 0 auto;
}

@keyframes tariff-plan-spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

.tariff-plan-collection__grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
  gap: 24px;
  align-items: stretch;
}

.tariff-plan-card {
  position: relative;
  display: flex;
  flex-direction: column;
  background: var(--tpc-card-bg);
  padding: 24px;
  border-radius: 8px;
  box-shadow: var(--tpc-card-shadow);
  border: 2px solid transparent;
  text-align: center;
  transition: all 0.2s;
}

.tariff-plan-card:hover {
  transform: translateY(-4px);
  border-color: var(--tpc-primary);
}

/* ── Emphasized / "popular" plan ─────────────────────────────────────────── */
.tariff-plan-card--featured {
  border-color: var(--tpc-primary);
  box-shadow: 0 16px 40px rgba(0, 0, 0, 0.16);
  z-index: 1;
}

@media (min-width: 900px) {
  .tariff-plan-card--featured {
    transform: scale(1.04);
  }
  .tariff-plan-card--featured:hover {
    transform: scale(1.04) translateY(-4px);
  }
}

.tariff-plan-card__badge {
  position: absolute;
  top: 0;
  left: 50%;
  transform: translate(-50%, -50%);
  background: var(--tpc-primary);
  color: #fff;
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  padding: 5px 14px;
  border-radius: 999px;
  box-shadow: 0 4px 10px rgba(0, 0, 0, 0.18);
  white-space: nowrap;
}

.tariff-plan-card__image {
  display: block;
  width: 72px;
  height: 72px;
  object-fit: contain;
  margin: 4px auto 16px;
}

.tariff-plan-card h3 {
  color: var(--tpc-text-heading);
  margin-bottom: 12px;
}

.tariff-plan-card__price {
  margin-bottom: 14px;
  font-size: 1.6rem;
  font-weight: 700;
  color: var(--tpc-text-heading);
}

.tariff-plan-card__period {
  font-size: 0.9rem;
  font-weight: 400;
  color: var(--tpc-text-muted);
}

.tariff-plan-card__description {
  color: var(--tpc-text-muted);
  font-size: 0.9rem;
  margin-bottom: 16px;
}

.tariff-plan-card__features {
  list-style: none;
  padding: 0;
  margin: 0 0 20px;
  text-align: left;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.tariff-plan-card__feature {
  display: flex;
  align-items: center;
  gap: 10px;
  color: var(--tpc-text-muted);
  font-size: 0.95rem;
}

.tariff-plan-card__check {
  flex-shrink: 0;
  width: 18px;
  height: 18px;
  color: var(--tpc-check);
}

.tariff-plan-card__select,
.tariff-plan-collection__select-sm {
  padding: 10px 16px;
  background-color: var(--tpc-primary);
  color: #fff;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.95rem;
  transition: background-color 0.2s;
}

.tariff-plan-card__select:hover,
.tariff-plan-collection__select-sm:hover {
  background-color: var(--tpc-primary-hover);
}

.tariff-plan-card__select {
  width: 100%;
  margin-top: auto;
}

.tariff-plan-card--featured .tariff-plan-card__select {
  background-image: linear-gradient(135deg, var(--tpc-primary), var(--tpc-primary-hover));
}

.tariff-plan-collection__table-wrapper {
  overflow-x: auto;
}

.tariff-plan-collection__table {
  width: 100%;
  border-collapse: collapse;
  background: var(--tpc-card-bg);
  border-radius: 8px;
  overflow: hidden;
  box-shadow: var(--tpc-card-shadow);
}

.tariff-plan-collection__table th {
  background: var(--tpc-page-bg);
  padding: 12px 16px;
  text-align: left;
  font-size: 0.85rem;
  color: var(--tpc-text-muted);
}

.tariff-plan-collection__table td {
  padding: 14px 16px;
  border-bottom: 1px solid var(--tpc-border);
  color: var(--tpc-text-heading);
}
</style>
