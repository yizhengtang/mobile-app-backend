const axios = require('axios');

const BASE_URL = 'https://api.openweathermap.org/data/3.0/onecall';
const GEO_URL = 'https://api.openweathermap.org/geo/1.0/direct';

/**
 * Convert a city name to lat/lng coordinates using OpenWeatherMap Geocoding API.
 */
const geocodeCity = async (city, country) => {
  const response = await axios.get(GEO_URL, {
    params: {
      q: `${city},${country}`,
      limit: 1,
      appid: process.env.OPENWEATHER_API_KEY,
    },
  });

  const results = response.data;
  if (!results || results.length === 0) {
    throw new Error(`Could not geocode city: ${city}, ${country}`);
  }

  return { lat: results[0].lat, lng: results[0].lon };
};

/**
 * Fetch a 7-day daily weather forecast for a city.
 * Returns one entry per day with date, summary, temperature, and rain probability.
 */
const getForecast = async (city, country) => {
  const { lat, lng } = await geocodeCity(city, country);

  const response = await axios.get(BASE_URL, {
    params: {
      lat,
      lon: lng,
      exclude: 'current,minutely,hourly,alerts',
      units: 'metric',
      appid: process.env.OPENWEATHER_API_KEY,
    },
  });

  const daily = response.data.daily;

  return daily.slice(0, 7).map((day) => ({
    date: new Date(day.dt * 1000).toISOString().split('T')[0],
    summary: day.weather[0].description,
    tempMin: Math.round(day.temp.min),
    tempMax: Math.round(day.temp.max),
    precipitationProbability: Math.round(day.pop * 100),
    willRain: day.pop >= 0.6,
    icon: day.weather[0].icon,
  }));
};

module.exports = { getForecast };
