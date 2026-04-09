const { body } = require('express-validator');

const createTripRules = [
  body('name').trim().notEmpty().withMessage('Trip name is required'),
  body('destination.city').trim().notEmpty().withMessage('City is required'),
  body('destination.country').trim().notEmpty().withMessage('Country is required'),
  body('startDate').isISO8601().withMessage('Start date must be a valid date (YYYY-MM-DD)'),
  body('endDate')
    .isISO8601().withMessage('End date must be a valid date (YYYY-MM-DD)')
    .custom((endDate, { req }) => {
      if (new Date(endDate) <= new Date(req.body.startDate)) {
        throw new Error('End date must be after start date');
      }
      return true;
    }),
  body('pace')
    .optional()
    .isIn(['relaxed', 'moderate', 'packed']).withMessage('Pace must be relaxed, moderate, or packed'),
  body('budgetPerDay')
    .optional()
    .isFloat({ min: 0 }).withMessage('Budget per day must be a positive number'),
  body('transportModes')
    .optional()
    .isArray().withMessage('Transport modes must be an array')
    .custom((modes) => {
      const valid = ['walk', 'transit', 'drive', 'cycle'];
      if (!modes.every((m) => valid.includes(m))) {
        throw new Error('Transport modes must be: walk, transit, drive, or cycle');
      }
      return true;
    }),
  body('attractions')
    .optional()
    .isArray().withMessage('Attractions must be an array of strings'),
  body('surpriseMe')
    .optional()
    .isBoolean().withMessage('surpriseMe must be true or false'),
];

const updateTripRules = [
  body('name').optional().trim().notEmpty().withMessage('Trip name cannot be empty'),
  body('destination.city').optional().trim().notEmpty().withMessage('City cannot be empty'),
  body('destination.country').optional().trim().notEmpty().withMessage('Country cannot be empty'),
  body('startDate').optional().isISO8601().withMessage('Start date must be a valid date (YYYY-MM-DD)'),
  body('endDate')
    .optional()
    .isISO8601().withMessage('End date must be a valid date (YYYY-MM-DD)')
    .custom((endDate, { req }) => {
      if (req.body.startDate && new Date(endDate) <= new Date(req.body.startDate)) {
        throw new Error('End date must be after start date');
      }
      return true;
    }),
  body('pace')
    .optional()
    .isIn(['relaxed', 'moderate', 'packed']).withMessage('Pace must be relaxed, moderate, or packed'),
  body('budgetPerDay')
    .optional()
    .isFloat({ min: 0 }).withMessage('Budget per day must be a positive number'),
  body('transportModes')
    .optional()
    .isArray().withMessage('Transport modes must be an array')
    .custom((modes) => {
      const valid = ['walk', 'transit', 'drive', 'cycle'];
      if (!modes.every((m) => valid.includes(m))) {
        throw new Error('Transport modes must be: walk, transit, drive, or cycle');
      }
      return true;
    }),
  body('attractions')
    .optional()
    .isArray().withMessage('Attractions must be an array of strings'),
  body('coverEmoji').optional().trim().notEmpty().withMessage('Cover emoji cannot be empty'),
  body('surpriseMe').optional().isBoolean().withMessage('surpriseMe must be true or false'),
];

module.exports = { createTripRules, updateTripRules };
