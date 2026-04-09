const mongoose = require('mongoose');

const chatMessageSchema = new mongoose.Schema(
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
    role: {
      type: String,
      enum: ['user', 'assistant'],
      required: true,
    },
    content: {
      type: String,
      required: [true, 'Message content is required'],
      trim: true,
    },
  },
  { timestamps: true }
);

chatMessageSchema.index({ trip: 1, createdAt: 1 });

module.exports = mongoose.model('ChatMessage', chatMessageSchema);
