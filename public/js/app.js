// public/js/app.js — Recipe Box frontend (redesign, overlay-free).
// Same backend API as before. The add/edit form and the recipe details render
// inline in the page flow, so nothing can cover the screen and block clicks.

const HEART_SVG =
  '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21s-7.5-4.7-10-9.3C.4 8.5 2 5 5.3 5c2 0 3.4 1.2 4.2 2.4C10.3 6.2 11.7 5 13.7 5 17 5 18.6 8.5 17 11.7 14.5 16.3 12 21 12 21z"/></svg>';

const state = {
  category: "All",
  favoritesOnly: false,
  query: "",
  categories: [],
  recipes: [],
  openId: null, // which card is expanded inline
};

const $ = (sel) => document.querySelector(sel);

// ---------- API helper ----------
async function api(path, options) {
  const res = await fetch(path, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (res.status === 204) return null;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Something went wrong. Try again.");
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

// ---------- Filters ----------
function buildFilters() {
  const wrap = $("#filters");
  wrap.innerHTML = "";

  const makeChip = (label, isActive, onClick, extraClass = "", html) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "chip " + extraClass;
    b.innerHTML = html || label;
    b.setAttribute("aria-pressed", String(isActive));
    b.addEventListener("click", onClick);
    wrap.appendChild(b);
  };

  makeChip("All", !state.favoritesOnly && state.category === "All", () => {
    state.category = "All";
    state.favoritesOnly = false;
    loadRecipes();
  });

  state.categories.forEach((cat) => {
    makeChip(cat, !state.favoritesOnly && state.category === cat, () => {
      state.category = cat;
      state.favoritesOnly = false;
      loadRecipes();
    });
  });

  makeChip(
    "Favorites",
    state.favoritesOnly,
    () => {
      state.favoritesOnly = true;
      loadRecipes();
    },
    "chip-fav",
    '<span class="h" aria-hidden="true">\u2665</span> Favorites'
  );
}

// ---------- Load + render ----------
async function loadRecipes() {
  const params = new URLSearchParams();
  if (!state.favoritesOnly && state.category !== "All") params.set("category", state.category);
  if (state.favoritesOnly) params.set("favorites", "true");
  if (state.query) params.set("q", state.query);

  try {
    state.recipes = await api(`/api/recipes?${params.toString()}`);
    buildFilters();
    renderCards();
  } catch (err) {
    toast(err.message);
  }
}

function snippet(r) {
  return r.ingredients || r.instructions || "No details yet.";
}

function renderCards() {
  const board = $("#board");
  const empty = $("#empty");
  board.innerHTML = "";

  if (!state.recipes.length) {
    empty.hidden = false;
    if (state.query) $("#empty-sub").textContent = `Nothing matches "${state.query}".`;
    else if (state.favoritesOnly) $("#empty-sub").textContent = "No favorites yet. Tap a heart to save one.";
    else if (state.category !== "All") $("#empty-sub").textContent = `Nothing filed under ${state.category} yet.`;
    else $("#empty-sub").textContent = "Add your first recipe to get started.";
    return;
  }
  empty.hidden = true;

  state.recipes.forEach((r) => {
    const isOpen = state.openId === r.recipeId;
    const card = document.createElement("article");
    card.className = "card" + (isOpen ? " is-open" : "");

    card.innerHTML = `
      <div class="card-top" data-role="toggle">
        <div class="card-main">
          <div class="card-eyebrow">${escapeHtml(r.category)}</div>
          <h3 class="card-title">${escapeHtml(r.name)}</h3>
          <p class="card-snippet">${escapeHtml(snippet(r))}</p>
        </div>
        <button class="heart-btn ${r.favorite ? "is-fav" : ""}" data-role="fav"
                type="button" aria-label="${r.favorite ? "Remove favorite" : "Add favorite"}">
          ${HEART_SVG}
        </button>
      </div>
      <div class="card-tag">${r.sourceUrl ? "\u2197 saved link" : "\u00b7"}</div>
      ${isOpen ? detailHtml(r) : ""}
    `;

    // Expand / collapse on the top area (but not when the heart is clicked).
    card.querySelector('[data-role="toggle"]').addEventListener("click", () => {
      state.openId = isOpen ? null : r.recipeId;
      renderCards();
    });

    // Favorite toggle.
    card.querySelector('[data-role="fav"]').addEventListener("click", async (e) => {
      e.stopPropagation();
      try {
        const updated = await api(`/api/recipes/${r.recipeId}/favorite`, { method: "PATCH" });
        r.favorite = updated.favorite;
        if (state.favoritesOnly && !updated.favorite) {
          state.recipes = state.recipes.filter((x) => x.recipeId !== r.recipeId);
        }
        renderCards();
      } catch (err) {
        toast(err.message);
      }
    });

    // Wire up expanded-detail action buttons.
    if (isOpen) {
      card.querySelector('[data-role="edit"]').addEventListener("click", () => openForm(r));
      card.querySelector('[data-role="delete"]').addEventListener("click", async () => {
        if (!confirm(`Delete "${r.name}"? This can't be undone.`)) return;
        try {
          await api(`/api/recipes/${r.recipeId}`, { method: "DELETE" });
          state.openId = null;
          toast("Recipe deleted.");
          loadRecipes();
        } catch (err) {
          toast(err.message);
        }
      });
    }

    board.appendChild(card);
  });
}

function detailHtml(r) {
  const when = r.createdAt ? new Date(r.createdAt).toLocaleDateString() : "";
  const ing = r.ingredients
    ? `<div class="detail-section"><h4>Ingredients</h4><p>${escapeHtml(r.ingredients)}</p></div>`
    : "";
  const ins = r.instructions
    ? `<div class="detail-section"><h4>Instructions</h4><p>${escapeHtml(r.instructions)}</p></div>`
    : "";
  const src = r.sourceUrl
    ? `<div class="detail-section detail-source"><h4>Source</h4><a href="${escapeAttr(r.sourceUrl)}" target="_blank" rel="noopener">${escapeHtml(r.sourceUrl)}</a></div>`
    : "";
  return `
    <div class="detail">
      ${when ? `<div class="detail-meta">Saved ${escapeHtml(when)}</div>` : ""}
      ${ing}${ins}${src}
      <div class="detail-actions">
        <button class="btn btn-ghost" type="button" data-role="edit">Edit</button>
        <button class="btn btn-danger" type="button" data-role="delete">Delete</button>
      </div>
    </div>
  `;
}

// ---------- Inline add / edit form ----------
function openForm(recipe) {
  const editing = Boolean(recipe && recipe.recipeId);
  const panel = $("#form-panel");

  $("#form-title").textContent = editing ? "Edit recipe" : "New recipe";
  $("#form-save").textContent = editing ? "Save changes" : "Save recipe";
  $("#form-error").hidden = true;

  $("#f-id").value = editing ? recipe.recipeId : "";
  $("#f-name").value = editing ? recipe.name : "";
  $("#f-ingredients").value = editing ? recipe.ingredients : "";
  $("#f-instructions").value = editing ? recipe.instructions : "";
  $("#f-source").value = editing ? recipe.sourceUrl : "";

  const sel = $("#f-category");
  sel.innerHTML = "";
  state.categories.forEach((cat) => {
    const opt = document.createElement("option");
    opt.value = cat;
    opt.textContent = cat;
    if (editing && recipe.category === cat) opt.selected = true;
    sel.appendChild(opt);
  });

  panel.hidden = false;
  panel.scrollIntoView({ behavior: "smooth", block: "start" });
  $("#f-name").focus();
}

function closeForm() {
  $("#form-panel").hidden = true;
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
    err.textContent = "Give the recipe a name to save it.";
    err.hidden = false;
    return;
  }

  try {
    if (id) {
      await api(`/api/recipes/${id}`, { method: "PUT", body: JSON.stringify(payload) });
      toast("Changes saved.");
    } else {
      await api("/api/recipes", { method: "POST", body: JSON.stringify(payload) });
      toast("Recipe added.");
    }
    closeForm();
    state.openId = null;
    loadRecipes();
  } catch (err) {
    const el = $("#form-error");
    el.textContent = err.message;
    el.hidden = false;
  }
}

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

// ---------- Init ----------
async function init() {
  // The form starts closed; there is no overlay anywhere in this app.
  closeForm();

  try {
    state.categories = await api("/api/categories");
  } catch {
    state.categories = ["Breakfast", "Lunch", "Dinner", "Dessert", "Meal Prep", "Snack", "Drink", "Other"];
  }

  buildFilters();
  loadRecipes();

  $("#add-btn").addEventListener("click", () => openForm(null));
  $("#form-close").addEventListener("click", closeForm);
  
      loadRecipes();
    }, 220)
  );

  // Escape closes the inline form (never needed to "unstick" the page,
  // since nothing overlays it — but it's a nice convenience).
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeForm();
  });
}

init();