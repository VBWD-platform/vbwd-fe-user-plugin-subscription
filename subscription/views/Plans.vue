<template>
  <div class="plans">
    <div class="plans-header">
      <h1>{{ $t('plans.title') }}</h1>
      <div class="view-toggle">
        <button
          :class="['view-toggle-btn', { active: viewMode === 'cards' }]"
          data-testid="view-cards"
          @click="viewMode = 'cards'"
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 16 16"
            fill="currentColor"
          ><rect
            x="0"
            y="0"
            width="7"
            height="7"
          /><rect
            x="9"
            y="0"
            width="7"
            height="7"
          /><rect
            x="0"
            y="9"
            width="7"
            height="7"
          /><rect
            x="9"
            y="9"
            width="7"
            height="7"
          /></svg>
        </button>
        <button
          :class="['view-toggle-btn', { active: viewMode === 'table' }]"
          data-testid="view-table"
          @click="viewMode = 'table'"
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 16 16"
            fill="currentColor"
          ><rect
            x="0"
            y="1"
            width="16"
            height="2"
          /><rect
            x="0"
            y="6"
            width="16"
            height="2"
          /><rect
            x="0"
            y="11"
            width="16"
            height="2"
          /></svg>
        </button>
      </div>
    </div>

    <!-- Loading State -->
    <div
      v-if="loading"
      class="loading-state"
      data-testid="plans-loading"
    >
      <div class="spinner" />
      <p>{{ $t('plans.loading') }}</p>
    </div>

    <!-- Error State -->
    <div
      v-else-if="error"
      class="error-state"
      data-testid="plans-error"
    >
      <p>{{ error }}</p>
      <button
        class="retry-btn"
        @click="loadPlans"
      >
        {{ $t('common.retry') }}
      </button>
    </div>

    <!-- No Plans -->
    <div
      v-else-if="plans.length === 0"
      class="no-plans"
      data-testid="no-plans"
    >
      <p>{{ $t('plans.noPlans') }}</p>
    </div>

    <template v-else>
      <!-- Cards View -->
      <div
        v-if="viewMode === 'cards'"
        class="plans-grid"
        data-testid="plans-grid"
      >
        <div
          v-for="plan in plans"
          :key="plan.id"
          :class="['plan-card', { popular: plan.popular, current: isCurrentPlan(plan.id) }]"
          :data-testid="`plan-${plan.slug}`"
          @click="viewPlan(plan)"
        >
          <div
            v-if="plan.popular"
            class="popular-badge"
          >
            {{ $t('plans.mostPopular') }}
          </div>
          <div
            v-if="isCurrentPlan(plan.id)"
            class="current-badge"
          >
            {{ $t('plans.currentPlan') }}
          </div>
          <h2>{{ plan.name }}</h2>
          <div class="price">
            <span class="amount">{{ formatPrice(plan.display_price) }}</span>
            <span class="period">/{{ formatBillingPeriod(plan.billing_period) }}</span>
          </div>
          <p
            v-if="plan.description"
            class="description"
          >
            {{ plan.description }}
          </p>
          <ul
            v-if="plan.features && plan.features.length > 0"
            class="features"
          >
            <li
              v-for="feature in plan.features"
              :key="feature"
            >
              {{ feature }}
            </li>
          </ul>
          <div
            v-if="plan.tax_rate !== undefined"
            class="tax-info"
          >
            <span class="tax-rate">{{ $t('plans.taxIncluded', { rate: plan.tax_rate }) }}</span>
          </div>
          <button
            :class="['select-btn', { disabled: isCurrentPlan(plan.id) }]"
            :disabled="isCurrentPlan(plan.id) || subscribing"
            :data-testid="`select-plan-${plan.slug}`"
            @click.stop="selectPlan(plan)"
          >
            <span v-if="subscribing && selectedPlanId === plan.id">{{ $t('plans.processing') }}</span>
            <span v-else-if="isCurrentPlan(plan.id)">{{ $t('plans.currentPlan') }}</span>
            <span v-else>{{ $t('plans.selectPlan') }}</span>
          </button>
        </div>
      </div>

      <!-- Table View -->
      <div
        v-else
        class="plans-table-wrapper"
      >
        <table
          class="plans-table"
          data-testid="plans-table"
        >
          <thead>
            <tr>
              <th>{{ $t('plans.tableHeaders.name') || 'Name' }}</th>
              <th>{{ $t('plans.tableHeaders.price') || 'Price' }}</th>
              <th>{{ $t('plans.tableHeaders.billingPeriod') || 'Billing' }}</th>
              <th>{{ $t('plans.tableHeaders.status') || 'Status' }}</th>
              <th>{{ $t('plans.tableHeaders.actions') || 'Actions' }}</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="plan in plans"
              :key="plan.id"
              class="plan-row"
              :data-testid="`plan-row-${plan.slug}`"
              @click="viewPlan(plan)"
            >
              <td class="plan-name-cell">
                <span class="plan-name">{{ plan.name }}</span>
                <span
                  v-if="plan.popular"
                  class="badge popular-tag"
                >{{ $t('plans.mostPopular') }}</span>
                <span
                  v-if="isCurrentPlan(plan.id)"
                  class="badge current-tag"
                >{{ $t('plans.currentPlan') }}</span>
              </td>
              <td class="plan-price-cell">
                {{ formatPrice(plan.display_price) }}/{{ formatBillingPeriod(plan.billing_period) }}
              </td>
              <td>{{ plan.billing_period || '—' }}</td>
              <td>
                <span :class="['status-dot', isCurrentPlan(plan.id) ? 'status-dot--active' : 'status-dot--inactive']" />
                {{ isCurrentPlan(plan.id) ? $t('plans.currentPlan') : '—' }}
              </td>
              <td
                class="actions-cell"
                @click.stop
              >
                <button
                  class="view-btn"
                  :data-testid="`view-plan-${plan.slug}`"
                  @click="viewPlan(plan)"
                >
                  {{ $t('common.view') || 'View' }}
                </button>
                <button
                  :class="['select-btn-sm', { disabled: isCurrentPlan(plan.id) }]"
                  :disabled="isCurrentPlan(plan.id) || subscribing"
                  :data-testid="`select-plan-${plan.slug}`"
                  @click="selectPlan(plan)"
                >
                  <span v-if="isCurrentPlan(plan.id)">{{ $t('plans.currentPlan') }}</span>
                  <span v-else>{{ $t('plans.selectPlan') }}</span>
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Currency Selector -->
      <div class="currency-selector">
        <label for="currency">{{ $t('plans.currencyLabel') }}</label>
        <select
          id="currency"
          v-model="selectedCurrency"
          data-testid="currency-select"
          @change="loadPlans"
        >
          <option value="EUR">
            EUR
          </option>
          <option value="USD">
            USD
          </option>
          <option value="GBP">
            GBP
          </option>
        </select>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { usePlansStore, type Plan } from '../stores/plans';
