const express = require('express');
const { createTrip, getTrips, getTrip, updateTrip, deleteTrip } = require('../controllers/tripController');
const { generate, getCurrentPlan, getVersions, revertToVersion } = require('../controllers/planController');
const { sendMessage, getHistory } = require('../controllers/chatController');
const { protect } = require('../middleware/auth');
const { createTripRules, updateTripRules } = require('../middleware/validators/tripValidators');
const validate = require('../middleware/validate');

const router = express.Router();

// All trip routes require authentication
router.use(protect);

router.post('/', ...createTripRules, validate, createTrip);
router.get('/', getTrips);
router.get('/:id', getTrip);
router.patch('/:id', ...updateTripRules, validate, updateTrip);
router.delete('/:id', deleteTrip);

router.post('/:id/generate', generate);
router.get('/:id/plan', getCurrentPlan);
router.get('/:id/versions', getVersions);
router.post('/:id/revert/:versionId', revertToVersion);

router.post('/:id/chat', sendMessage);
router.get('/:id/chat', getHistory);

module.exports = router;
