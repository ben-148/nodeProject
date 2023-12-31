const express = require("express");
const router = express.Router();
const cardsServiceModel = require("../../model/cardsService/cardsService");
const normalizeCard = require("../../model/cardsService/helpers/normalizationCardService");
const cardsValidationService = require("../../validation/cardsValidationService");
const permissionsMiddleware = require("../../middleware/permissionsMiddleware");
const authmw = require("../../middleware/authMiddleware");
const Card = require("../../model/mongodb/cards/Card");
const CustomError = require("../../utils/CustomError");
const generateBizNumber = require("../../model/mongodb/cards/helpers/generateBizNumber");
const chalk = require("chalk");

// all
router.get("/", async (req, res) => {
  try {
    const allCards = await cardsServiceModel.getAllCards();
    res.json(allCards);
  } catch (err) {
    res.status(400).json(err);
  }
});

router.get("/my-cards", authmw, async (req, res) => {
  try {
    const userCards = await cardsServiceModel.getUserCards(req.userData._id);
    if (!userCards.length) {
      res.json({ msg: "No cards for this user" });
    } else {
      res.json(userCards);
    }
  } catch (err) {
    console.log(chalk.red("Failed to get user cards:"));
    console.error(err);
    res.status(400).json(err);
  }
});

// all
router.get("/:id", async (req, res) => {
  try {
    await cardsValidationService.cardIdValidation(req.params.id);
    const cardFromDB = await cardsServiceModel.getCardById(req.params.id);
    res.json(cardFromDB);
  } catch (err) {
    res.status(400).json(err);
  }
});

// biz only
router.post(
  "/",
  authmw,
  permissionsMiddleware(true, false, false),
  async (req, res) => {
    try {
      await cardsValidationService.createCardValidation(req.body);
      let normalCard = await normalizeCard(req.body, req.userData._id);
      const dataFromMongoose = await cardsServiceModel.createCard(normalCard);
      res.json(dataFromMongoose);
    } catch (err) {
      res.status(400).json(err);
    }
  }
);

router.put(
  "/:id",
  authmw,
  permissionsMiddleware(false, false, true),
  async (req, res) => {
    try {
      await cardsValidationService.cardIdValidation(req.params.id);
      await cardsValidationService.createCardValidation(req.body);
      let normalCard = await normalizeCard(req.body, req.userData._id);
      const cardFromDB = await cardsServiceModel.updateCard(
        req.params.id,
        normalCard
      );
      res.json(cardFromDB);
    } catch (err) {
      res.status(400).json(err);
    }
  }
);

router.patch("/:id", authmw, async (req, res) => {
  try {
    const cardId = req.params.id;
    const userId = req.userData._id;
    await cardsValidationService.cardIdValidation(cardId);
    const cardFromDB = await cardsServiceModel.getCardById(req.params.id);
    if (cardFromDB) {
      if (cardFromDB.likes.includes(userId)) {
        await cardsServiceModel.unLikeCard(userId, cardId);
        const UpdateLikeStatus = await cardsServiceModel.getCardById(cardId);
        res.json(UpdateLikeStatus);
      } else {
        await cardsServiceModel.likeCard(userId, cardId);
        const UpdateLikeStatus = await cardsServiceModel.getCardById(cardId);
        res.json(UpdateLikeStatus);
      }
    } else {
      throw new CustomError("did not find card");
    }
  } catch (err) {
    console.log(err);
    res.status(400).json(err);
  }
});

//Bonus! :)

router.patch(
  "/bizNum/:id",
  authmw,
  permissionsMiddleware(false, true, false, false),
  async (req, res) => {
    try {
      const cardId = req.params.id;
      await cardsValidationService.cardIdValidation(cardId);
      const cardFromDb = await cardsServiceModel.updateCard(cardId, {
        bizNumber: await generateBizNumber(),
      });
      res.json({ msg: `the new biz number is ${cardFromDb.bizNumber}` });
    } catch (err) {
      console.log(err);
      res.status(400).json(err);
    }
  }
);

// admin or biz owner
router.delete(
  "/:id",
  authmw,
  permissionsMiddleware(false, true, true),
  async (req, res) => {
    try {
      await cardsValidationService.cardIdValidation(req.params.id);
      const cardFromDB = await cardsServiceModel.deleteCard(req.params.id);
      if (cardFromDB) {
        res.json({ msg: "card deleted" });
      } else {
        res.json({ msg: "could not find the card" });
      }
    } catch (err) {
      res.status(400).json(err);
    }
  }
);

module.exports = router;
