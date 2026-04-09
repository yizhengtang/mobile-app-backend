const { Expo } = require('expo-server-sdk');

const expo = new Expo();

/**
 * Send a push notification to a single Expo push token.
 * @param {string} pushToken - The user's Expo push token.
 * @param {string} title     - Notification title.
 * @param {string} body      - Notification body text.
 * @param {object} data      - Optional payload (e.g. { tripId }).
 */
const sendPushNotification = async (pushToken, title, body, data = {}) => {
  if (!Expo.isExpoPushToken(pushToken)) {
    console.warn(`[Notifications] Invalid push token: ${pushToken}`);
    return;
  }

  const message = {
    to:    pushToken,
    sound: 'default',
    title,
    body,
    data,
  };

  const chunks = expo.chunkPushNotifications([message]);

  for (const chunk of chunks) {
    const receipts = await expo.sendPushNotificationsAsync(chunk);
    for (const receipt of receipts) {
      if (receipt.status === 'error') {
        console.error('[Notifications] Delivery error:', receipt.message, receipt.details);
      }
    }
  }
};

/**
 * Send a morning disruption notification to a user.
 * @param {string} pushToken     - The user's Expo push token.
 * @param {string} tripName      - Name of the trip.
 * @param {Array}  replannedDates - Array of { date, precipitationProbability }.
 */
const sendDisruptionNotification = async (pushToken, tripName, replannedDates) => {
  if (!pushToken) return;

  const dateList = replannedDates.map((d) => d.date).join(', ');
  await sendPushNotification(
    pushToken,
    `${tripName} — Plan Updated`,
    `Rain forecast on ${dateList}. We've swapped outdoor stops for indoor alternatives.`,
    { type: 'disruption', dates: replannedDates }
  );
};

module.exports = { sendPushNotification, sendDisruptionNotification };
