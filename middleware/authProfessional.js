const jwt = require('jsonwebtoken');

module.exports.checkProfessionalAccount = function(req, res, next) {
  // Vérifie si le header Authorization est présent dans la requête
  const token = req.header('Authorization');
  if (!token) return res.status(401).send('Access denied. No token provided.');

  try {
    // Vérifie si le token est valide
    const decoded = jwt.verify(token, process.env.JWT_PRIVATE_KEY);
    req.user = decoded;

    // Vérifie si l'utilisateur a le rôle professionnel
    if (req.user.role !== 'professional') {
      return res.status(403).send('Access denied. Only professionals allowed.');
    }

    // Passe à la requête suivante
    next();
  } catch (ex) {
    res.status(400).send('Invalid token.');
  }
};