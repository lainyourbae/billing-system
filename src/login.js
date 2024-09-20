const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { jwt_secret, jwt_refresh } = require('../jwt');
const dbPromise = require("../db");
const { api_key } = require("../auth");
const app = express();


app.post('/api/login', api_key, async (req, res) => {
    const {email, password} = req.body;

    if (!email || !password) {
        return res.status(400).json({ message: "Terdapat field yang kosong!" });
    }

    try {
        const query_1 = "SELECT * FROM users WHERE `email` = ?";
        const [result_1] = await dbPromise.query(query_1, [email]);
  
        if (result_1.length === 0) {
            return res.status(401).json({ message: "Invalid email." });
        }
        const user = result_1[0];
        
        if (user.status === 'inactive'){
            return res.status(400).json({ message: "Akun sudah tidak aktif." });
        }

        const password_valid = bcrypt.compareSync(password, user.password);
        if (!password_valid) {
            return res.status(401).json({ message: "Invalid password." });
        }
  
        const check_role = `SELECT roles.role 
                        FROM users 
                        JOIN roles ON users.id_role = roles.id 
                        WHERE users.id = ? `;
        const [result] = await dbPromise.query(check_role, user.id);
        const role = result[0].role;

        const token = jwt.sign({ id: user.id, role: role }, jwt_secret.secret, jwt_secret.options);
        const refresh_token = jwt.sign({ id: user.id, role: role }, jwt_refresh.secret, jwt_refresh.options);
  
        const query_3 = "UPDATE users SET `refresh_token` = ? WHERE `id` = ?";
        const result_3 = [refresh_token, user.id];
        await dbPromise.query(query_3, result_3);
  
        return res.status(200).json({ message: "Login successfully.",
                                      id: user.id,
                                      access_token: token,
                                      refresh_token: refresh_token});
    } catch (err) {
        console.error("Error:", err);
        return res.status(500).json({ message: "Internal Server Error" });
    }
})

module.exports = app;