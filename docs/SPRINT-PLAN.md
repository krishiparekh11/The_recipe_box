# The Recipe Box — Sprint Plan (Sprints 1–3)

Team assignments are kept from the board for the record. In this build one person
carried all of them, so every card below is fully implemented in the codebase.

## Board state at end of Sprint 3

**Done — Sprint 1 (infrastructure, closed)**
| # | Card | Owner | Delivered by |
|---|------|-------|--------------|
| 1 | Set up AWS VPC & networking | Krishi | AWS guide Steps 3–4 |
| 2 | Deploy EC2 instances with Ubuntu | Krishi | Launch template + `deploy/user-data.sh`, guide Step 6 |
| 3 | Configure Application Load Balancer | Adithya | AWS guide Step 7 |
| 4 | Set up Auto Scaling Group | Adithya | AWS guide Step 8 |
| 5 | Set up DynamoDB table for recipes | Kara | AWS guide Step 1 + `scripts/create-table.js` |
| 6 | Build Node.js/Express API | Kara | `server.js`, `src/routes`, `src/controllers` |

**Done — Sprint 2 (core features, closed)**
| # | Card | Owner | Delivered by |
|---|------|-------|--------------|
| 7 | Add new recipe (UI + API) | Krishi + Kara | `POST /api/recipes` + Add form modal |
| 8 | View list of saved recipes | Adithya + Krishi | `GET /api/recipes` + card grid |
| 9 | View recipe details | Adithya | `GET /api/recipes/:id` + detail modal |
| 10 | Search recipes by name | Krishi | `?q=` filter + debounced search bar |

**Sprint 3 (active) — In Progress**
| # | Card | Owner | Delivered by |
|---|------|-------|--------------|
| 11 | Organize recipes by category | Adithya | `?category=` filter + divider tabs |
| 13 | Delete a recipe | Krishi | `DELETE /api/recipes/:id` + delete button |
| 15 | Testing & bug fixes | Kara (lead) | Manual test checklist below |

**Sprint 3 (active) — To Do**
| # | Card | Owner | Delivered by |
|---|------|-------|--------------|
| 12 | Mark recipes as favorites | Adithya + Kara | `PATCH /api/recipes/:id/favorite` + heart button + Favorites tab |
| 14 | Frontend UI polish & styling | All three | Index-card design system in `public/css/styles.css` |

> On the board: rename the old "Sprint 1" list to **Sprint 3** and use it as the
> active To-Do column; move #11, #13, #15 into **In Progress** at kickoff; leave
> #12 and #14 in **To Do**. Cards #1–#10 sit in **Done**.

## API surface (what the backend exposes)

| Method | Path | Purpose | Card |
|--------|------|---------|------|
| GET | `/health` | ALB health check | 3 |
| GET | `/api/categories` | List category names | 11 |
| GET | `/api/recipes` | List; supports `?q=`, `?category=`, `?favorites=true` | 8, 10, 11, 12 |
| GET | `/api/recipes/:id` | Recipe details | 9 |
| POST | `/api/recipes` | Add a recipe | 7 |
| PUT | `/api/recipes/:id` | Edit a recipe | (bonus) |
| PATCH | `/api/recipes/:id/favorite` | Toggle favorite | 12 |
| DELETE | `/api/recipes/:id` | Delete a recipe | 13 |

## Testing & bug-fix checklist (card #15)

Run through this against the deployed ALB URL:

1. Load the page with an empty table → empty-state message shows.
2. Add a recipe with only a name → saves; blank name → blocked with an error.
3. Add recipes in several categories → each appears under its divider tab and under "All".
4. Search by part of a name → list narrows live; clearing search restores all.
5. Open a recipe → details modal shows ingredients, instructions, source link.
6. Favorite from a card and from the detail view → heart fills; Favorites tab lists it.
7. Unfavorite → it leaves the Favorites tab.
8. Edit a recipe → changes persist after reload.
9. Delete a recipe → confirm dialog, then it disappears and stays gone after reload.
10. Terminate one EC2 instance → URL stays up; ASG replaces the instance (HA proof).
