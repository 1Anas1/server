const jwt = require('jsonwebtoken');
const User = require('../models/User');

module.exports = (req, res, next) => {
  console.log(req.headers.authorization);
  const token = req.headers.authorization.split(' ')[1]; // Get the token from the request header

  jwt.verify(token, process.env.JWT_SECRET, (err, decodedToken) => { // Verify the token with your JWT secret
    if (err) {
      return res.status(401).json({ message: 'Invalid or expired token' });
    } else {
      const userId = decodedToken.userId;

      User.findById(userId)
        .populate('role') // Populate the role field from the user model
        .exec((err, user) => {
          if (err) {
            return res.status(500).json({ message: 'An error occurred while fetching user data' });
          } else {
            if (user.role.name === 'admin' ||user.role.name === 'professional') { 
              req.userRole  = user.role.name;
              req.userId = userId;// Check if the user has admin role
              next(); // Call the next middleware function
            } else {
              return res.status(403).json({ message: 'You do not have permission to perform this action' });
            }
          }
        });
    }
  });
};
