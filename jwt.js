const jwt_secret = {
    secret: process.env.JWT_SECRET,
    options: {
      expiresIn: process.env.JWT_SECRET_EXPIRE
    }
  };
  
  const jwt_refresh = {
    secret: process.env.JWT_SECRET_REFRESH,
    options: {
      expiresIn: process.env.JWT_SECRET_REFRESH_EXPIRE
    }
  };
  
  module.exports = {jwt_secret, jwt_refresh};