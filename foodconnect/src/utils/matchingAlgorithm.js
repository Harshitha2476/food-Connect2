/**
 * Frontend demonstration of the intelligent matching algorithm.
 * Travel times come from mock data (illustrative only — not live GPS routing).
 * Matching results are generated in milliseconds; eligibility requires travel time ≤ 15 min.
 */

const MAX_TRAVEL_MIN = 15;

/**
 * Normalize a raw score to 0–100.
 */
function normalize(value, max = 100) {
  if (max <= 0) return 0;
  return Math.min(100, Math.max(0, (value / max) * 100));
}

/**
 * Demand compatibility (0–100): how well food category matches center demand.
 */
function demandScore(foodCategory, center) {
  if (!center.demandCategories || center.demandCategories.length === 0) return 40;
  const match = center.demandCategories.some(
    (c) => c.toLowerCase() === foodCategory.toLowerCase()
  );
  if (match) {
    // Higher if they also have open demand quantity
    const demandFactor = center.demandKg > 0 ? 1 : 0.7;
    return 90 * demandFactor + 10;
  }
  // Partial credit for "Other" or broad categories
  if (foodCategory === 'Other' || center.demandCategories.includes('Other')) return 50;
  return 20;
}

/**
 * Capacity score (0–100): available capacity relative to food quantity.
 */
function capacityScore(quantityKg, center) {
  if (center.availableCapacityKg <= 0) return 0;
  if (center.availableCapacityKg >= quantityKg) {
    // Prefer centers that are not over-capacity after accepting
    const utilization = quantityKg / center.availableCapacityKg;
    return 100 - utilization * 20; // slightly prefer less full centers
  }
  // Partial capacity — can take some
  const ratio = center.availableCapacityKg / quantityKg;
  return Math.max(0, ratio * 60);
}

/**
 * Travel time score (0–100): lower time = higher score. Only eligible if ≤ 15 min.
 */
function travelScore(travelTimeMin) {
  if (travelTimeMin > MAX_TRAVEL_MIN) return 0;
  // 0 min → 100, 15 min → ~40
  return Math.max(0, 100 - (travelTimeMin / MAX_TRAVEL_MIN) * 60);
}

/**
 * Urgency score (0–100).
 */
function urgencyScore(urgency) {
  const map = { high: 100, medium: 65, low: 30 };
  return map[urgency] ?? 50;
}

/**
 * Compute matching score for one center against one surplus item.
 * Score = 0.35×Demand + 0.25×Capacity + 0.25×Travel + 0.15×Urgency
 */
export function computeMatchScore(surplus, center) {
  const d = demandScore(surplus.category, center);
  const c = capacityScore(surplus.quantityKg, center);
  const t = travelScore(center.travelTimeMin);
  const u = urgencyScore(center.urgency);

  const total =
    0.35 * d +
    0.25 * c +
    0.25 * t +
    0.15 * u;

  return {
    total: Math.round(total * 10) / 10,
    breakdown: {
      demand: Math.round(d),
      capacity: Math.round(c),
      travel: Math.round(t),
      urgency: Math.round(u),
    },
    eligible: center.travelTimeMin <= MAX_TRAVEL_MIN && c > 0,
    travelTimeMin: center.travelTimeMin,
  };
}

/**
 * Rank all centers for a surplus listing.
 * Returns eligible centers first (travel ≤ 15 min), sorted by score descending,
 * then ineligible centers marked clearly.
 */
export function rankCenters(surplus, centers) {
  const scored = centers.map((center) => {
    const result = computeMatchScore(surplus, center);
    return {
      ...center,
      matchScore: result.total,
      breakdown: result.breakdown,
      eligible: result.eligible,
      travelTimeMin: center.travelTimeMin,
    };
  });

  const eligible = scored
    .filter((c) => c.eligible)
    .sort((a, b) => b.matchScore - a.matchScore);

  const ineligible = scored
    .filter((c) => !c.eligible)
    .sort((a, b) => a.travelTimeMin - b.travelTimeMin);

  return { eligible, ineligible, all: [...eligible, ...ineligible] };
}

/**
 * Explain why a center ranked higher (for UI tooltip / detail).
 */
export function explainRanking(center) {
  const { breakdown, travelTimeMin, matchScore } = center;
  const parts = [];
  if (breakdown.demand >= 80) parts.push('strong category demand match');
  if (breakdown.capacity >= 80) parts.push('sufficient storage capacity');
  if (travelTimeMin <= 8) parts.push(`very short travel (${travelTimeMin} min)`);
  else if (travelTimeMin <= 15) parts.push(`within 15-min window (${travelTimeMin} min)`);
  if (breakdown.urgency >= 80) parts.push('high urgency need');
  if (parts.length === 0) parts.push('balanced overall score');
  return `Score ${matchScore}: ${parts.join('; ')}.`;
}

export { MAX_TRAVEL_MIN };
