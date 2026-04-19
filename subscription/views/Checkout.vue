<template>
  <div class="checkout">
    <h1>{{ $t('checkout.title') }}</h1>

    <!-- Loading State -->
    <div
      v-if="store.loading"
      class="loading-state"
      data-testid="checkout-loading"
    >
      <div class="spinner" />
      <p>{{ $t('checkout.loading') }}</p>
    </div>

    <!-- Error State (only show if no checkout result) -->
    <div
      v-else-if="store.error && !store.checkoutResult"
      class="error-state"
      data-testid="checkout-error"
    >
      <p>{{ store.error }}</p>
      <router-link
        to="/dashboard/plans"
        class="btn secondary"
      >
        {{ $t('common.backToPlans') }}
      </router-link>
    </div>

    <!-- Checkout Success -->
    <div
      v-else-if="store.checkoutResult"
      class="checkout-success"
      data-testid="checkout-success"
    >
      <h2>{{ $t('checkout.success.title') }}</h2>

      <div class="status-info">
        <p
          v-if="store.checkoutResult.subscription"
        >
          {{ $t('checkout.success.subscriptionStatus') }}
          <span data-testid="subscription-status">
            {{ store.checkoutResult.subscription.status === 'pending' ? $t('checkout.success.statusPending') : $t('checkout.success.statusActive') }}
          </span>
        </p>
        <p data-testid="invoice-number">
          {{ $t('checkout.success.invoiceLabel') }} {{ store.checkoutResult.invoice.invoice_number }}
        </p>
      </div>

      <div
        data-testid="payment-required-message"
        class="payment-message"
      >
        {{ $t('checkout.success.paymentRequired') }}
      </div>

      <!-- Invoice Line Items -->
      <div
        data-testid="invoice-line-items"
        class="invoice-items card"
      >
        <h3>{{ $t('checkout.success.invoiceItems') }}</h3>
        <div
          v-for="(item, index) in store.checkoutResult.invoice.line_items"
          :key="index"
          :data-testid="`invoice-line-item-${item.type}`"
          class="invoice-line-item"
        >
          <span>{{ item.description }}</span>
          <span>${{ item.total_price }}</span>
        </div>
        <div class="total">
          <strong>{{ $t('checkout.success.totalLabel') }} ${{ store.checkoutResult.invoice.total_amount }}</strong>
        </div>
      </div>

      <!-- Navigation Buttons -->
      <div class="checkout-actions">
        <button
          v-if="store.checkoutResult.subscription"
          data-testid="view-subscription-btn"
          class="btn primary"
          @click="goToSubscription"
        >
          {{ $t('checkout.success.viewSubscription') }}
        </button>
        <button
          data-testid="view-invoice-btn"
          class="btn secondary"
          @click="goToInvoice"
        >
          {{ $t('checkout.success.viewInvoice') }}
        </button>
        <button
          data-testid="back-to-plans-btn"
          class="btn secondary"
          @click="goToPlans"
        >
          {{ $t('common.backToPlans') }}
        </button>
      </div>
    </div>

    <!-- Checkout Form -->
    <div
      v-else-if="store.plan || store.lineItems.length > 0"
      class="checkout-content"
    >
      <!-- Step 1: Email Block (only for unauthenticated users) -->
      <EmailBlock
        v-if="!isAuthenticated"
        :initial-email="userEmail"
        :is-authenticated="isAuthenticated"
        class="card"
        @authenticated="handleAuthenticated"
        @logout="handleLogout"
      />

      <!-- Order Summary Card -->
      <div
        class="card order-summary"
        data-testid="order-summary"
      >
        <h2>{{ $t('checkout.orderSummary.title') }}</h2>
        <div
          v-if="store.plan"
          class="plan-details"
        >
          <div class="plan-row">
            <span data-testid="plan-name">{{ store.plan.name }}</span>
            <span data-testid="plan-price">${{ getPlanPrice() }}/{{ formatBillingPeriod(store.plan.billing_period) }}</span>
          </div>
          <p
            v-if="store.plan.description"
            class="plan-description"
          >
            {{ store.plan.description }}
          </p>
        </div>

        <!-- Selected Line Items -->
        <div class="selected-items">
          <div
            v-for="item in store.lineItems"
            :key="`${item.type}-${item.id}`"
            :data-testid="`line-item-${formatTypeForTestId(item.type)}-${formatItemTestId(item.name)}`"
            class="line-item-row"
          >
            <span>{{ item.name }}</span>
            <span>${{ item.price }}</span>
            <button
              v-if="item.type === 'token_bundle'"
              :data-testid="`remove-token-bundle-${item.token_amount}`"
              class="btn-remove"
              @click="store.removeBundle(item.id)"
            >
              {{ $t('common.remove') }}
            </button>
            <button
              v-if="item.type === 'add_on'"
              :data-testid="`remove-addon-${formatSlug(item.name)}`"
              class="btn-remove"
              @click="store.removeAddon(item.id)"
            >
              {{ $t('common.remove') }}
            </button>
          </div>
        </div>

        <div
          data-testid="order-total"
          class="total"
        >
          <strong>{{ $t('checkout.success.totalLabel') }} ${{ store.orderTotal }}</strong>
        </div>
      </div>

      <!-- Step 2: Billing Address -->
      <BillingAddressBlock
        :readonly="isAuthenticated"
        class="card"
        @valid="handleBillingAddressValid"
      />

      <!-- Step 3: Payment Methods -->
      <PaymentMethodsBlock
        class="card"
        @selected="handlePaymentMethodSelected"
      />

      <!-- Token Bundles Section (hidden on cart checkout — items already chosen) -->
      <div
        v-if="!store.isCartCheckout && store.availableBundles.length > 0"
        class="card"
        data-testid="token-bundles-section"
      >
        <h2>{{ $t('checkout.tokenBundles.title') }}</h2>
        <div class="options-grid">
          <div
            v-for="bundle in store.availableBundles"
            :key="bundle.id"
            :data-testid="`token-bundle-${bundle.token_amount}`"
            class="option-card"
            :class="{ selected: isSelectedBundle(bundle.id) }"
            @click="store.addBundle(bundle)"
          >
            <div class="option-name">
              {{ bundle.name }}
            </div>
            <div class="option-price">
              ${{ bundle.price }}
            </div>
          </div>
        </div>
      </div>

      <!-- Add-ons Section (hidden on cart checkout — items already chosen) -->
      <div
        v-if="!store.isCartCheckout && store.availableAddons.length > 0"
        class="card"
        data-testid="addons-section"
      >
        <h2>{{ $t('checkout.addonsSection.title') }}</h2>
        <div class="options-grid">
          <div
            v-for="addon in store.availableAddons"
            :key="addon.id"
            :data-testid="`addon-${formatSlug(addon.name)}`"
            class="option-card addon-card"
            :class="{ selected: isSelectedAddon(addon.id) }"
            @click="store.addAddon(addon)"
          >
            <div class="option-name">
              {{ addon.name }}
            </div>
            <div
              :data-testid="`addon-${formatSlug(addon.name)}-price`"
              class="option-price"
            >
              ${{ addon.price }}
            </div>
            <p
              :data-testid="`addon-${formatSlug(addon.name)}-description`"
              class="option-description"
            >
              {{ addon.description }}
            </p>
          </div>
        </div>
      </div>

      <!-- Step 4: Terms and Conditions -->
      <TermsCheckbox @change="handleTermsChange" />

      <!-- Requirements Status -->
      <div
        v-if="missingRequirements.length > 0"
        class="requirements"
        data-testid="checkout-requirements"
      >
        <p><strong>{{ $t('checkout.requirements.title') }}</strong></p>
        <ul>
          <li
            v-for="req in missingRequirements"
            :key="req"
          >
            {{ req }}
          </li>
        </ul>
      </div>

      <!-- Confirm Section -->
      <div class="checkout-actions">
        <router-link
          to="/dashboard/plans"
          class="btn secondary"
        >
          {{ $t('common.backToPlans') }}
        </router-link>
        <button
          data-testid="confirm-checkout"
          class="btn primary pay-button"
          :disabled="!canCheckout"
          @click="store.submitCheckout"
        >
          {{ store.submitting ? $t('checkout.submitting') : $t('checkout.payButton', { amount: store.orderTotal }) }}
        </button>
      </div>

      <!-- Error Display -->
      <div
        v-if="store.error"
        data-testid="checkout-error"
        class="error-message"
      >
        {{ store.error }}
      </div>
    </div>

    <!-- No Plan Selected -->
    <div
      v-else
      class="no-plan"
    >
      <p>{{ $t('checkout.noPlanSelected') }}</p>
      <router-link
        to="/dashboard/plans"
        class="btn primary"
      >
        {{ $t('common.browsePlans') }}
      </router-link>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { useCheckoutStore } from '@/stores/checkout';
