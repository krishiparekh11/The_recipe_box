// src/routes/recipes.js
const express = require("express");
const router = express.Router();
const c = require("../controllers/recipeController");

router.get("/", c.listRecipes);              // list + search + category + favorites filters
router.get("/:id", c.getRecipe);             // recipe details
//router.post("/", c.createRecipe);            // add a recipe 
router.put("/:id", c.updateRecipe);          // edit a recipe
router.patch("/:id/favorite", c.toggleFavorite); // favorite / unfavorite
//router.delete("/:id", c.deleteRecipe);       // delete a recipe

module.exports = router;
