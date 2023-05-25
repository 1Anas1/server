const jwt = require('jsonwebtoken');

module.exports.checkProfessionalAccount = function(req, res, next) {
  // Vérifie si le header Authorization est présent dans la requête
  
  const token = req.header('Authorization');
  if (!token) return res.status(401).send('Access denied. No token provided.');
  console.log(token)
  try {
    // Vérifie si le token est valide
    const extractedToken = token.split(' ')[1];
    const decoded = jwt.verify(extractedToken, process.env.JWT_SECRET);
    const userId = decoded.userId;
    const userRole = decoded.role;
    req.userRole=userRole;
    console.log(userRole)
    // Vérifie si l'utilisateur a le rôle professionnel
    if (userRole !== 'admin' ) {
      return res.status(403).send('Access denied. Only professionals allowed.');
    }

    // Passe à la requête suivante
    next();
  } catch (ex) {
    res.status(400).send('Invalid token.');
  }
};