const express = require('express');
const { protect } = require('../middleware/auth');
const User = require('../models/User');

const router = express.Router();

router.use(protect);

// Save or update the user's Expo push token
router.post('/push-token', async (req, res, next) => {
  try {
    const { pushToken } = req.body;
    if (!pushToken) {
      return res.status(400).json({ success: false, message: 'pushToken is required' });
    }

    await User.findByIdAndUpdate(req.user._id, { pushToken });
    res.json({ success: true, message: 'Push token saved' });
  } catch (err) {
    next(err);
  }
});

// Remove push token (user disabled notifications)
router.delete('/push-token', async (req, res, next) => {
  try {
    await User.findByIdAndUpdate(req.user._id, { pushToken: null });
    res.json({ success: true, message: 'Push token removed' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
