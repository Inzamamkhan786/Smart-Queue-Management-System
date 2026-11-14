export function notFound(req, res) {
  res.status(404).json({ error: 'That endpoint could not be found.' });
}

export function errorHandler(error, req, res, next) {
  if (res.headersSent) return next(error);
  console.error(error);
  if (error.code === '23505') {
    return res.status(409).json({ error: 'A record with that name already exists.' });
  }
  if (error.name === 'ZodError') {
    return res.status(400).json({ error: error.issues[0]?.message || 'Invalid input.' });
  }
  res.status(error.status || 500).json({
    error: error.status ? error.message : 'Something went wrong. Please try again.'
  });
}

export function asyncRoute(handler) {
  return (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);
}
