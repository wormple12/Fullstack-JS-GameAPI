import express from "express";
import gameFacade from "../facades/gameFacade";
const router = express.Router();
import { ApiError } from "../errors/apiError";

//import * as mongo from "mongodb"
import setup from "../config/setupDB";
import UserFacade from "../facades/userFacadeWithDB";

(async function setupDB() {
  const client = await setup();
  gameFacade.setDatabase(client);
})();

router.post("/nearbyplayers", async function(req, res, next) {
  try {
    const { userName, password, lat, lon, distance } = req.body;
    const players = await gameFacade.nearbyPlayers(
      userName,
      password,
      lon,
      lat,
      distance
    );
    res.json(players);
  } catch (err) {
    next(err);
  }
});

router.post("/getPostIfReached", async function(req, res, next) {
  try {
    const { postId, lat, lon } = req.body;
    const post = await gameFacade.getPostIfReached(postId, lat, lon);
    res.json(post);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
