const mongoose = require('mongoose');

const tripSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    name: {
      type: String,
      required: [true, 'Trip name is required'],
      trim: true,
    },
    destination: {
      city: { type: String, required: [true, 'City is required'], trim: true },
      country: { type: String, required: [true, 'Country is required'], trim: true },
    },
    startDate: {
      type: Date,
      required: [true, 'Start date is required'],
    },
    endDate: {
      type: Date,
      required: [true, 'End date is required'],
    },
    pace: {
      type: String,
      enum: ['relaxed', 'moderate', 'packed'],
      default: 'moderate',
    },
    budgetPerDay: {
      type: Number,
      min: [0, 'Budget cannot be negative'],
    },
    transportModes: {
      type: [String],
      enum: ['walk', 'transit', 'drive', 'cycle'],
      default: ['walk', 'transit'],
    },
    attractions: {
      type: [String],
      default: [],
    },
    status: {
      type: String,
      enum: ['pending', 'generating', 'ready', 'failed'],
      default: 'pending',
    },
    coverEmoji: {
      type: String,
      default: '✈️',
    },
  },
  { timestamps: true }
);

tripSchema.pre('save', function (next) {
  if (this.endDate <= this.startDate) {
    return next(new Error('End date must be after start date'));
  }
  next();
});

module.exports = mongoose.model('Trip', tripSchema);
