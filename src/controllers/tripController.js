const Trip = require('../models/Trip');

const createTrip = async (req, res, next) => {
  try {
    const { name, destination, startDate, endDate, pace, budgetPerDay, transportModes, attractions, coverEmoji } = req.body;

    const trip = await Trip.create({
      user: req.user._id,
      name,
      destination,
      startDate,
      endDate,
      pace,
      budgetPerDay,
      transportModes,
      attractions,
      coverEmoji,
      status: 'pending',
    });

    res.status(201).json({ success: true, trip });
  } catch (err) {
    next(err);
  }
};

const getTrip = async (req, res, next) => {
  try {
    const trip = await Trip.findOne({ _id: req.params.id, user: req.user._id });
    if (!trip) {
      return res.status(404).json({ success: false, message: 'Trip not found' });
    }
    res.json({ success: true, trip });
  } catch (err) {
    next(err);
  }
};

const getTrips = async (req, res, next) => {
  try {
    const trips = await Trip.find({ user: req.user._id }).sort({ createdAt: -1 });
    res.json({ success: true, count: trips.length, trips });
  } catch (err) {
    next(err);
  }
};

const updateTrip = async (req, res, next) => {
  try {
    const allowed = ['name', 'destination', 'startDate', 'endDate', 'pace', 'budgetPerDay', 'transportModes', 'attractions', 'coverEmoji'];
    const updates = Object.fromEntries(
      Object.entries(req.body).filter(([key]) => allowed.includes(key))
    );

    const trip = await Trip.findOneAndUpdate(
      { _id: req.params.id, user: req.user._id },
      updates,
      { new: true, runValidators: true }
    );

    if (!trip) {
      return res.status(404).json({ success: false, message: 'Trip not found' });
    }

    res.json({ success: true, trip });
  } catch (err) {
    next(err);
  }
};

const deleteTrip = async (req, res, next) => {
  try {
    const trip = await Trip.findOneAndDelete({ _id: req.params.id, user: req.user._id });

    if (!trip) {
      return res.status(404).json({ success: false, message: 'Trip not found' });
    }

    res.json({ success: true, message: 'Trip deleted' });
  } catch (err) {
    next(err);
  }
};

module.exports = { createTrip, getTrip, getTrips, updateTrip, deleteTrip };
