<template>
  <section
    class="public-plans"
    data-testid="public-plans"
  >
    <h1 class="public-plans__title">
      {{ $t('plans.title') }}
    </h1>
    <p class="public-plans__subtitle">
      {{ $t('plans.subtitle') }}
    </p>

    <p
      v-if="loading"
      class="public-plans__state"
      data-testid="public-plans-loading"
    >
      {{ $t('plans.loading') }}
    </p>
    <ul
      v-else-if="plansStore.plans.length"
      class="public-plans__list"
    >
      <li
        v-for="plan in plansStore.plans"
        :key="plan.id"
        class="public-plan-card"
        :data-testid="`public-plan-card-${plan.slug}`"
      >
        <h2 class="public-plan-card__name">
          <router-link
            :to="publicPlanPath(plan.slug)"
            :data-testid="`public-plan-link-${plan.slug}`"
          >
            {{ plan.name }}
          </router-link>
        </h2>
        <div class="public-plan-card__price">
          <PriceDisplay
            convert-to-display
            :effective-display-mode="plan.effective_display_mode"
            :global-mode="plan.prices_display_mode"
            :net-amount="plan.net_price ?? plan.display_price"
            :gross-amount="plan.gross_price ?? plan.display_price"
            :currency="plan.display_currency"
          />
          <span class="public-plan-card__period">/{{ formatBillingPeriod(plan.billing_period, t) }}</span>
        </div>
        <p
          v-if="plan.description"
          class="public-plan-card__description"
        >
          {{ plan.description }}
        </p>
        <router-link
          class="public-plan-card__select"
          :to="`/dashboard/checkout/${plan.slug}`"
          :data-testid="`select-plan-${plan.slug}`"
        >
          {{ $t('plans.selectPlan') }}
        </router-link>
      </li>
    </ul>
    <p
      v-else
      class="public-plans__state"
      data-testid="public-plans-empty"
    >
      {{ $t('plans.noPlans') }}
    </p>
  </section>
</template>

<script setup lang="ts">
/**
 * S154 D10 — the public, indexable tarif-plan list at `/<plans_slug>`.
 *
 * Plans come from the public `GET /api/v1/tarif-plans` (active plans only — the
 * backend rule) through the shared plans store. Each plan links its public
 * detail page with a real anchor; "Select plan" enters the existing private
 * checkout. The page sets its own SEO head (theme twin: list.html.j2).
 */
import { onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import PriceDisplay from '@/components/PriceDisplay.vue';
import { useAppConfigStore } from '@/stores/appConfig';
import { usePlansStore } from '../stores/plans';
import { publicPlanPath, publicPlansBase, publicPlansRobots } from '../publicPlans';
import { applySeoHead, publicPlanSeoSource } from '../publicPlanHead';
import { formatBillingPeriod } from '../utils/billingPeriod';

const { t } = useI18n();
const plansStore = usePlansStore();
const appConfig = useAppConfigStore();
const loading = ref(true);

onMounted(async () => {
  try {
    await plansStore.fetchPlans();
  } catch {
    // The store keeps an empty list; the empty state renders.
  } finally {
    loading.value = false;
  }
  await appConfig.load();
  await applySeoHead(
    publicPlanSeoSource({
      subject: t('nav.plans'),
      siteName: appConfig.siteName,
      description: t('plans.subtitle'),
      path: publicPlansBase(),
      robots: publicPlansRobots(),
    }),
  );
});
</script>

<style scoped>
.public-plans {
  max-width: 1100px;
  margin: 0 auto;
  padding: 32px 20px;
}
.public-plans__title {
  margin: 0 0 8px;
  color: var(--vbwd-text-heading, #2c3e50);
}
.public-plans__subtitle,
.public-plans__state {
  color: var(--vbwd-text-muted, #666);
}
.public-plans__list {
  list-style: none;
  padding: 0;
  margin: 24px 0 0;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
  gap: 20px;
}
.public-plan-card {
  padding: 20px;
  border: 1px solid var(--vbwd-border-color, #ddd);
  border-radius: var(--vbwd-radius-md, 8px);
  background: var(--vbwd-card-bg, #fff);
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.public-plan-card__name {
  margin: 0;
  font-size: 1.25rem;
}
.public-plan-card__period,
.public-plan-card__description {
  color: var(--vbwd-text-muted, #666);
}
.public-plan-card__select {
  margin-top: auto;
  padding: 10px 20px;
  text-align: center;
  border-radius: var(--vbwd-radius-md, 4px);
  background: var(--vbwd-color-primary, #3498db);
  color: var(--vbwd-color-on-primary, #fff);
  text-decoration: none;
  font-weight: 600;
}
</style>
