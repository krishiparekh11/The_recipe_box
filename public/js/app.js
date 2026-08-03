// public/js/app.js — Recipe Box frontend logic (vanilla JS, no build step).

const HEART_SVG =
  '<svg viewBox="0 0 24 24" aria-hidden="true"><path class="heart" d="M12 21s-7.5-4.7-10-9.3C.4 8.5 2 5 5.3 5c2 0 3.4 1.2 4.2 2.4C10.3 6.2 11.7 5 13.7 5 17 5 18.6 8.5 17 11.7 14.5 16.3 12 21 12 21z"/></svg>';

const state = {
  category: "All",
  favoritesOnly: false,
  query: "",
  categories: [],
};

const $ = (sel) => document.querySelector(sel);
const board = $("#board");
const emptyEl = $("#empty");
const emptySub = $("#empty-sub");

// ---------- API helpers ----------
async function api(path, options) {
  const res = await fetch(path, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (res.status === 204) return null;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Request failed");
  return data;
}

// ---------- Toast ----------
let toastTimer;
function toast(msg) {
  const el = $("#toast");
  el.textContent = msg;
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (el.hidden = true), 2600);
}

// ---------- Tabs ----------
function buildTabs() {
  const tabsEl = $("#tabs");
  const items = ["All", ...state.categories];
  tabsEl.innerHTML = "";

  items.forEach((cat) => {
    const b = document.createElement("button");
    b.className = "tab";
    b.textContent = cat;
    b.setAttribute("role", "tab");
    b.setAttribute("aria-selected", String(!state.favoritesOnly && state.category === cat));
    b.addEventListener("click", () => {
      state.category = cat;
      state.favoritesOnly = false;
      refreshTabs();
      loadRecipes();
    });
    tabsEl.appendChild(b);
  });

  // Favorites tab (uses the jam accent).
  const fav = document.createElement("button");
  fav.className = "tab tab-fav";
  fav.textContent = "\u2665 Favorites";
  fav.setAttribute("role", "tab");
  fav.setAttribute("aria-selected", String(state.favoritesOnly));
  fav.addEventListener("click", () => {
    state.favoritesOnly = true;
    refreshTabs();
    loadRecipes();
  });
  tabsEl.appendChild(fav);
}

function refreshTabs() {
  document.querySelectorAll(".tab").forEach((t) => {
    if (t.classList.contains("tab-fav")) {
      t.setAttribute("aria-selected", String(state.favoritesOnly));
    } else {
      t.setAttribute(
        "aria-selected",
        String(!state.favoritesOnly && state.category === t.textContent)
      );
    }
  });
}

// ---------- Load + render recipes ----------
async function loadRecipes() {
  const params = new URLSearchParams();
  if (!state.favoritesOnly && state.category !== "All") params.set("category", state.category);
  if (state.favoritesOnly) params.set("favorites", "true");
  if (state.query) params.set("q", state.query);

  try {
    const recipes = await api(`/api/recipes?${params.toString()}`);
    renderCards(recipes);
  } catch (err) {
    toast(err.message);
  }
}

function snippet(recipe) {
  return recipe.ingredients || recipe.instructions || "No details yet.";
}

function renderCards(recipes) {
  board.innerHTML = "";

  if (!recipes.length) {
    emptyEl.hidden = false;
    if (state.query) emptySub.textContent = `No recipes match "${state.query}".`;
    else if (state.favoritesOnly) emptySub.textContent = "No favorites yet. Tap the heart on a recipe.";
    else if (state.category !== "All") emptySub.textContent = `Nothing filed under ${state.category} yet.`;
    else emptySub.textContent = "Add your first recipe to start the box.";
    return;
  }
  emptyEl.hidden = true;

  recipes.forEach((r) => {
    const card = document.createElement("article");
    card.className = "recipe-card";
    card.tabIndex = 0;

    card.innerHTML = `
      <button class="fav-btn ${r.favorite ? "is-fav" : ""}" aria-label="Toggle favorite">${HEART_SVG}</button>
      <div class="card-category">${escapeHtml(r.category)}</div>
      <h3 class="card-title">${escapeHtml(r.name)}</h3>
      <p class="card-snippet">${escapeHtml(snippet(r))}</p>
      <div class="card-foot">
        <span class="card-source">${r.sourceUrl ? "\u2197 saved link" : "\u00b7"}</span>
      </div>
    `;

    // Open details on card click (but not when the heart is clicked).
    card.addEventListener("click", () => openDetail(r.recipeId));
    card.addEventListener("keydown", (e) => {
      if (e.key === "Enter") openDetail(r.recipeId);
    });

    const favBtn = card.querySelector(".fav-btn");
    favBtn.addEventListener("click", async (e) => {
      e.stopPropagation();
      try {
        const updated = await api(`/api/recipes/${r.recipeId}/favorite`, { method: "PATCH" });
        favBtn.classList.toggle("is-fav", updated.favorite);
        r.favorite = updated.favorite;
        if (state.favoritesOnly && !updated.favorite) loadRecipes();
      } catch (err) {
        toast(err.message);
      }
    });

    board.appendChild(card);
  });
}