import { useSubscriptionStore } from '../stores/subscription';

const router = useRouter();
const { t } = useI18n();
const plansStore = usePlansStore();
const subscriptionStore = useSubscriptionStore();

const selectedCurrency = ref('EUR');
const subscribing = ref(false);
const selectedPlanId = ref<string | null>(null);
const viewMode = ref<'cards' | 'table'>('cards');

const loading = computed(() => plansStore.loading);
const error = computed(() => plansStore.error);
const plans = computed(() => plansStore.plans);

const currentSubscription = computed(() => subscriptionStore.subscription);

function isCurrentPlan(planId: string): boolean {
  return currentSubscription.value?.plan?.id === planId;
}

async function loadPlans(): Promise<void> {
  try {
    await plansStore.fetchPlans(selectedCurrency.value);
  } catch {
    // Error is handled in store
  }
}

function viewPlan(plan: Plan): void {
  router.push({ name: 'tarif-plan-detail', params: { planSlug: plan.slug } });
}

async function selectPlan(plan: Plan): Promise<void> {
  if (isCurrentPlan(plan.id)) return;
  router.push({ name: 'checkout', params: { planSlug: plan.slug } });
}

function formatPrice(price: number): string {
  const currencySymbols: Record<string, string> = {
    EUR: '\u20AC',
    USD: '$',
    GBP: '\u00A3',
  };
  const symbol = currencySymbols[selectedCurrency.value] || selectedCurrency.value;
  return `${symbol}${price.toFixed(2)}`;
}

function formatBillingPeriod(period?: string): string {
  if (!period) return 'month';
  const periodMap: Record<string, string> = {
    monthly: t('common.billingPeriods.month'),
    yearly: t('common.billingPeriods.year'),
    annual: t('common.billingPeriods.year'),
    weekly: t('common.billingPeriods.week'),
  };
  return periodMap[period.toLowerCase()] || period;
}

