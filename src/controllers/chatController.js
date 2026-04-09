const ChatMessage = require('../models/ChatMessage');
const Plan = require('../models/Plan');
const Trip = require('../models/Trip');
const { getStructuredJSON } = require('../services/openaiService');
const { buildChatPrompts } = require('../services/promptBuilder');

// Keep last 10 exchanges (20 messages) as context to avoid hitting token limits
const HISTORY_LIMIT = 20;

const sendMessage = async (req, res, next) => {
  try {
    const { message } = req.body;
    if (!message || !message.trim()) {
      return res.status(400).json({ success: false, message: 'Message is required' });
    }

    const tripId = req.params.id;

    // Verify trip belongs to user
    const trip = await Trip.findOne({ _id: tripId, user: req.user._id });
    if (!trip) {
      return res.status(404).json({ success: false, message: 'Trip not found' });
    }

    // Get current plan
    const currentPlan = await Plan.findOne({ trip: tripId, isCurrent: true });
    if (!currentPlan) {
      return res.status(404).json({ success: false, message: 'No plan found — generate a plan first' });
    }

    // Fetch recent chat history for context
    const history = await ChatMessage.find({ trip: tripId })
      .sort({ createdAt: -1 })
      .limit(HISTORY_LIMIT);
    history.reverse();

    // Build prompts and call OpenAI
    const { systemPrompt, messages } = buildChatPrompts(currentPlan, history, message.trim());
    const aiResponse = await getStructuredJSON(systemPrompt, messages);

    // Save user message
    await ChatMessage.create({ trip: tripId, user: req.user._id, role: 'user', content: message.trim() });

    // Save assistant reply
    await ChatMessage.create({ trip: tripId, user: req.user._id, role: 'assistant', content: aiResponse.summary });

    // Demote current plan and create new version
    await Plan.updateMany({ trip: tripId, isCurrent: true }, { isCurrent: false });

    const lastPlan = await Plan.findOne({ trip: tripId }).sort({ version: -1 });
    const totalBudget = aiResponse.days.reduce(
      (sum, day) => sum + (day.budgetBreakdown?.total || 0), 0
    );

    const updatedPlan = await Plan.create({
      trip: tripId,
      user: req.user._id,
      version: lastPlan.version + 1,
      isCurrent: true,
      days: aiResponse.days,
      totalBudget,
    });

    res.json({
      success: true,
      reply: aiResponse.summary,
      plan: updatedPlan,
    });
  } catch (err) {
    next(err);
  }
};

const getHistory = async (req, res, next) => {
  try {
    const trip = await Trip.findOne({ _id: req.params.id, user: req.user._id });
    if (!trip) {
      return res.status(404).json({ success: false, message: 'Trip not found' });
    }

    const messages = await ChatMessage.find({ trip: req.params.id })
      .sort({ createdAt: 1 })
      .select('role content createdAt');

    res.json({ success: true, count: messages.length, messages });
  } catch (err) {
    next(err);
  }
};

module.exports = { sendMessage, getHistory };
