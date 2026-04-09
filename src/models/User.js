const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
    },
    password: {
      type: String,
      required: [true, 'Password is required'],
      minlength: [6, 'Password must be at least 6 characters'],
    },
    preferences: {
      transportModes: {
        type: [String],
        enum: ['walk', 'transit', 'drive', 'cycle'],
        default: ['walk', 'transit'],
      },
      pace: {
        type: String,
        enum: ['relaxed', 'moderate', 'packed'],
        default: 'moderate',
      },
      weatherSensitivity: {
        type: String,
        enum: ['low', 'medium', 'high'],
        default: 'medium',
      },
      cuisinePreferences: {
        type: [String],
        default: [],
      },
    },
    pushToken: {
      type: String,
      default: null,
    },
  },
  { timestamps: true }
);

// Hash password before saving
userSchema.pre('save', async function () {
  if (!this.isModified('password')) return;
  this.password = await bcrypt.hash(this.password, 12);
});

// Compare a plain password against the stored hash
userSchema.methods.comparePassword = async function (plainPassword) {
  return bcrypt.compare(plainPassword, this.password);
};

// Never return the password field in API responses
userSchema.set('toJSON', {
  transform: (doc, ret) => {
    delete ret.password;
    return ret;
  },
});

module.exports = mongoose.model('User', userSchema);
