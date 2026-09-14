const { isAuthenticated } = require('./_lib/auth');

module.exports = async function handler(req, res) {
  res.status(200).json({ authenticated: isAuthenticated(req) });
};
