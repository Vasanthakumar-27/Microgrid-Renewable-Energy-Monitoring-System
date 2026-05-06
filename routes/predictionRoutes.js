const express = require("express");
const { getPrediction } = require("../controllers/predictionController");

const router = express.Router();

router.get("/prediction", getPrediction);

module.exports = router;
