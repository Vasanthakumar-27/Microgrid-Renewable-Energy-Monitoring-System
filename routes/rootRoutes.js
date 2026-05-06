const express = require("express");
const { getRootStatus } = require("../controllers/healthController");

const router = express.Router();

router.get("/", getRootStatus);

module.exports = router;
