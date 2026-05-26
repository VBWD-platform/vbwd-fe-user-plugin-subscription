<template>
  <div
    v-if="store.plan"
    class="plan-details"
  >
    <div class="plan-row">
      <span data-testid="plan-name">{{ store.plan.name }}</span>
      <span data-testid="plan-price">{{ formattedPlanPrice }}/{{ formatBillingPeriod(store.plan.billing_period) }}</span>
    </div>
    <p
      v-if="store.plan.description"
      class="plan-description"
    >
      {{ store.plan.description }}
    </p>
    <div class="total">
      <strong>{{ $t('checkout.success.totalLabel') }} {{ formattedTotal }}</strong>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * Order summary for a subscription-plan checkout, contributed by the
 * subscription plugin's CheckoutSource and rendered by the generic public
 * checkout page. Keeps plan-specific display out of the core checkout view.
 */
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { formatMoney } from 'vbwd-view-component';
import { useSubscriptionCheckoutStore } from '../../stores/checkout';

const { t } = useI18n();
const store = useSubscriptionCheckoutStore();

const planPrice = computed(() => Number(store.plan?.price || store.plan?.display_price || 0));
// Render every money figure through formatMoney — IEEE-754 doubles turn
// 29.99 + 9.99 + 0.01 into 39.989999999999995, which leaks "Pay $39.989999…"
// onto the button otherwise. Half-up at the third decimal per user spec.
const planCurrency = computed<string>(() => (store.plan?.currency as string) || 'USD');
const formattedPlanPrice = computed(() =>
  formatMoney(planPrice.value, { currency: planCurrency.value }),
);
const formattedTotal = computed(() =>
  formatMoney(Number(store.orderTotal), { currency: planCurrency.value }),
);

function formatBillingPeriod(period?: string): string {
  if (!period) return t('common.billingPeriods.month');
  const periodMap: Record<string, string> = {
    monthly: t('common.billingPeriods.month'),
    yearly: t('common.billingPeriods.year'),
    annual: t('common.billingPeriods.year'),
    weekly: t('common.billingPeriods.week'),
    MONTHLY: t('common.billingPeriods.month'),
    YEARLY: t('common.billingPeriods.year'),
  };
  return periodMap[period] || period.toLowerCase();
}
</script>

<style scoped>
.plan-details {
  margin-bottom: 8px;
}
.plan-row {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  margin-bottom: 4px;
}
.plan-description {
  color: #6b7280;
  font-size: 0.9rem;
  margin: 4px 0 0;
}
.total {
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid #e5e7eb;
  text-align: right;
}
</style>
