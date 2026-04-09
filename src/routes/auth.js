const express = require('express');
const { register, login, getMe } = require('../controllers/authController');
const { protect } = require('../middleware/auth');
const { registerRules, loginRules } = require('../middleware/validators/authValidators');
const validate = require('../middleware/validate');

const router = express.Router();

router.post('/register', ...registerRules, validate, register);
router.post('/login', ...loginRules, validate, login);
router.get('/me', protect, getMe);

module.exports = router;
