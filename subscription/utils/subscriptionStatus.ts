/**
 * Backend status enums (SubscriptionStatus, InvoiceStatus, …) are serialised
 * upper-case ("PENDING", "ACTIVE", "PAID"). Compare through this one helper so
 * a view never silently mis-labels a status over casing.
 */
export function hasStatus(status: string | null | undefined, expectedStatus: string): boolean {
  return !!status && status.toUpperCase() === expectedStatus.toUpperCase();
}
