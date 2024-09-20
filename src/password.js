const express = require("express");
const bcrypt = require("bcryptjs");
const { api_key, verify_token } = require("../auth")
const dbPromise = require("../db");
const app = express();

app.post('/api/change_password', api_key, verify_token, async (req, res) => {
    const id_user = req.user.id;

    if (!id_user) {
        return res.status(400).json({ message: "Diperlukan login untuk mengakses laman ini" });
    }

    const { password, repeat_password } = req.body;

    if (!password || !repeat_password) {
        return res.status(400).json({ message: "Terdapat field yang kosong!" });
    }

    if (password != repeat_password) {
        return res.status(400).json({ message: "Password dan Repeat Password tidak cocok!" });
    }

    try{
        const hashed_password = bcrypt.hashSync(password, 12);
        const query_1 = "UPDATE users SET password = ? WHERE `id` = ?";
        await dbPromise.query(query_1, [hashed_password, id_user]);

        return res.status(201).json({message: "Berhasil mengubah password."})
    } catch (err){
        console.error("Error:", err);
        return res.status(401).json({ message: "Invalid Server Error." });
    }
})

module.exports = app;