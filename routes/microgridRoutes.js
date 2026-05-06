const express = require("express");
const {
  getAllMicrogrids,
  getMicrogridById,
} = require("../controllers/microgridController");

const router = express.Router();

router.get("/all", getAllMicrogrids);
router.get("/:id", getMicrogridById);

module.exports = router;
