<template>
  <article
    class="public-plan-detail"
    data-testid="public-plan-detail"
  >
    <router-link
      class="public-plan-detail__back"
      :to="publicPlansBase()"
      data-testid="public-plans-link"
    >
      {{ $t('nav.plans') }}
    </router-link>

    <p
      v-if="loading"
      class="public-plan-detail__state"
      data-testid="plan-loading"
    >
      {{ $t('planDetail.loading') }}
    </p>
    <p
      v-else-if="!plan"
      class="public-plan-detail__state"
      data-testid="public-plan-not-found"
    >
      {{ $t('planDetail.error') }}
    </p>
    <template v-else>
      <h1
        class="public-plan-detail__name"
        data-testid="plan-name"
      >
        {{ plan.name }}
      </h1>
      <div
        class="public-plan-detail__price"
        data-testid="plan-price"
      >
        <PriceDisplay
          convert-to-display
          :effective-display-mode="plan.effective_display_mode"
          :global-mode="plan.prices_display_mode"
          :net-amount="plan.net_price ?? plan.display_price ?? 0"
          :gross-amount="plan.gross_price ?? plan.display_price ?? 0"
          :currency="plan.display_currency || appConfig.defaultCurrency"
        />
        <span class="public-plan-detail__period">/{{ formatBillingPeriod(plan.billing_period, t) }}</span>
      </div>
      <p
        v-if="description"
        class="public-plan-detail__description"
        data-testid="plan-description"
      >
        {{ description }}
      </p>
      <section
        v-if="features.length"
        class="public-plan-detail__features"
      >
        <h2>{{ $t('planDetail.features') }}</h2>
        <ul data-testid="plan-features">
          <li
            v-for="feature in features"
            :key="feature"
          >
            {{ feature }}
          </li>
        </ul>
      </section>
      <router-link
        class="public-plan-detail__select"
        :to="`/dashboard/checkout/${plan.slug}`"
        data-testid="select-plan-btn"
      >
        {{ $t('plans.selectPlan') }}
      </router-link>
    </template>
  </article>
</template>

<script setup lang="ts">
/**
 * S154 D10 — one public, indexable tarif plan at `/<plans_slug>/<plan_slug>`.
 *
 * Reads the public `GET /api/v1/tarif-plans/<slug>`; an inactive or unknown plan
 * is "not found" (noindex — theme mode answers the labelled 404). Shows name,
 * price, description and features; "Select plan" enters the existing private
 * checkout. The page sets its own SEO head (theme twin: detail.html.j2).
 */
import { computed, onMounted, ref } from 'vue';
import { useRoute } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { api } from '@/api';
import PriceDisplay from '@/components/PriceDisplay.vue';
import { useAppConfigStore } from '@/stores/appConfig';
import { planFeatures, publicPlanPath, publicPlansBase, publicPlansRobots } from '../publicPlans';
import { applySeoHead, plainText, publicPlanSeoSource } from '../publicPlanHead';
import { formatBillingPeriod } from '../utils/billingPeriod';

interface PublicPlan {
  name: string;
  slug: string;
  description?: string | null;
  billing_period?: string;
  features?: unknown;
  is_active?: boolean;
  display_price?: number;
  display_currency?: string;
  net_price?: number;
  gross_price?: number;
  effective_display_mode?: 'netto' | 'brutto';
  prices_display_mode?: 'netto' | 'brutto';
}

const NOT_FOUND_HEAD = { robots: 'noindex,follow' };

const { t } = useI18n();
const route = useRoute();
const appConfig = useAppConfigStore();
const loading = ref(true);
const plan = ref<PublicPlan | null>(null);

const description = computed(() => plainText(plan.value?.description));
const features = computed(() => planFeatures(plan.value?.features));

async function loadActivePlan(planSlug: string): Promise<PublicPlan | null> {
  try {
    const loaded = (await api.get(`/tarif-plans/${encodeURIComponent(planSlug)}`)) as PublicPlan;
    return loaded.is_active ? loaded : null;
  } catch {
    return null;
  }
}

onMounted(async () => {
  plan.value = await loadActivePlan(String(route.params.planSlug ?? ''));
  loading.value = false;
  if (!plan.value) {
    await applySeoHead(NOT_FOUND_HEAD);
    return;
  }
  await appConfig.load();
  await applySeoHead(
    publicPlanSeoSource({
      subject: plan.value.name,
      siteName: appConfig.siteName,
      description: description.value,
      path: publicPlanPath(plan.value.slug),
      robots: publicPlansRobots(),
    }),
  );
});
</script>

<style scoped>
.public-plan-detail {
  max-width: 800px;
  margin: 0 auto;
  padding: 32px 20px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.public-plan-detail__back {
  color: var(--vbwd-color-primary, #3498db);
  text-decoration: none;
}
.public-plan-detail__name {
  margin: 0;
  color: var(--vbwd-text-heading, #2c3e50);
}
.public-plan-detail__price {
  font-size: 1.4rem;
  font-weight: 600;
}
.public-plan-detail__period,
.public-plan-detail__description,
.public-plan-detail__state {
  color: var(--vbwd-text-muted, #666);
}
.public-plan-detail__features ul {
  padding-left: 20px;
}
.public-plan-detail__select {
  align-self: flex-start;
  padding: 12px 32px;
  border-radius: var(--vbwd-radius-md, 4px);
  background: var(--vbwd-color-primary, #3498db);
  color: var(--vbwd-color-on-primary, #fff);
  text-decoration: none;
  font-weight: 600;
}
</style>
