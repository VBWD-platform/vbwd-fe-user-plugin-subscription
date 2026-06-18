<template>
  <div class="tariff-plan-collection">
    <h2
      v-if="config.heading"
      class="tariff-plan-collection__heading"
    >
      {{ config.heading }}
    </h2>

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
          :data-testid="`tariff-plan-card-${plan.slug}`"
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
          <button
            type="button"
            class="tariff-plan-card__select"
            :data-testid="`select-plan-${plan.slug}`"
            @click="selectPlan(plan)"
          >
            {{ $t('plans.selectPlan') }}
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
                  {{ $t('plans.selectPlan') }}
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
import { computed, onMounted, ref } from 'vue';
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
}

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
</script>

<style scoped>
.tariff-plan-collection__heading {
  color: var(--vbwd-text-heading, #2c3e50);
  margin-bottom: 16px;
}

.tariff-plan-collection__state {
  text-align: center;
  padding: 40px 20px;
  color: var(--vbwd-text-muted, #666);
}

.tariff-plan-collection__spinner {
  width: 36px;
  height: 36px;
  border: 3px solid var(--vbwd-border-light, #f3f3f3);
  border-top: 3px solid var(--vbwd-color-primary, #3498db);
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
}

.tariff-plan-card {
  background: var(--vbwd-card-bg, #fff);
  padding: 24px;
  border-radius: 8px;
  box-shadow: var(--vbwd-card-shadow, 0 2px 5px rgba(0, 0, 0, 0.05));
  border: 2px solid transparent;
  text-align: center;
  transition: all 0.2s;
}

.tariff-plan-card:hover {
  transform: translateY(-4px);
  border-color: var(--vbwd-color-primary, #3498db);
}

.tariff-plan-card h3 {
  color: var(--vbwd-text-heading, #2c3e50);
  margin-bottom: 12px;
}

.tariff-plan-card__price {
  margin-bottom: 14px;
  font-size: 1.6rem;
  font-weight: 700;
  color: var(--vbwd-text-heading, #2c3e50);
}

.tariff-plan-card__period {
  font-size: 0.9rem;
  font-weight: 400;
  color: var(--vbwd-text-muted, #666);
}

.tariff-plan-card__description {
  color: var(--vbwd-text-muted, #666);
  font-size: 0.9rem;
  margin-bottom: 16px;
}

.tariff-plan-card__select,
.tariff-plan-collection__select-sm {
  padding: 10px 16px;
  background-color: var(--vbwd-color-primary, #3498db);
  color: #fff;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.95rem;
}

.tariff-plan-card__select {
  width: 100%;
}

.tariff-plan-collection__table-wrapper {
  overflow-x: auto;
}

.tariff-plan-collection__table {
  width: 100%;
  border-collapse: collapse;
  background: var(--vbwd-card-bg, #fff);
  border-radius: 8px;
  overflow: hidden;
  box-shadow: var(--vbwd-card-shadow, 0 2px 5px rgba(0, 0, 0, 0.05));
}

.tariff-plan-collection__table th {
  background: var(--vbwd-page-bg, #f8f9fa);
  padding: 12px 16px;
  text-align: left;
  font-size: 0.85rem;
  color: var(--vbwd-text-muted, #666);
}

.tariff-plan-collection__table td {
  padding: 14px 16px;
  border-bottom: 1px solid var(--vbwd-border-light, #f0f0f0);
  color: var(--vbwd-text-body, #2c3e50);
}
</style>
