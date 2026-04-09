const errorHandler = (err, req, res, next) => {
  let status = err.status || err.statusCode || 500;
  let message = err.message || 'Internal Server Error';

  // Mongoose: document not found
  if (err.name === 'CastError') {
    status = 404;
    message = `Resource not found`;
  }

  // Mongoose: duplicate unique field (e.g. email already exists)
  if (err.code === 11000) {
    status = 409;
    const field = Object.keys(err.keyValue)[0];
    message = `${field.charAt(0).toUpperCase() + field.slice(1)} already in use`;
  }

  // Mongoose: schema validation failed
  if (err.name === 'ValidationError') {
    status = 400;
    message = Object.values(err.errors)
      .map((e) => e.message)
      .join(', ');
  }

  // JWT: token is invalid or expired
  if (err.name === 'JsonWebTokenError') {
    status = 401;
    message = 'Invalid token';
  }
  if (err.name === 'TokenExpiredError') {
    status = 401;
    message = 'Token expired, please log in again';
  }

  if (process.env.NODE_ENV === 'development') {
    console.error(err.stack);
  }

  res.status(status).json({ success: false, message });
};

module.exports = errorHandler;
