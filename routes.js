const express = require('express');
const router = express.Router();
const login = require("./src/login");
const refresh_token = require("./src/refresh_token");
const password = require("./src/password");
const excel = require("./src/excel");
const dashboard = require("./src/dashboard");
const filter = require("./src/filter");
const am = require("./src/am");
const test = require("./src/test");

router.use("/", login);
router.use("/", refresh_token);
router.use("/", password);
router.use("/", excel);
router.use("/", dashboard);
router.use("/", filter);
router.use("/", am);
router.use("/", test);

module.exports = router;