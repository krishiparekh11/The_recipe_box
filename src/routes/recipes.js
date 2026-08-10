// src/routes/recipes.js
const express = require("express");
const router = express.Router();
const c = require("../controllers/recipeController");

router.get("/", c.listRecipes); // get recipes with optional filters
router.get("/:id", c.getRecipe); // get one recipe by ID
router.post("/", c.createRecipe);            // add a recipe
router.put("/:id", c.updateRecipe);          // edit a recipe
router.patch("/:id/favorite", c.toggleFavorite); // toggle recipe favorite status
router.delete("/:id", c.deleteRecipe);       // delete a recipe

module.exports = router;
