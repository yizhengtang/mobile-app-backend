const axios = require('axios');

const BASE_URL = 'https://maps.googleapis.com/maps/api/directions/json';

const TRANSPORT_MODE_MAP = {
  walk:    'walking',
  transit: 'transit',
  drive:   'driving',
  cycle:   'bicycling',
};

/**
 * Get directions between two coordinates.
 * @param {object} origin      - { lat, lng }
 * @param {object} destination - { lat, lng }
 * @param {string} mode        - 'walk' | 'transit' | 'drive' | 'cycle'
 * @returns {object}           - { mode, durationMinutes, distanceKm, notes, legs }
 */
const getDirections = async (origin, destination, mode = 'transit') => {
  const googleMode = TRANSPORT_MODE_MAP[mode] || 'transit';

  const response = await axios.get(BASE_URL, {
    params: {
      origin:      `${origin.lat},${origin.lng}`,
      destination: `${destination.lat},${destination.lng}`,
      mode:        googleMode,
      key:         process.env.GOOGLE_PLACES_API_KEY,
    },
  });

  const data = response.data;
  if (data.status !== 'OK' || !data.routes.length) {
    return null;
  }

  const route = data.routes[0];
  const leg   = route.legs[0];

  const result = {
    mode,
    durationMinutes: Math.round(leg.duration.value / 60),
    distanceKm:      Math.round((leg.distance.value / 1000) * 10) / 10,
    notes:           `${leg.duration.text} (${leg.distance.text})`,
    legs:            [],
  };

  // For transit, extract each individual leg (walk → train → walk etc.)
  if (googleMode === 'transit') {
    result.legs = leg.steps
      .filter((step) => step.travel_mode === 'TRANSIT' || step.travel_mode === 'WALKING')
      .map((step) => {
        if (step.travel_mode === 'TRANSIT') {
          return {
            type:          'transit',
            instruction:   `Take ${step.transit_details.line.short_name || step.transit_details.line.name}`,
            line:          step.transit_details.line.name,
            departureStop: step.transit_details.departure_stop.name,
            arrivalStop:   step.transit_details.arrival_stop.name,
            durationMinutes: Math.round(step.duration.value / 60),
          };
        }
        return {
          type:            'walk',
          instruction:     step.html_instructions.replace(/<[^>]+>/g, ''),
          durationMinutes: Math.round(step.duration.value / 60),
          distanceKm:      Math.round((step.distance.value / 1000) * 10) / 10,
        };
      });
  }

  return result;
};

/**
 * Get directions for every consecutive pair of stops in a day.
 * @param {Array} stops - Array of stop objects with coordinates.
 * @param {string} mode - Preferred transport mode.
 * @returns {Array}     - Array of direction results (null if first stop).
 */
const getDirectionsForDay = async (stops, mode = 'transit') => {
  const results = [null]; // first stop has no transport from previous

  for (let i = 1; i < stops.length; i++) {
    const origin      = stops[i - 1].coordinates;
    const destination = stops[i].coordinates;

    if (!origin?.lat || !destination?.lat) {
      results.push(null);
      continue;
    }

    const directions = await getDirections(origin, destination, mode);
    results.push(directions);
  }

  return results;
};

module.exports = { getDirections, getDirectionsForDay };
