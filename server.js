// server.js — application entry point.
// Serves the frontend (public/) AND the JSON API from the same Express process,
// so a single Node app runs on each EC2 instance behind the load balancer.

const path = require("path");
const express = require("express");
const recipesRouter = require("./src/routes/recipes");
const { CATEGORIES } = require("./src/controllers/recipeController");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// --- Health check --------------------------------------------------------
// The ALB target group pings this. It must return 200 for the instance to be
// considered healthy and kept in rotation. Keep it dependency-free (no DB call)
// so a slow database never marks a good instance unhealthy.
app.get("/health", (req, res) => res.status(200).json({ status: "ok" }));

// --- API -----------------------------------------------------------------
app.get("/api/categories", (req, res) => res.json(CATEGORIES));
app.use("/api/recipes", recipesRouter);

// --- Frontend ------------------------------------------------------------
app.use(express.static(path.join(__dirname, "public")));

// --- Error handler -------------------------------------------------------
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: "Oops! Something went wrong on the server." });
});

app.listen(PORT, () => {
  console.log(`Recipe Box listening on port ${PORT}`);
});