import { isAuthenticated as checkAuth } from '@/api';
import EmailBlock from '@/components/checkout/EmailBlock.vue';
import PaymentMethodsBlock from '@/components/checkout/PaymentMethodsBlock.vue';
import TermsCheckbox from '@/components/checkout/TermsCheckbox.vue';
import BillingAddressBlock from '@/components/checkout/BillingAddressBlock.vue';

const route = useRoute();
const router = useRouter();
const { t } = useI18n();
const store = useCheckoutStore();

// Auth state
const isAuthenticated = ref(checkAuth());
const userEmail = ref(localStorage.getItem('user_email') || '');

// Payment method state
const selectedPaymentMethod = ref<string | null>(null);

// Terms acceptance state
const termsAccepted = ref(false);

// Billing address state
const billingAddressValid = ref(false);

// Handle authentication from EmailBlock
const handleAuthenticated = (_userId: string) => {
  isAuthenticated.value = true;
};

// Handle logout from EmailBlock
const handleLogout = () => {
  isAuthenticated.value = false;
  userEmail.value = '';
};

// Handle payment method selection
const handlePaymentMethodSelected = (methodCode: string) => {
  selectedPaymentMethod.value = methodCode;
  store.setPaymentMethod(methodCode);
};

// Handle terms acceptance
const handleTermsChange = (accepted: boolean) => {
  termsAccepted.value = accepted;
};

