const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Role = require('../models/Role');
const authMemberChild = (req, res, next) => {
    // Vérifie si le header Authorization est présent
    const token = req.header('Authorization');
    if (!token) {
      return res.status(401).json({ msg: 'Token missing, authorization denied' });
    }
    const extractedToken = token.split(' ')[1];

  try {
    const decoded = jwt.verify(extractedToken, process.env.JWT_SECRET);
    const userId = decoded.userId;
    const userRole = decoded.role;
    
    
    if (userRole !== 'member' && userRole !== 'member') {
      throw new Error();
    }
   Role.findOne({ name: userRole }).then((role)=>{
    User.findOne({ _id: userId, role: role._id }).then((user) => {
        if (!user) {
          return Promise.reject();
        }
        console.log(userRole)
        req.user = user;
        req.token = token;
        req.userRole = userRole;
        req.userId = userId;
        next();
      });
   });

    
  } catch (e) {
    res.status(401).send({ error: 'Please authenticate.' });
  }
};

module.exports = authMemberChild;
