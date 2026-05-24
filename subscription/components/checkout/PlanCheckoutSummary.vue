<template>
  <div
    v-if="store.plan"
    class="plan-details"
  >
    <div class="plan-row">
      <span data-testid="plan-name">{{ store.plan.name }}</span>
      <span data-testid="plan-price">${{ planPrice }}/{{ formatBillingPeriod(store.plan.billing_period) }}</span>
    </div>
    <p
      v-if="store.plan.description"
      class="plan-description"
    >
      {{ store.plan.description }}
    </p>
    <div class="total">
      <strong>{{ $t('checkout.success.totalLabel') }} ${{ store.orderTotal }}</strong>
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
import { useSubscriptionCheckoutStore } from '../../stores/checkout';

const { t } = useI18n();
const store = useSubscriptionCheckoutStore();

const planPrice = computed(() => store.plan?.price || store.plan?.display_price || 0);

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
