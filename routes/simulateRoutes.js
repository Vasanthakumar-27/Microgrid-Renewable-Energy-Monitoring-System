const express = require("express");
const simulator = require("../data/simulator");

const router = express.Router();

router.get("/", (req, res) => {
	res.json(simulator.getData());
});

module.exports = router;
