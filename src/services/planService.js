const Plan = require('../models/Plan');
const Trip = require('../models/Trip');
const User = require('../models/User');
const { getStructuredJSON } = require('./openaiService');
const { buildItineraryPrompts, buildSurpriseMePrompts } = require('./promptBuilder');
const { searchPlace, getPlaceDetails, getRestaurantsAlongRoute } = require('./googlePlacesService');
const { getForecast } = require('./weatherService');
const { withCache, TTL } = require('./cacheService');
const { calculatePlanBudget } = require('./budgetService');
const { sendPushNotification } = require('./notificationService');

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
    const numDays = Math.round(
      (new Date(trip.endDate) - new Date(trip.startDate)) / (1000 * 60 * 60 * 24)
    ) + 1;

    // Run live data fetch and Surprise Me pre-planning in parallel
    const [liveData, surpriseSuggestions] = await Promise.all([
      fetchLiveData(trip).catch(() => ({})),
      trip.surpriseMe
        ? getStructuredJSON(...Object.values(buildSurpriseMePrompts(trip, numDays)))
            .then((r) => r.suggestions || [])
            .catch(() => [])
        : Promise.resolve([]),
    ]);

    const { systemPrompt, userPrompt } = buildItineraryPrompts(trip, liveData, surpriseSuggestions);
    const aiResponse = await getStructuredJSON(systemPrompt, userPrompt);

    // Recalculate budget from actual stop data (overrides AI estimates)
    const { days: enrichedDays, totalBudget } = calculatePlanBudget(
      aiResponse.days,
      { budgetPerDay: trip.budgetPerDay, currency: 'USD' }
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
      days: enrichedDays,
      totalBudget,
    });

    // Mark trip as ready
    trip.status = 'ready';
    await trip.save();

    const user = await User.findById(userId).select('pushToken');
    if (user?.pushToken) {
      await sendPushNotification(
        user.pushToken,
        'Your itinerary is ready!',
        `Your trip to ${trip.destination.city} is all planned out. Tap to explore.`,
        { tripId: tripId.toString() }
      );
    }

    return plan;
  } catch (err) {
    trip.status = 'failed';
    await trip.save();
    throw err;
  }
};

module.exports = { generatePlan };
