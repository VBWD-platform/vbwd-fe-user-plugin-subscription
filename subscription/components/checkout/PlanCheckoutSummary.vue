<template>
  <div
    v-if="store.plan"
    class="plan-details"
  >
    <div class="plan-row">
      <span data-testid="plan-name">{{ store.plan.name }}</span>
      <span data-testid="plan-price">
        <PriceDisplay
          convert-to-display
          :net-amount="planNetAmount"
          :gross-amount="planGrossAmount"
          :effective-display-mode="store.plan.effective_display_mode"
          :global-mode="store.plan.prices_display_mode"
          :currency="planCurrency"
          :account-type="authStore.user?.account_type"
        />/{{ formatBillingPeriod(store.plan.billing_period) }}</span>
    </div>
    <p
      v-if="store.plan.description"
      class="plan-description"
    >
      {{ store.plan.description }}
    </p>
    <!-- Per-rate tax disclosure for the plan line. In the HETEROGENEOUS case
         (line items span different tax rates) each line shows its own breakdown;
         the homogeneous single-rate case is covered by the order-level
         OrderTaxSummary the checkout view renders, so we omit it here to avoid a
         duplicate. -->
    <PriceBreakdown
      v-if="isHeterogeneous && planPriceVO && planPriceVO.taxes.length > 0"
      convert-to-display
      :price="planPriceVO"
    />

    <!-- Selected token bundles + add-ons. These are summed into the order total
         (store.grossTotal/orderTotal); rendering them here keeps the visible
         summary consistent with the Total the checkout view shows (S93). -->
    <template
      v-for="bundle in store.selectedBundles"
      :key="bundle.id"
    >
      <div
        class="plan-row addon-row"
        data-testid="summary-token-bundle"
      >
        <span>{{ bundle.name }}</span>
        <span>{{ formatInDisplay(Number(bundle.price), currency) }}</span>
      </div>
      <PriceBreakdown
        v-if="isHeterogeneous && bundle.price_obj && bundle.price_obj.taxes.length > 0"
        convert-to-display
        :price="bundle.price_obj"
        class="line-breakdown"
      />
    </template>
    <template
      v-for="addon in store.selectedAddons"
      :key="addon.id"
    >
      <div
        class="plan-row addon-row"
        data-testid="summary-add-on"
      >
        <span>{{ addon.name }}</span>
        <span>{{ formatInDisplay(Number(addon.price), currency) }}</span>
      </div>
      <PriceBreakdown
        v-if="isHeterogeneous && addon.price_obj && addon.price_obj.taxes.length > 0"
        convert-to-display
        :price="addon.price_obj"
        class="line-breakdown"
      />
    </template>
    <!-- The net total (and any discount / savings) is rendered by the checkout
         view from the agnostic core store — no duplicate total here. -->
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
import { useAuthStore } from 'vbwd-view-component';
import { useSubscriptionCheckoutStore } from '../../stores/checkout';
import { useAppConfigStore } from '@/stores/appConfig';
import { useDisplayPrice } from '@/composables/useDisplayPrice';
import PriceDisplay from '@/components/PriceDisplay.vue';
import PriceBreakdown from '@/components/PriceBreakdown.vue';

const { t } = useI18n();
const store = useSubscriptionCheckoutStore();
const authStore = useAuthStore();
const appConfig = useAppConfigStore();
const { formatInDisplay } = useDisplayPrice();

// S85.4 — the checkout store now carries the computed net/gross split + the
// per-tax Price VO (from /tarif-plans), so we feed the real net/gross to
// <PriceDisplay> (the business overlay flips the side) and render the detailed
// <PriceBreakdown> when the plan has taxes. No tax math here — the amounts come
// straight from the VO; formatting is PriceDisplay/PriceBreakdown's job.
const planGross = computed(() => Number(store.plan?.price || store.plan?.display_price || 0));
const planGrossAmount = computed(() => Number(store.plan?.gross_price ?? planGross.value));
const planNetAmount = computed(() => Number(store.plan?.net_price ?? planGross.value));
const planPriceVO = computed(() => store.plan?.price_obj ?? null);
// Heterogeneous = the order's line items span more than one distinct tax group
// (decided purely by the aggregated tax-array length). Only then do per-line
// breakdowns render; the homogeneous case is shown once at the order level.
const isHeterogeneous = computed(() => store.orderPrice.taxes.length > 1);
// The operating currency: the plan's own currency if it carries one, else the
// global default (S93) — never a hardcoded 'USD'.
const currency = computed<string>(
  () => store.plan?.price_obj?.currency || (store.plan?.currency as string) || appConfig.defaultCurrency
);
const planCurrency = currency;

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
.line-breakdown {
  margin: 2px 0 8px;
  padding-left: 12px;
}
.total {
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid #e5e7eb;
  text-align: right;
}
</style>