// Handle billing address validity
const handleBillingAddressValid = (isValid: boolean) => {
  billingAddressValid.value = isValid;
};

// Computed: can checkout only if all conditions met
const canCheckout = computed(() =>
  isAuthenticated.value &&
  selectedPaymentMethod.value &&
  billingAddressValid.value &&
  termsAccepted.value &&
  !store.submitting
);

// Computed: missing requirements for checkout
const missingRequirements = computed(() => {
  const missing: string[] = [];
  if (!isAuthenticated.value) missing.push(t('checkout.requirements.signIn'));
  if (!billingAddressValid.value) missing.push(t('checkout.requirements.billingAddress'));
  if (!selectedPaymentMethod.value) missing.push(t('checkout.requirements.paymentMethod'));
  if (!termsAccepted.value) missing.push(t('checkout.requirements.acceptTerms'));
  return missing;
});

// Redirect to payment provider when checkout succeeds
watch(() => store.checkoutResult, (result) => {
  if (result && store.paymentMethodCode === 'stripe') {
    const invoiceId = result.invoice?.id;
    if (invoiceId) {
      router.push({ path: '/pay/stripe', query: { invoice: invoiceId } });
    }
  } else if (result && store.paymentMethodCode === 'paypal') {
    const invoiceId = result.invoice?.id;
    if (invoiceId) {
      router.push({ path: '/pay/paypal', query: { invoice: invoiceId } });
    }
  } else if (result && store.paymentMethodCode === 'yookassa') {
    const invoiceId = result.invoice?.id;
    if (invoiceId) {
      router.push({ path: '/pay/yookassa', query: { invoice: invoiceId } });
    }
  }
});

onMounted(async () => {
  const planSlug = route.params.planSlug as string;
  if (planSlug) {
    await store.loadPlan(planSlug);
    await store.loadOptions();
  } else if (route.name === 'checkout-cart') {
    await store.loadFromCart();
  }
});

onUnmounted(() => {
  store.reset();
});

function getPlanPrice(): number {
  return store.plan?.price || store.plan?.display_price || 0;
}

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

function formatSlug(name: string): string {
  return name.toLowerCase().replace(/\s+/g, '-');
}

function formatTypeForTestId(type: string): string {
  return type.replace(/_/g, '-');
}

function formatItemTestId(name: string): string {
  return name;
}

function isSelectedBundle(bundleId: string): boolean {
  return store.selectedBundles.some(b => b.id === bundleId);
}

function isSelectedAddon(addonId: string): boolean {
  return store.selectedAddons.some(a => a.id === addonId);
}

function goToSubscription() {
  router.push('/dashboard/subscription');
}

function goToInvoice() {
  const invoiceId = store.checkoutResult?.invoice?.id;
  if (invoiceId) {
    router.push(`/dashboard/invoice/${invoiceId}`);
  } else {
    router.push('/dashboard/subscription/invoices');
  }
}

function goToPlans() {
  router.push('/dashboard/plans');
}
</script>

<style scoped>
.checkout {
  max-width: 900px;
}

