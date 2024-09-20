const jwt = require("jsonwebtoken");

function api_key(req, res, next) {
  const api_key = req.header('x-api-key');
  
  if (!api_key) {
    return res.status(401).json({ message: 'API Key is missing' });
  }

  if (api_key === process.env.API_KEY) {
    next();
  } else {
    return res.status(403).json({ message: 'Invalid API Key' });
  }
}

function verify_token(req, res, next) {
    const auth_header = req.headers['authorization'];
    if (!auth_header) {
        return res.status(403).json({ message: 'Authorization header is required.' });
    }

    const token = auth_header.split(' ')[1];
    if (!token) {
        return res.status(403).json({ message: 'Bearer token is required.' });
    }

    jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
        if (err) {
            return res.status(401).json({ message: 'Invalid token.' });
        }

        req.user = decoded;
        next();
    });
}

const authorize = (roles) => {
  return (req, res, next) => {
    const user = req.user;

    if (!user) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    if (!roles.includes(user.role)) {
      return res.status(403).json({ message: 'Forbidden: Access is denied' });
    }

    next();
  };
};

module.exports = { api_key, verify_token, authorize };