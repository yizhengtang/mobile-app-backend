const express = require('express');
const { register, login, getMe, savePushToken } = require('../controllers/authController');
const { protect } = require('../middleware/auth');
const { registerRules, loginRules } = require('../middleware/validators/authValidators');
const validate = require('../middleware/validate');

const router = express.Router();

router.post('/register', ...registerRules, validate, register);
router.post('/login', ...loginRules, validate, login);
router.get('/me', protect, getMe);
router.patch('/pushtoken', protect, savePushToken);

module.exports = router;
