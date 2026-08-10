// src/controllers/recipeController.js
// All recipe business logic lives here. Routes stay thin; this file talks to DynamoDB.

const crypto = require("crypto");
const {
  PutCommand,
  GetCommand,
  ScanCommand,
  DeleteCommand,
  UpdateCommand,
} = require("@aws-sdk/lib-dynamodb");
const { ddbDoc, TABLE_NAME } = require("../config/dynamo");

const CATEGORIES = [
  "Breakfast",
  "Lunch",
  "Dinner",
  "Dessert",
  "Meal Prep",
  "Snack",
  "Drink",
  "Other",
];

// Turn a stored item into the shape the frontend expects.
function normalize(item) {
  if (!item) return null;
  return {
    recipeId: item.recipeId,
    name: item.name || "",
    category: item.category || "Other",
    ingredients: item.ingredients || "",
    instructions: item.instructions || "",
    sourceUrl: item.sourceUrl || "",
    favorite: Boolean(item.favorite),
    createdAt: item.createdAt || null,
  };
}

// GET /api/recipes  (?q= &category= &favorites=true)
// Scan is used because this is a personal-scale collection. For a large table you
// would add a Global Secondary Index on category and query it instead.
async function listRecipes(req, res, next) {
  try {
    const { q, category, favorites } = req.query;

    const { Items = [] } = await ddbDoc.send(
      new ScanCommand({ TableName: TABLE_NAME })
    );

    let recipes = Items.map(normalize);

    if (category && category !== "All") {
      recipes = recipes.filter((r) => r.category === category);
    }
    if (favorites === "true") {
      recipes = recipes.filter((r) => r.favorite);
    }
    if (q && q.trim()) {
      const needle = q.trim().toLowerCase();
      recipes = recipes.filter((r) => r.name.toLowerCase().includes(needle));
    }

    // Sort recipes from newest to oldest.
    recipes.sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));

    res.json(recipes);
  } catch (err) {
    next(err);
  }
}

// GET /api/recipes/:id
async function getRecipe(req, res, next) {
  try {
    const { Item } = await ddbDoc.send(
      new GetCommand({
        TableName: TABLE_NAME,
        Key: { recipeId: req.params.id },
      })
    );

    if (!Item) return res.status(404).json({ error: "Recipe not found" });

    res.json(normalize(Item));
  } catch (error) {
    next(error);
  }
}

// POST /api/recipes
async function createRecipe(req, res, next) {
  try {
    const { name, category, ingredients, instructions, sourceUrl } = req.body || {};

    if (!name || !name.trim()) {
      return res.status(400).json({ error: "A recipe name is required." });
    }

    const recipe = {
      recipeId: crypto.randomUUID(),
      name: name.trim(),
      category: CATEGORIES.includes(category) ? category : "Other",
      ingredients: (ingredients || "").trim(),
      instructions: (instructions || "").trim(),
      sourceUrl: (sourceUrl || "").trim(),
      favorite: false,
      createdAt: new Date().toISOString(),
    };

    await ddbDoc.send(
      new PutCommand({ TableName: TABLE_NAME, Item: recipe })
    );

    res.status(201).json(recipe);
  } catch (err) {
    next(err);
  }
}

// PUT /api/recipes/:id  (edit an existing recipe)
async function updateRecipe(req, res, next) {
  try {
    const { name, category, ingredients, instructions, sourceUrl } = req.body || {};

    if (!name || !name.trim()) {
      return res.status(400).json({ error: "A recipe name is required." });
    }

    const { Item } = await ddbDoc.send(
      new GetCommand({
        TableName: TABLE_NAME,
        Key: { recipeId: req.params.id },
      })
    );
    if (!Item) return res.status(404).json({ error: "Recipe not found" });

    const updated = {
      ...normalize(Item),
      name: name.trim(),
      category: CATEGORIES.includes(category) ? category : "Other",
      ingredients: (ingredients || "").trim(),
      instructions: (instructions || "").trim(),
      sourceUrl: (sourceUrl || "").trim(),
    };

    await ddbDoc.send(
      new PutCommand({ TableName: TABLE_NAME, Item: updated })
    );

    res.json(updated);
  } catch (err) {
    next(err);
  }
}

// PATCH /api/recipes/:id/favorite  (toggle favorite on/off)
async function toggleFavorite(req, res, next) {
  try {
    const { Item } = await ddbDoc.send(
      new GetCommand({
        TableName: TABLE_NAME,
        Key: { recipeId: req.params.id },
      })
    );

    if (!Item) return res.status(404).json({ error: "Recipe not found" });

    const nextFavorite = !Boolean(Item.favorite);

    const { Attributes } = await ddbDoc.send(
      new UpdateCommand({
        TableName: TABLE_NAME,
        Key: { recipeId: req.params.id },
        UpdateExpression: "SET favorite = :f",
        ExpressionAttributeValues: { ":f": nextFavorite },
        ReturnValues: "ALL_NEW",
      })
    );

    res.json(normalize(Attributes));
  } catch (err) {
    next(err);
  }
}

// DELETE /api/recipes/:id
async function deleteRecipe(req, res, next) {
  try {
    await ddbDoc.send(
      new DeleteCommand({
        TableName: TABLE_NAME,
        Key: { recipeId: req.params.id },
      })
    );
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}

module.exports = {
  CATEGORIES,
  listRecipes,
  getRecipe,
  createRecipe,
  updateRecipe,
  toggleFavorite,
  deleteRecipe,
};
