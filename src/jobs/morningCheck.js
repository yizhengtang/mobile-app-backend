const cron = require('node-cron');
const Trip = require('../models/Trip');
const Plan = require('../models/Plan');
const User = require('../models/User');
const { applyWeatherReplanning } = require('../services/weatherReplanService');
const { calculatePlanBudget } = require('../services/budgetService');
const { sendDisruptionNotification } = require('../services/notificationService');

/**
 * Find all trips that have today as an active travel day.
 */
const getActiveTripsForToday = async () => {
  const today = new Date().toISOString().split('T')[0];

  return Trip.find({
    status: 'ready',
    startDate: { $lte: new Date(today) },
    endDate:   { $gte: new Date(today) },
  });
};

/**
 * Run the disruption check for a single trip.
 * Returns a summary of what changed, or null if nothing changed.
 */
const checkTrip = async (trip) => {
  const currentPlan = await Plan.findOne({ trip: trip._id, isCurrent: true });
  if (!currentPlan) return null;

  const { updatedDays, replannedDates } = await applyWeatherReplanning(currentPlan, trip);

  // Nothing changed — no replan needed
  if (replannedDates.length === 0) return null;

  // Recalculate budget for updated days
  const { days: enrichedDays, totalBudget } = calculatePlanBudget(
    updatedDays,
    { budgetPerDay: trip.budgetPerDay }
  );

  // Demote current plan and save new version
  await Plan.updateMany({ trip: trip._id, isCurrent: true }, { isCurrent: false });

  const lastPlan = await Plan.findOne({ trip: trip._id }).sort({ version: -1 });

  await Plan.create({
    trip:        trip._id,
    user:        trip.user,
    version:     lastPlan.version + 1,
    isCurrent:   true,
    days:        enrichedDays,
    totalBudget,
  });

  // Send push notification to user
  const user = await User.findById(trip.user).select('pushToken');
  if (user?.pushToken) {
    await sendDisruptionNotification(user.pushToken, trip.name, replannedDates).catch(console.error);
  }

  return {
    tripId:          trip._id,
    tripName:        trip.name,
    replannedDates,
  };
};

/**
 * Run the full morning disruption check across all active trips.
 */
const runMorningCheck = async () => {
  console.log('[MorningCheck] Starting disruption check...');

  const trips = await getActiveTripsForToday();
  console.log(`[MorningCheck] Found ${trips.length} active trip(s) for today`);

  const results = await Promise.allSettled(trips.map(checkTrip));

  for (const result of results) {
    if (result.status === 'rejected') {
      console.error('[MorningCheck] Error processing trip:', result.reason);
      continue;
    }
    if (result.value) {
      const { tripName, replannedDates } = result.value;
      const summary = replannedDates.map(
        (d) => `${d.date} (${d.precipitationProbability}% rain)`
      ).join(', ');
      console.log(`[MorningCheck] Replanned "${tripName}" for: ${summary}`);
    }
  }

  console.log('[MorningCheck] Done.');
};

/**
 * Register the cron job. Called once at server startup.
 */
const scheduleMorningCheck = () => {
  // Runs every day at 07:00 server time
  cron.schedule('0 7 * * *', () => {
    runMorningCheck().catch((err) =>
      console.error('[MorningCheck] Unhandled error:', err)
    );
  });

  console.log('[MorningCheck] Scheduled for 07:00 daily');
};

module.exports = { scheduleMorningCheck, runMorningCheck };