h1 {
  margin-bottom: 30px;
  color: #2c3e50;
}

.loading-state,
.error-state,
.no-plan {
  text-align: center;
  padding: 60px 20px;
  color: #666;
}

.spinner {
  width: 40px;
  height: 40px;
  border: 3px solid #f3f3f3;
  border-top: 3px solid #3498db;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin: 0 auto 15px;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

.checkout-content,
.checkout-success {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.card {
  background: white;
  padding: 25px;
  border-radius: 8px;
  box-shadow: 0 2px 5px rgba(0, 0, 0, 0.05);
}

.card h2 {
  margin-bottom: 20px;
  color: #2c3e50;
  font-size: 1.2rem;
  border-bottom: 1px solid #eee;
  padding-bottom: 10px;
}

/* Order Summary */
.plan-details {
  margin-bottom: 20px;
}

.plan-row {
  display: flex;
  justify-content: space-between;
  font-size: 1.1rem;
  font-weight: 600;
  color: #2c3e50;
}

.plan-description {
  color: #666;
  font-size: 0.9rem;
  margin-top: 8px;
}

.selected-items {
  border-top: 1px solid #eee;
  padding-top: 15px;
}

.line-item-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 0;
  color: #666;
}

.btn-remove {
  padding: 4px 8px;
  font-size: 0.75rem;
  background: #fee;
  color: #c00;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

.btn-remove:hover {
  background: #fcc;
}

.total {
  margin-top: 15px;
  padding-top: 15px;
  border-top: 2px solid #eee;
  font-size: 1.2rem;
  text-align: right;
}

/* Options Grid */
.options-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 15px;
}

.option-card {
  padding: 15px;
  border: 2px solid #eee;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;
}

.option-card:hover {
  border-color: #3498db;
  background: #f8fafc;
}

.option-card.selected {
  border-color: #3498db;
  background: #ebf5ff;
}

.option-name {
  font-weight: 600;
  color: #2c3e50;
  margin-bottom: 5px;
}

.option-price {
  color: #3498db;
  font-size: 1.1rem;
}

.option-description {
  color: #666;
  font-size: 0.85rem;
  margin-top: 8px;
}

/* Invoice Items */
.invoice-items h3 {
  margin-bottom: 15px;
  color: #2c3e50;
}

.invoice-line-item {
  display: flex;
  justify-content: space-between;
  padding: 8px 0;
  border-bottom: 1px solid #eee;
}

/* Status Info */
.status-info {
  background: #f8f9fa;
  padding: 20px;
  border-radius: 8px;
  margin-bottom: 20px;
}

.status-info p {
  margin: 8px 0;
  color: #2c3e50;
}

.payment-message {
  background: #fff3cd;
  color: #856404;
  padding: 15px;
  border-radius: 8px;
  text-align: center;
  margin-bottom: 20px;
}

/* Actions */
.checkout-actions {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 15px;
  padding-top: 10px;
}

.submitting-text {
  color: #3498db;
  font-weight: 500;
}

.btn {
  padding: 12px 24px;
  border: none;
  border-radius: 4px;
  font-size: 1rem;
  cursor: pointer;
  text-decoration: none;
  display: inline-block;
  transition: background-color 0.2s;
}

.btn.primary {
  background-color: #3498db;
  color: white;
}

.btn.primary:hover:not(:disabled) {
  background-color: #2980b9;
}

.btn.primary:disabled {
  background-color: #95a5a6;
  cursor: not-allowed;
}

.btn.secondary {
  background-color: #ecf0f1;
  color: #2c3e50;
}

.btn.secondary:hover {
  background-color: #bdc3c7;
}

.error-message {
  background: #fee;
  color: #c00;
  padding: 15px;
  border-radius: 8px;
  margin-top: 15px;
}

/* Requirements Status */
.requirements {
  background: #fff3cd;
  padding: 15px;
  border-radius: 8px;
  margin: 15px 0;
  border: 1px solid #ffc107;
}

.requirements p {
  margin: 0 0 8px 0;
  color: #856404;
}

.requirements ul {
  margin: 0;
  padding-left: 20px;
  color: #856404;
}

.requirements li {
  margin-bottom: 4px;
}

/* Pay Button */
.pay-button {
  min-width: 180px;
}

@media (max-width: 600px) {
  .checkout-actions {
    flex-direction: column;
  }

  .btn {
    width: 100%;
    text-align: center;
  }

  .options-grid {
    grid-template-columns: 1fr;
  }
}
</style>
