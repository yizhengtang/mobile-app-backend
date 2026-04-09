// Estimated entrance fees by category (USD) — used when no real data is available
const ENTRANCE_FEE_ESTIMATES = {
  culture:  12,
  nature:    5,
  shopping:  0,
  food:      0,
  transit:   0,
};

// Transport cost per km by mode (USD)
const TRANSPORT_COST_PER_KM = {
  walk:    0,
  cycle:   0,
  transit: 0.5,
  drive:   0.3,
};

// Meal cost estimates by price level (USD per person)
const MEAL_COST_BY_PRICE_LEVEL = {
  1: 10,  // budget
  2: 20,  // moderate
  3: 40,  // upscale
  4: 70,  // fine dining
};
const DEFAULT_MEAL_COST = 20;

const DISCRETIONARY_RATE = 0.15; // 15% of subtotal

/**
 * Estimate the entrance fee for a single stop.
 * Uses the stop's AI-generated fee if present, otherwise falls back to category estimate.
 */
const estimateEntranceFee = (stop) => {
  if (stop.entranceFeeUSD != null) return stop.entranceFeeUSD;
  if (stop.stopType === 'meal' || stop.stopType === 'rest') return 0;
  return ENTRANCE_FEE_ESTIMATES[stop.category] || 0;
};

/**
 * Estimate transport cost for a leg between stops.
 */
const estimateTransportCost = (transport) => {
  if (!transport) return 0;
  const rate = TRANSPORT_COST_PER_KM[transport.mode] || 0;
  return Math.round((transport.distanceKm || 0) * rate * 100) / 100;
};

/**
 * Estimate meal cost for a food stop.
 */
const estimateMealCost = (stop, priceLevel = null) => {
  if (stop.category !== 'food') return 0;
  return MEAL_COST_BY_PRICE_LEVEL[priceLevel] || DEFAULT_MEAL_COST;
};

/**
 * Calculate a full budget breakdown for a single day.
 * @param {Array}  stops        - The day's stop objects.
 * @param {object} options
 * @param {number} options.budgetPerDay  - User's daily budget cap (optional).
 * @param {string} options.currency      - Currency code (default: 'USD').
 * @returns {object} budgetBreakdown
 */
const calculateDayBudget = (stops, { budgetPerDay = null, currency = 'USD' } = {}) => {
  let entranceFees = 0;
  let transport    = 0;
  let meals        = 0;

  for (const stop of stops) {
    entranceFees += estimateEntranceFee(stop);
    transport    += estimateTransportCost(stop.transportFromPrevious);
    meals        += estimateMealCost(stop, stop.priceLevel);
  }

  // Round to 2 decimal places
  entranceFees = Math.round(entranceFees * 100) / 100;
  transport    = Math.round(transport    * 100) / 100;
  meals        = Math.round(meals        * 100) / 100;

  const subtotal      = entranceFees + transport + meals;
  const discretionary = Math.round(subtotal * DISCRETIONARY_RATE * 100) / 100;
  const total         = Math.round((subtotal + discretionary) * 100) / 100;

  return {
    entranceFees,
    transport,
    meals,
    discretionary,
    total,
    currency,
    overBudget: budgetPerDay != null ? total > budgetPerDay : false,
  };
};

/**
 * Calculate budget for all days in a plan and return the total.
 * @param {Array}  days        - Plan days array.
 * @param {object} options     - { budgetPerDay, currency }
 * @returns {{ days: Array, totalBudget: number }}
 */
const calculatePlanBudget = (days, options = {}) => {
  const enrichedDays = days.map((day) => ({
    ...day,
    budgetBreakdown: calculateDayBudget(day.stops || [], options),
  }));

  const totalBudget = enrichedDays.reduce(
    (sum, day) => sum + (day.budgetBreakdown?.total || 0),
    0
  );

  return { days: enrichedDays, totalBudget: Math.round(totalBudget * 100) / 100 };
};

module.exports = { calculateDayBudget, calculatePlanBudget };
