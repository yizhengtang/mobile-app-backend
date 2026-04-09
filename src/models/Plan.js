const mongoose = require('mongoose');

const transportLegSchema = new mongoose.Schema(
  {
    mode: { type: String, enum: ['walk', 'transit', 'drive', 'cycle'] },
    durationMinutes: Number,
    distanceKm: Number,
    notes: String,
  },
  { _id: false }
);

const stopSchema = new mongoose.Schema(
  {
    id: { type: String, required: true },
    name: { type: String, required: true },
    category: {
      type: String,
      enum: ['culture', 'food', 'nature', 'shopping', 'transit'],
      required: true,
    },
    stopType: {
      type: String,
      enum: ['user_requested', 'meal', 'rest', 'ai_suggested'],
      required: true,
    },
    isOptional: { type: Boolean, default: false },
    arrivalTime: String,
    departureTime: String,
    durationMinutes: Number,
    notes: String,
    coordinates: {
      lat: Number,
      lng: Number,
    },
    transportFromPrevious: { type: transportLegSchema, default: null },
  },
  { _id: false }
);

const budgetBreakdownSchema = new mongoose.Schema(
  {
    entranceFees: { type: Number, default: 0 },
    transport: { type: Number, default: 0 },
    meals: { type: Number, default: 0 },
    discretionary: { type: Number, default: 0 },
    total: { type: Number, default: 0 },
    currency: { type: String, default: 'USD' },
  },
  { _id: false }
);

const daySchema = new mongoose.Schema(
  {
    date: { type: String, required: true },
    dayNumber: { type: Number, required: true },
    narrative: String,
    stops: [stopSchema],
    budgetBreakdown: budgetBreakdownSchema,
  },
  { _id: false }
);

const planSchema = new mongoose.Schema(
  {
    trip: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Trip',
      required: true,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    version: {
      type: Number,
      default: 1,
    },
    isCurrent: {
      type: Boolean,
      default: true,
    },
    days: [daySchema],
    totalBudget: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true }
);

// Only one plan per trip can be current at a time
planSchema.index({ trip: 1, isCurrent: 1 });

module.exports = mongoose.model('Plan', planSchema);
