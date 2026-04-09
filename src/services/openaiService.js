const OpenAI = require('openai');

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 1000;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Send a chat completion request to OpenAI and return parsed JSON.
 *
 * @param {string} systemPrompt - Instructions that define the AI's role and output format.
 * @param {string} userPrompt   - The actual request content (trip details, user message, etc.).
 * @param {string} model        - OpenAI model to use (default: gpt-4o-mini).
 * @returns {object}            - Parsed JSON object from the AI response.
 */
const getStructuredJSON = async (systemPrompt, userPrompt, model = 'gpt-4o-mini') => {
  let lastError;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const response = await client.chat.completions.create({
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user',   content: userPrompt },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.7,
      });

      const content = response.choices[0].message.content;
      return JSON.parse(content);
    } catch (err) {
      lastError = err;

      const isRetryable =
        err.status === 429 ||  // rate limited
        err.status === 500 ||  // OpenAI server error
        err.status === 503;    // service unavailable

      if (!isRetryable || attempt === MAX_RETRIES) break;

      const delay = RETRY_DELAY_MS * attempt;
      console.warn(`OpenAI attempt ${attempt} failed (${err.message}). Retrying in ${delay}ms...`);
      await sleep(delay);
    }
  }

  throw new Error(`OpenAI request failed after ${MAX_RETRIES} attempts: ${lastError.message}`);
};

module.exports = { getStructuredJSON };
