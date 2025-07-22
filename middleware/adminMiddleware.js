const User = require('../models/User');

module.exports = async function(req, res, next) {
  try {
    // Get user from database to check role
    const user = await User.findById(req.user.id);
    
    if (!user) {
      return res.status(404).json({ msg: 'User not found' });
    }
    
    // Check if user is admin
    if (user.role !== 'admin') {
      return res.status(403).json({ msg: 'Access denied. Admin privileges required.' });
    }
    
    // Add user data to request object for easy access
    req.user = user;
    
    next();
  } catch (error) {
    console.error(error);
    res.status(500).json({ msg: 'Server error' });
  }
};