// Trust Phase 2 constants. Named constants, not environment variables.
// Minimum number of completed-or-cancelled orders before a rate is shown.
export const MIN_ORDERS_FOR_RATES = 10
// Minimum number of verified-purchase reviews before an average rating is shown.
export const MIN_REVIEWS_FOR_RATING = 5
// Counts of returns or disputes below this are suppressed to a band.
export const SUPPRESSION_THRESHOLD = 5
// Rolling window for rates (days).
export const ROLLING_WINDOW_DAYS = 90
// Lifetime window marker: 0 means no upper bound (all history).
export const LIFETIME_WINDOW_DAYS = 0
// Target window (days) after payment for a vendor's first reply to count as responsive.
export const RESPONSE_WINDOW_DAYS = 2
// Delivery window (days) after dispatch used as the fallback deadline when an
// OrderItem has no expectedArrivalDate. Combined with dispatchTargetDaysAfterPayment.
export const DELIVERY_WINDOW_DAYS = 3
