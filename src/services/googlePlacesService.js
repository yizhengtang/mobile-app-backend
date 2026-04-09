const axios = require('axios');

const BASE_URL = 'https://maps.googleapis.com/maps/api/place';

const client = axios.create({
  baseURL: BASE_URL,
  params: { key: process.env.GOOGLE_PLACES_API_KEY },
});

/**
 * Search for a place by name and city.
 * Returns the top match with its placeId and basic info.
 */
const searchPlace = async (query, city) => {
  const response = await client.get('/textsearch/json', {
    params: { query: `${query} ${city}` },
  });

  const results = response.data.results;
  if (!results || results.length === 0) return null;

  const place = results[0];
  return {
    placeId: place.place_id,
    name: place.name,
    address: place.formatted_address,
    coordinates: {
      lat: place.geometry.location.lat,
      lng: place.geometry.location.lng,
    },
    rating: place.rating || null,
    userRatingsTotal: place.user_ratings_total || 0,
  };
};

/**
 * Get full details for a place by its placeId.
 * Includes opening hours, coordinates, website, and price level.
 */
const getPlaceDetails = async (placeId) => {
  const response = await client.get('/details/json', {
    params: {
      place_id: placeId,
      fields: [
        'name',
        'formatted_address',
        'geometry',
        'opening_hours',
        'current_opening_hours',
        'website',
        'rating',
        'user_ratings_total',
        'price_level',
        'types',
      ].join(','),
    },
  });

  const place = response.data.result;
  if (!place) return null;

  return {
    placeId,
    name: place.name,
    address: place.formatted_address,
    coordinates: {
      lat: place.geometry.location.lat,
      lng: place.geometry.location.lng,
    },
    openingHours: place.opening_hours?.weekday_text || null,
    isOpenNow: place.opening_hours?.open_now ?? null,
    website: place.website || null,
    rating: place.rating || null,
    userRatingsTotal: place.user_ratings_total || 0,
    priceLevel: place.price_level ?? null,
    types: place.types || [],
  };
};

/**
 * Search for nearby restaurants along a route segment.
 * @param {number} lat  - Latitude of the centre point.
 * @param {number} lng  - Longitude of the centre point.
 * @param {number} radius - Search radius in metres (default 500).
 * @param {string} cuisine - Optional keyword (e.g. "sushi", "italian").
 */
const getNearbyRestaurants = async (lat, lng, radius = 500, cuisine = '') => {
  const response = await client.get('/nearbysearch/json', {
    params: {
      location: `${lat},${lng}`,
      radius,
      type: 'restaurant',
      keyword: cuisine || undefined,
      minprice: 1,
    },
  });

  const results = response.data.results || [];

  return results
    .filter((r) => r.rating >= 4.0)
    .slice(0, 3)
    .map((r) => ({
      placeId: r.place_id,
      name: r.name,
      address: r.vicinity,
      rating: r.rating,
      priceLevel: r.price_level ?? null,
      coordinates: {
        lat: r.geometry.location.lat,
        lng: r.geometry.location.lng,
      },
    }));
};

/**
 * Find restaurant candidates at the midpoint between each pair of consecutive stops.
 * Deduplicates results so the same restaurant isn't suggested twice.
 *
 * @param {Array}  stops   - Array of stop objects with coordinates { lat, lng }.
 * @param {string} cuisine - Optional cuisine preference from user profile.
 * @returns {Array}        - Deduplicated list of restaurant candidates.
 */
const getRestaurantsAlongRoute = async (stops, cuisine = '') => {
  const stopsWithCoords = stops.filter((s) => s.coordinates?.lat && s.coordinates?.lng);
  if (stopsWithCoords.length === 0) return [];

  const seen = new Set();
  const candidates = [];

  for (let i = 0; i < stopsWithCoords.length - 1; i++) {
    const a = stopsWithCoords[i].coordinates;
    const b = stopsWithCoords[i + 1].coordinates;

    // Midpoint between consecutive stops
    const midLat = (a.lat + b.lat) / 2;
    const midLng = (a.lng + b.lng) / 2;

    const nearby = await getNearbyRestaurants(midLat, midLng, 500, cuisine);

    for (const restaurant of nearby) {
      if (!seen.has(restaurant.placeId)) {
        seen.add(restaurant.placeId);
        candidates.push(restaurant);
      }
    }
  }

  return candidates;
};

module.exports = { searchPlace, getPlaceDetails, getNearbyRestaurants, getRestaurantsAlongRoute };
