# The Recipe Box

A cloud-based web app to save, organize, and rediscover recipes — especially the
ones you find on social media and can never locate again. Built for CSYE 6225.

Add recipes, browse them as index cards, search by name, filter by category, mark
favorites, view full details, edit, and delete — all backed by Amazon DynamoDB and
served from Node.js/Express on auto-scaling EC2 behind an Application Load Balancer.

## Architecture

```
User → Application Load Balancer → EC2 (Node.js/Express, multi-AZ, Auto Scaling) → Amazon DynamoDB
```

A single Express process on each instance serves both the frontend (`public/`) and
the JSON API, so there is one thing to deploy per instance.

## Project layout

```
recipe-box/
├── server.js                     Express entry point (static + API + /health)
├── package.json
├── .env.example
├── src/
│   ├── config/dynamo.js          DynamoDB clients (SDK v3, no hardcoded keys)
│   ├── controllers/recipeController.js   all recipe logic
│   └── routes/recipes.js         API routes
├── public/                       frontend (index-card UI)
│   ├── index.html
│   ├── css/styles.css
│   └── js/app.js
├── scripts/
│   ├── create-table.js           create the DynamoDB table from code
│   └── seed.js                   load sample recipes
├── deploy/
│   ├── user-data.sh              EC2 bootstrap (used by the launch template)
│   └── recipebox.service         systemd unit
└── docs/
    ├── AWS-SETUP-GUIDE.md         full click-by-click AWS setup  ← start here for cloud
    └── SPRINT-PLAN.md             the 3-sprint board and card mapping
```

## Run it locally

You need Node 18+ and AWS credentials that can reach a DynamoDB table (a personal
`aws configure` profile is fine for local dev).

```bash
npm install
cp .env.example .env         # edit AWS_REGION if needed
npm run create-table         # one time: creates the "Recipes" table
npm run seed                 # optional: a few sample recipes
npm start                    # http://localhost:3000
```

If you don't have AWS set up yet, follow `docs/AWS-SETUP-GUIDE.md` Step 1 to create
the table in the console instead of running `create-table`.

## Deploy to AWS

Follow **`docs/AWS-SETUP-GUIDE.md`** top to bottom. It covers the DynamoDB table,
the IAM role, the VPC and subnets across two AZs, security groups, the launch
template, the load balancer, and the auto scaling group — in the order that works.

## Configuration

| Variable | Default | Meaning |
|----------|---------|---------|
| `PORT` | `3000` | Port the app listens on (ALB target group uses this) |
| `AWS_REGION` | `us-east-1` | Region of your DynamoDB table |
| `RECIPES_TABLE` | `Recipes` | DynamoDB table name |

No AWS keys live in the app. Locally the SDK reads your `aws configure` profile;
on EC2 it reads the attached IAM instance role.

## Features by sprint

- **Sprint 1** — VPC/networking, EC2 (Ubuntu), ALB, Auto Scaling Group, DynamoDB
  table, Express API skeleton.
- **Sprint 2** — add recipe, list recipes, recipe details, search by name.
- **Sprint 3** — filter by category, mark favorites, delete recipe, UI polish,
  end-to-end testing.

See `docs/SPRINT-PLAN.md` for the card-by-card breakdown.