onMounted(async () => {
  try {
    await subscriptionStore.fetchSubscription();
  } catch {
    // No active subscription
  }
  await loadPlans();
});
</script>

<style scoped>
.plans {
  max-width: 1200px;
}

.plans-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 30px;
  flex-wrap: wrap;
  gap: 12px;
}

h1 {
  color: var(--vbwd-text-heading, #2c3e50);
  margin: 0;
}

.view-toggle {
  display: flex;
  gap: 4px;
  background: var(--vbwd-page-bg, #f8f9fa);
  border: 1px solid var(--vbwd-border-color, #ddd);
  border-radius: 6px;
  padding: 3px;
}

.view-toggle-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  background: none;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  color: var(--vbwd-text-muted, #6b7280);
}

.view-toggle-btn.active {
  background: var(--vbwd-card-bg, #fff);
  color: var(--vbwd-text-heading, #2c3e50);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.loading-state,
.error-state,
.no-plans {
  text-align: center;
  padding: 60px 20px;
  color: var(--vbwd-text-muted, #666);
}

.spinner {
  width: 40px;
  height: 40px;
  border: 3px solid var(--vbwd-border-light, #f3f3f3);
  border-top: 3px solid var(--vbwd-color-primary, #3498db);
  border-radius: 50%;
  animation: plans-spin 1s linear infinite;
  margin: 0 auto 15px;
}

@keyframes plans-spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

.retry-btn {
  margin-top: 15px;
  padding: 10px 20px;
  background: var(--vbwd-color-primary, #3498db);
  color: #fff;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

/* Cards */
.plans-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 30px;
  margin-bottom: 30px;
}

.plan-card {
  background: var(--vbwd-card-bg, #fff);
  padding: 30px;
  border-radius: 8px;
  box-shadow: var(--vbwd-card-shadow, 0 2px 5px rgba(0, 0, 0, 0.05));
  position: relative;
  border: 2px solid transparent;
  transition: all 0.2s;
  cursor: pointer;
}

.plan-card:hover {
  transform: translateY(-5px);
  box-shadow: 0 5px 20px rgba(0, 0, 0, 0.1);
  border-color: var(--vbwd-color-primary, #3498db);
}

.plan-card.popular {
  border-color: var(--vbwd-color-primary, #3498db);
}

.plan-card.current {
  border-color: var(--vbwd-color-success, #27ae60);
}

.popular-badge {
  position: absolute;
  top: -12px;
  left: 50%;
  transform: translateX(-50%);
  background-color: var(--vbwd-color-primary, #3498db);
  color: #fff;
  padding: 4px 15px;
  border-radius: 20px;
  font-size: 0.8rem;
}

.current-badge {
  position: absolute;
  top: -12px;
  right: 15px;
  background-color: var(--vbwd-color-success, #27ae60);
  color: #fff;
  padding: 4px 15px;
  border-radius: 20px;
  font-size: 0.8rem;
}

.plan-card h2 {
  margin-bottom: 15px;
  color: var(--vbwd-text-heading, #2c3e50);
  text-align: center;
}

.price {
  text-align: center;
  margin-bottom: 20px;
}

.amount {
  font-size: 2.5rem;
  font-weight: 700;
  color: var(--vbwd-text-heading, #2c3e50);
}

.period {
  color: var(--vbwd-text-muted, #666);
}

.description {
  text-align: center;
  color: var(--vbwd-text-muted, #666);
  font-size: 0.9rem;
  margin-bottom: 20px;
}

.features {
  list-style: none;
  margin-bottom: 20px;
}

.features li {
  padding: 8px 0;
  color: var(--vbwd-text-muted, #666);
  border-bottom: 1px solid var(--vbwd-border-light, #eee);
}

.features li:last-child {
  border-bottom: none;
}

.features li::before {
  content: "\2713";
  color: var(--vbwd-color-success, #27ae60);
  margin-right: 8px;
}

.tax-info {
  text-align: center;
  margin-bottom: 15px;
}

.tax-rate {
  font-size: 0.8rem;
  color: var(--vbwd-text-muted, #999);
}

.select-btn {
  width: 100%;
  padding: 12px;
  background-color: var(--vbwd-color-primary, #3498db);
  color: #fff;
  border: none;
  border-radius: 4px;
  font-size: 1rem;
  cursor: pointer;
  transition: background-color 0.2s;
}

.select-btn:hover:not(:disabled) {
  background-color: var(--vbwd-color-primary-hover, #2980b9);
}

.select-btn.disabled,
.select-btn:disabled {
  background-color: var(--vbwd-text-muted, #95a5a6);
  cursor: default;
  opacity: 0.6;
}

/* Table */
.plans-table-wrapper {
  margin-bottom: 30px;
  overflow-x: auto;
}

.plans-table {
  width: 100%;
  border-collapse: collapse;
  background: var(--vbwd-card-bg, #fff);
  border-radius: 8px;
  overflow: hidden;
  box-shadow: var(--vbwd-card-shadow, 0 2px 5px rgba(0, 0, 0, 0.05));
}

.plans-table th {
  background: var(--vbwd-page-bg, #f8f9fa);
  padding: 12px 16px;
  text-align: left;
  font-size: 0.85rem;
  color: var(--vbwd-text-muted, #666);
  font-weight: 600;
  border-bottom: 1px solid var(--vbwd-border-light, #eee);
}

.plans-table td {
  padding: 14px 16px;
  border-bottom: 1px solid var(--vbwd-border-light, #f0f0f0);
  color: var(--vbwd-text-body, #2c3e50);
}

.plan-row {
  cursor: pointer;
  transition: background-color 0.15s;
}

.plan-row:hover {
  background: var(--vbwd-page-bg, #f8f9fa);
}

.plan-name-cell {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.plan-name {
  font-weight: 600;
}

.badge {
  padding: 2px 8px;
  border-radius: 10px;
  font-size: 0.75rem;
  font-weight: 500;
}

.popular-tag {
  background: var(--vbwd-page-bg, #e3f2fd);
  color: var(--vbwd-color-primary, #1976d2);
  border: 1px solid var(--vbwd-color-primary, #1976d2);
}

.current-tag {
  background: var(--vbwd-page-bg, #e8f5e9);
  color: var(--vbwd-color-success, #2e7d32);
  border: 1px solid var(--vbwd-color-success, #2e7d32);
}

.plan-price-cell {
  font-weight: 500;
  white-space: nowrap;
}

.status-dot {
  display: inline-block;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  margin-right: 6px;
}

.status-dot--active {
  background: var(--vbwd-color-success, #27ae60);
}

.status-dot--inactive {
  background: var(--vbwd-border-color, #bdc3c7);
}

.actions-cell {
  display: flex;
  gap: 8px;
}

.view-btn {
  padding: 6px 12px;
  background: var(--vbwd-page-bg, #e3f2fd);
  color: var(--vbwd-color-primary, #1976d2);
  border: 1px solid var(--vbwd-color-primary, #1976d2);
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.85rem;
  transition: opacity 0.2s;
}

.view-btn:hover {
  opacity: 0.8;
}

.select-btn-sm {
  padding: 6px 12px;
  background: var(--vbwd-color-primary, #3498db);
  color: #fff;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.85rem;
  transition: opacity 0.2s;
}

.select-btn-sm:hover:not(:disabled) {
  opacity: 0.85;
}

.select-btn-sm.disabled,
.select-btn-sm:disabled {
  background: var(--vbwd-text-muted, #95a5a6);
  cursor: default;
  opacity: 0.6;
}

/* Responsive */
@media (max-width: 768px) {
  .plans { max-width: 100%; }
  .plans-header { flex-direction: column; align-items: flex-start; }
  .plans-table-wrapper { overflow-x: auto; -webkit-overflow-scrolling: touch; }
  .plans-table { min-width: 520px; }
  .plans-table th, .plans-table td { padding: 10px; font-size: 0.85rem; }
  .actions-cell { flex-direction: column; gap: 4px; }
  .plans-grid { grid-template-columns: 1fr; }
  .currency-selector { flex-wrap: wrap; padding: 12px; }
}

.currency-selector {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  padding: 20px;
  background: var(--vbwd-page-bg, #f8f9fa);
  border-radius: 8px;
}

.currency-selector label {
  color: var(--vbwd-text-muted, #666);
}

.currency-selector select {
  padding: 8px 12px;
  border: 1px solid var(--vbwd-border-color, #ddd);
  background: var(--vbwd-card-bg, #fff);
  color: var(--vbwd-text-body, #333);
  border-radius: 4px;
  font-size: 1rem;
  cursor: pointer;
}
</style>
