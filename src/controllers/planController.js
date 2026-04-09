const Plan = require('../models/Plan');
const { generatePlan } = require('../services/planService');

const generate = async (req, res, next) => {
  try {
    const plan = await generatePlan(req.params.id, req.user._id);
    res.status(201).json({ success: true, plan });
  } catch (err) {
    next(err);
  }
};

const getCurrentPlan = async (req, res, next) => {
  try {
    const plan = await Plan.findOne({ trip: req.params.id, isCurrent: true });
    if (!plan) {
      return res.status(404).json({ success: false, message: 'No plan found for this trip' });
    }
    res.json({ success: true, plan });
  } catch (err) {
    next(err);
  }
};

const revertToVersion = async (req, res, next) => {
  try {
    const { id: tripId, versionId } = req.params;

    const target = await Plan.findOne({ _id: versionId, trip: tripId, user: req.user._id });
    if (!target) {
      return res.status(404).json({ success: false, message: 'Version not found' });
    }

    if (target.isCurrent) {
      return res.status(400).json({ success: false, message: 'This version is already the current plan' });
    }

    // Demote current plan
    await Plan.updateMany({ trip: tripId, isCurrent: true }, { isCurrent: false });

    // Get next version number
    const lastPlan = await Plan.findOne({ trip: tripId }).sort({ version: -1 });
    const nextVersion = lastPlan.version + 1;

    // Create a new plan document as a copy of the target version
    const reverted = await Plan.create({
      trip: target.trip,
      user: target.user,
      version: nextVersion,
      isCurrent: true,
      days: target.days,
      totalBudget: target.totalBudget,
    });

    res.json({ success: true, plan: reverted });
  } catch (err) {
    next(err);
  }
};

const getVersions = async (req, res, next) => {
  try {
    const versions = await Plan.find({ trip: req.params.id, user: req.user._id })
      .sort({ version: -1 })
      .select('version isCurrent totalBudget createdAt');

    res.json({ success: true, count: versions.length, versions });
  } catch (err) {
    next(err);
  }
};

module.exports = { generate, getCurrentPlan, getVersions, revertToVersion };
