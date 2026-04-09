const express = require('express');
const { createTrip, getTrips, getTrip, updateTrip, deleteTrip } = require('../controllers/tripController');
const { protect } = require('../middleware/auth');
const { createTripRules, updateTripRules } = require('../middleware/validators/tripValidators');
const validate = require('../middleware/validate');

const router = express.Router();

// All trip routes require authentication
router.use(protect);

router.post('/', createTripRules, validate, createTrip);
router.get('/', getTrips);
router.get('/:id', getTrip);
router.patch('/:id', updateTripRules, validate, updateTrip);
router.delete('/:id', deleteTrip);

module.exports = router;
