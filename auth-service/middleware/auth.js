const jwt = require('jsonwebtoken');

const auth = async (req, res, next) => {
  try {
    const token = req.header('Authorization').replace('Bearer ', '');
    const decoded = jwt.decode(token);

    if (!decoded) {
      throw new Error('Invalid token');
    }

    // Get the 'sub' from the decoded token
    const cognitoSub = decoded.sub;
    req.user = { id: cognitoSub };  // Attach sub to the request for future use
    next();
  } catch (error) {
    res.status(401).send({ error: 'Please authenticate' });
  }
};

module.exports = auth;