// ---------- Detail modal ----------
async function openDetail(id) {
  try {
    const r = await api(`/api/recipes/${id}`);
    const body = $("#detail-body");

    const ingredientsHtml = r.ingredients
      ? `<div class="detail-section"><h3>Ingredients</h3><p>${escapeHtml(r.ingredients)}</p></div>`
      : "";
    const instructionsHtml = r.instructions
      ? `<div class="detail-section"><h3>Instructions</h3><p>${escapeHtml(r.instructions)}</p></div>`
      : "";
    const sourceHtml = r.sourceUrl
      ? `<div class="detail-section detail-source"><h3>Source</h3><a href="${escapeAttr(r.sourceUrl)}" target="_blank" rel="noopener">${escapeHtml(r.sourceUrl)}</a></div>`
      : "";
    const when = r.createdAt ? new Date(r.createdAt).toLocaleDateString() : "";

    body.innerHTML = `
      <div class="modal-head">
        <div>
          <div class="detail-category">${escapeHtml(r.category)}</div>
          <h2 id="detail-name" class="detail-title">${escapeHtml(r.name)}</h2>
        </div>
        <button class="icon-btn" id="detail-close" aria-label="Close">&times;</button>
      </div>
      <div class="detail-meta">${when ? "Saved " + when : ""}</div>
      ${ingredientsHtml}
      ${instructionsHtml}
      ${sourceHtml}
      <div class="detail-actions">
        <button class="detail-fav ${r.favorite ? "is-fav" : ""}" id="detail-fav">${HEART_SVG}<span>${r.favorite ? "Favorited" : "Favorite"}</span></button>
        <button class="btn btn-ghost" id="detail-edit">Edit</button>
        <button class="btn btn-danger" id="detail-delete">Delete</button>
      </div>
    `;

    show("#detail-overlay");

    $("#detail-close").addEventListener("click", () => hide("#detail-overlay"));
    $("#detail-fav").addEventListener("click", async () => {
      try {
        const updated = await api(`/api/recipes/${id}/favorite`, { method: "PATCH" });
        const btn = $("#detail-fav");
        btn.classList.toggle("is-fav", updated.favorite);
        btn.querySelector("span").textContent = updated.favorite ? "Favorited" : "Favorite";
        loadRecipes();
      } catch (err) {
        toast(err.message);
      }
    });
    $("#detail-edit").addEventListener("click", () => {
      hide("#detail-overlay");
      openForm(r);
    });
    $("#detail-delete").addEventListener("click", async () => {
      if (!confirm(`Delete "${r.name}"? This can't be undone.`)) return;
      try {
        await api(`/api/recipes/${id}`, { method: "DELETE" });
        hide("#detail-overlay");
        toast("Recipe deleted.");
        loadRecipes();
      } catch (err) {
        toast(err.message);
      }
    });
  } catch (err) {
    toast(err.message);
  }
}

// ---------- Add / Edit form ----------
function openForm(recipe) {
  const editing = Boolean(recipe && recipe.recipeId);
  $("#form-title").textContent = editing ? "Edit recipe" : "New recipe";
  $("#form-save").textContent = editing ? "Save changes" : "Save recipe";
  $("#form-error").hidden = true;

  $("#f-id").value = editing ? recipe.recipeId : "";
  $("#f-name").value = editing ? recipe.name : "";
  $("#f-ingredients").value = editing ? recipe.ingredients : "";
  $("#f-instructions").value = editing ? recipe.instructions : "";
  $("#f-source").value = editing ? recipe.sourceUrl : "";

  // Populate category select.
  const sel = $("#f-category");
  sel.innerHTML = "";
  state.categories.forEach((cat) => {
    const opt = document.createElement("option");
    opt.value = cat;
    opt.textContent = cat;
    if (editing && recipe.category === cat) opt.selected = true;
    sel.appendChild(opt);
  });

  show("#form-overlay");
  $("#f-name").focus();
}

async function submitForm(e) {
  e.preventDefault();
  const id = $("#f-id").value;
  const payload = {
    name: $("#f-name").value.trim(),
    category: $("#f-category").value,
    ingredients: $("#f-ingredients").value.trim(),
    instructions: $("#f-instructions").value.trim(),
    sourceUrl: $("#f-source").value.trim(),
  };

  if (!payload.name) {
    const err = $("#form-error");
    err.textContent = "Please give the recipe a name.";
    err.hidden = false;
    return;
  }

  try {
    if (id) {
      await api(`/api/recipes/${id}`, { method: "PUT", body: JSON.stringify(payload) });
      toast("Recipe updated.");
    } else {
      await api("/api/recipes", { method: "POST", body: JSON.stringify(payload) });
      toast("Recipe added to the box.");
    }
    hide("#form-overlay");
    loadRecipes();
  } catch (err) {
    const el = $("#form-error");
    el.textContent = err.message;
    el.hidden = false;
  }
}

// ---------- Overlay helpers ----------
function show(sel) { $(sel).hidden = false; }
function hide(sel) { $(sel).hidden = true; }

// ---------- Escaping ----------
function escapeHtml(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c]));
}
function escapeAttr(s) { return escapeHtml(s); }

// ---------- Debounce ----------
function debounce(fn, ms) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
}

// ---------- Wire up ----------
async function init() {
  try {
    state.categories = await api("/api/categories");
  } catch {
    state.categories = ["Breakfast", "Lunch", "Dinner", "Dessert", "Meal Prep", "Snack", "Drink", "Other"];
  }
  buildTabs();
  loadRecipes();

  $("#add-btn").addEventListener("click", () => openForm(null));
  $("#form-close").addEventListener("click", () => hide("#form-overlay"));
  $("#form-cancel").addEventListener("click", () => hide("#form-overlay"));
  $("#recipe-form").addEventListener("submit", submitForm);

  $("#search-input").addEventListener(
    "input",
    debounce((e) => {
      state.query = e.target.value.trim();
      loadRecipes();
    }, 220)
  );

  // Close modals on overlay backdrop click or Escape.
  document.querySelectorAll(".overlay").forEach((ov) => {
    ov.addEventListener("click", (e) => {
      if (e.target === ov) ov.hidden = true;
    });
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      document.querySelectorAll(".overlay").forEach((ov) => (ov.hidden = true));
    }
  });
}

init();
