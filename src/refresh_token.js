const express = require("express");
const jwt = require("jsonwebtoken");
const { jwt_secret, jwt_refresh } = require('../jwt');
const app = express();
const dbPromise = require("../db");
const { api_key } = require("../auth");

app.post('/refresh-token', api_key, async (req, res) => {
    const { refresh_token } = req.body;
    
    if (!refresh_token) {
        return res.status(400).json({ message: "Refresh token is required." });
    }
  
    try {
        const decoded = jwt.verify(refresh_token, jwt_refresh.secret);
        const { id_role } = decoded;

        const query = "SELECT * FROM roles WHERE `id_role` = ?";
        const [result] = await dbPromise.query(query, [id_role]);
  
        if (result.length === 0) {
            return res.status(401).json({ message: "Invalid refresh token." });
        }
  
        const role = result[0];

        const newToken = jwt.sign({ id_role: role.id_role }, jwt_secret.secret, jwt_secret.options);
  
        return res.status(200).json({ message: "Token refreshed successfully.", 
                                      access_token: newToken });
    } catch (err) {
        console.error("Error:", err);
        return res.status(401).json({ message: "Invalid refresh token." });
    }
  });

  module.exports = app;