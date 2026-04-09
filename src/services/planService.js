const Plan = require('../models/Plan');
const Trip = require('../models/Trip');
const { getStructuredJSON } = require('./openaiService');
const { buildItineraryPrompts } = require('./promptBuilder');
const { searchPlace, getPlaceDetails, getRestaurantsAlongRoute } = require('./googlePlacesService');
const { getForecast } = require('./weatherService');
const { withCache, TTL } = require('./cacheService');

const fetchLiveData = async (trip) => {
  const { city, country } = trip.destination;

  // Fetch weather and attraction details in parallel
  const [weather, attractionDetails] = await Promise.all([
    withCache(
      `weather:${city}:${country}`,
      () => getForecast(city, country).catch(() => []),
      TTL.WEATHER
    ),
    Promise.all(
      trip.attractions.map((name) =>
        withCache(
          `place:${name}:${city}`,
          async () => {
            const found = await searchPlace(name, city);
            if (!found) return { name };
            const details = await getPlaceDetails(found.placeId);
            return details || { name };
          },
          TTL.PLACES
        ).catch(() => ({ name }))
      )
    ),
  ]);

  // Use enriched coordinates to find restaurants along the route
  const stopsWithCoords = attractionDetails.filter((a) => a.coordinates?.lat);
  const restaurants = stopsWithCoords.length > 0
    ? await withCache(
        `restaurants:${city}`,
        () => getRestaurantsAlongRoute(stopsWithCoords).catch(() => []),
        TTL.RESTAURANTS
      )
    : [];

  return { weather, attractions: attractionDetails, restaurants };
};

const generatePlan = async (tripId, userId) => {
  const trip = await Trip.findOne({ _id: tripId, user: userId });
  if (!trip) throw new Error('Trip not found');

  // Mark trip as generating
  trip.status = 'generating';
  await trip.save();

  try {
    const liveData = await fetchLiveData(trip).catch(() => ({}));
    const { systemPrompt, userPrompt } = buildItineraryPrompts(trip, liveData);
    const aiResponse = await getStructuredJSON(systemPrompt, userPrompt);

    // Calculate total budget across all days
    const totalBudget = aiResponse.days.reduce(
      (sum, day) => sum + (day.budgetBreakdown?.total || 0),
      0
    );

    // Mark any existing current plan as no longer current
    await Plan.updateMany({ trip: tripId, isCurrent: true }, { isCurrent: false });

    // Get the next version number
    const lastPlan = await Plan.findOne({ trip: tripId }).sort({ version: -1 });
    const version = lastPlan ? lastPlan.version + 1 : 1;

    const plan = await Plan.create({
      trip: tripId,
      user: userId,
      version,
      isCurrent: true,
      days: aiResponse.days,
      totalBudget,
    });

    // Mark trip as ready
    trip.status = 'ready';
    await trip.save();

    return plan;
  } catch (err) {
    trip.status = 'failed';
    await trip.save();
    throw err;
  }
};

module.exports = { generatePlan };
