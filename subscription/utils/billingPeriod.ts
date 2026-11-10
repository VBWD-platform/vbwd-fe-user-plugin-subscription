/**
 * The plan billing-period label (`/month`, `/year`, ...) shared by the plan
 * views: a known period is translated, anything else is shown verbatim, and a
 * missing one reads as a month.
 */
type Translate = (key: string) => string;

const PERIOD_KEYS: Record<string, string> = {
  monthly: 'common.billingPeriods.month',
  yearly: 'common.billingPeriods.year',
  annual: 'common.billingPeriods.year',
  weekly: 'common.billingPeriods.week',
};

export function formatBillingPeriod(period: string | undefined | null, translate: Translate): string {
  if (!period) return translate(PERIOD_KEYS.monthly);
  const key = PERIOD_KEYS[period.toLowerCase()];
  return key ? translate(key) : period;
}
