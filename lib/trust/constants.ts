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
