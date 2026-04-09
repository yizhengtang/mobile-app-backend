const { getStructuredJSON } = require('./openaiService');
const { getForecast } = require('./weatherService');
const { withCache, TTL } = require('./cacheService');

const RAIN_THRESHOLD = 60; // precipitation probability % that triggers a replan

// Keywords that classify a stop as outdoors
const OUTDOOR_KEYWORDS = [
  'park', 'garden', 'beach', 'viewpoint', 'market', 'square', 'walk',
  'trail', 'waterfall', 'lake', 'hill', 'outdoor', 'open-air', 'promenade',
  'bridge', 'street', 'tour', 'cemetery', 'forest', 'harbour', 'pier',
];

const isOutdoorStop = (stop) => {
  const text = `${stop.name} ${stop.notes || ''} ${stop.category}`.toLowerCase();
  return OUTDOOR_KEYWORDS.some((kw) => text.includes(kw));
};

/**
 * Check a single day's stops against the forecast.
 * Returns the rainy day's forecast entry if a replan is needed, otherwise null.
 */
const checkDayForRain = (day, forecast) => {
  const entry = forecast.find((f) => f.date === day.date);
  if (!entry) return null;
  if (entry.precipitationProbability < RAIN_THRESHOLD) return null;

  const hasOutdoorStops = day.stops.some(isOutdoorStop);
  return hasOutdoorStops ? entry : null;
};

/**
 * Ask OpenAI to swap outdoor stops on a rainy day with indoor alternatives.
 * Returns an updated day object.
 */
const replanRainyDay = async (day, weatherEntry, trip) => {
  const outdoorStops = day.stops.filter(isOutdoorStop).map((s) => s.name);

  const systemPrompt = `You are Wayfarer, a travel planner. A day in the user's itinerary needs to be
replanned because of rain. Swap the outdoor stops for indoor alternatives in the same city.

Return a JSON object with this exact structure:
{
  "narrative": "Updated day narrative explaining the change",
  "stops": [ ...the full updated stops array, same schema as input... ],
  "budgetBreakdown": { "entranceFees": 0, "transport": 0, "meals": 0, "discretionary": 0, "total": 0, "currency": "USD" }
}

Rules:
- Keep all food and rest stops unchanged.
- Replace only the outdoor stops listed.
- Choose indoor alternatives (museums, galleries, indoor markets, theatres) in ${trip.destination.city}.
- Preserve the same time slots and transport legs where possible.
- Note the original outdoor stop in the replacement stop's notes field (e.g. "Replanned from Ueno Park due to rain").`;

  const userPrompt = `Day ${day.dayNumber} (${day.date}) needs replanning.
Weather: ${weatherEntry.summary}, ${weatherEntry.precipitationProbability}% chance of rain.

Outdoor stops to replace: ${outdoorStops.join(', ')}

Current day plan:
${JSON.stringify(day, null, 2)}`;

  const result = await getStructuredJSON(systemPrompt, userPrompt);
  return { ...day, ...result };
};

/**
 * Check all days in a plan against the latest forecast and replan any rainy days.
 * @param {object} plan   - Current Plan document.
 * @param {object} trip   - Trip document.
 * @returns {{ updatedDays: Array, replannedDates: Array }}
 */
const applyWeatherReplanning = async (plan, trip) => {
  const { city, country } = trip.destination;

  const forecast = await withCache(
    `weather:${city}:${country}`,
    () => getForecast(city, country),
    TTL.WEATHER
  );

  const updatedDays = [];
  const replannedDates = [];

  for (const day of plan.days) {
    const rainyEntry = checkDayForRain(day, forecast);

    if (rainyEntry) {
      const replanned = await replanRainyDay(day, rainyEntry, trip);
      updatedDays.push(replanned);
      replannedDates.push({ date: day.date, weather: rainyEntry.summary, precipitationProbability: rainyEntry.precipitationProbability });
    } else {
      updatedDays.push(day);
    }
  }

  return { updatedDays, replannedDates };
};

module.exports = { applyWeatherReplanning, checkDayForRain, RAIN_THRESHOLD };
