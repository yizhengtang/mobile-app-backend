/**
 * Builds the system and user prompts for itinerary generation.
 * @param {object} trip - Trip document from MongoDB.
 * @returns {{ systemPrompt: string, userPrompt: string }}
 */
const buildItineraryPrompts = (trip) => {
  const systemPrompt = `You are Wayfarer, an expert travel planner. Your job is to generate a detailed,
day-by-day travel itinerary based on the trip details provided by the user.

You MUST respond with a valid JSON object matching this exact structure:
{
  "days": [
    {
      "date": "YYYY-MM-DD",
      "dayNumber": 1,
      "narrative": "A short 1-2 sentence introduction for the day",
      "stops": [
        {
          "id": "unique string e.g. d1s1",
          "name": "Place name",
          "category": "culture | food | nature | shopping | transit",
          "stopType": "user_requested | meal | rest",
          "isOptional": false,
          "arrivalTime": "HH:MM",
          "departureTime": "HH:MM",
          "durationMinutes": 90,
          "notes": "Helpful tip about this stop",
          "coordinates": { "lat": 0.0, "lng": 0.0 },
          "transportFromPrevious": {
            "mode": "walk | transit | drive | cycle",
            "durationMinutes": 10,
            "distanceKm": 0.8,
            "notes": "Brief transport instruction"
          }
        }
      ],
      "budgetBreakdown": {
        "entranceFees": 0,
        "transport": 0,
        "meals": 0,
        "discretionary": 0,
        "total": 0,
        "currency": "USD"
      }
    }
  ]
}

Rules you MUST follow:
- Set transportFromPrevious to null for the first stop of each day.
- Insert meal stops (breakfast, lunch, dinner) at logical times.
- Insert a rest stop after every 3 consecutive non-food stops.
- Sequence stops to minimise travel time between them.
- Respect the user's pace: relaxed (fewer stops, longer visits), moderate (balanced), packed (maximum stops).
- Keep the daily total cost within the user's budgetPerDay if provided.
- Use the user's preferred transport modes when suggesting transport between stops.`;

  const numDays = Math.round(
    (new Date(trip.endDate) - new Date(trip.startDate)) / (1000 * 60 * 60 * 24)
  ) + 1;

  const attractionsList = trip.attractions.length > 0
    ? trip.attractions.map((a, i) => `  ${i + 1}. ${a}`).join('\n')
    : '  (No specific attractions listed — suggest popular highlights for the destination)';

  const userPrompt = `Please generate a ${numDays}-day itinerary for the following trip:

Destination: ${trip.destination.city}, ${trip.destination.country}
Dates: ${trip.startDate.toISOString().split('T')[0]} to ${trip.endDate.toISOString().split('T')[0]}
Pace: ${trip.pace}
Daily budget: ${trip.budgetPerDay ? `USD ${trip.budgetPerDay}` : 'Not specified'}
Preferred transport: ${trip.transportModes.join(', ')}

Attractions to include:
${attractionsList}`;

  return { systemPrompt, userPrompt };
};

/**
 * Builds the system and user prompts for conversational plan refinement.
 * @param {object} plan        - Current Plan document.
 * @param {Array}  history     - Prior ChatMessage documents for this trip.
 * @param {string} userMessage - The new message from the user.
 * @returns {{ systemPrompt: string, messages: Array }}
 */
const buildChatPrompts = (plan, history, userMessage) => {
  const systemPrompt = `You are Wayfarer, an expert travel planner. The user has an existing travel itinerary
and wants to make changes to it through conversation.

When the user requests a change, you MUST respond with a JSON object in this exact structure:
{
  "summary": "One sentence describing what you changed",
  "days": [ ...the full updated days array using the same schema as the original plan... ]
}

Rules:
- Return the COMPLETE days array, not just the changed days.
- Preserve all stops that were not affected by the change.
- Keep the same JSON schema as the original plan (same fields on each stop and day).
- If the request is unclear, make a reasonable interpretation and explain it in the summary.

Current itinerary:
${JSON.stringify(plan.days, null, 2)}`;

  // Build messages array from history + new user message
  const messages = [
    ...history.map((msg) => ({ role: msg.role, content: msg.content })),
    { role: 'user', content: userMessage },
  ];

  return { systemPrompt, messages };
};

module.exports = { buildItineraryPrompts, buildChatPrompts };
