#!/bin/bash
# user-data.sh — runs automatically on every EC2 instance the Auto Scaling Group
# launches. It installs Node.js, pulls the app, and starts it as a service.
#
# HOW TO USE: paste this into the "User data" box of your Launch Template
# (AWS-SETUP-GUIDE.md, Step 6). Replace the two placeholders below first.
set -euxo pipefail

# ---- EDIT THESE TWO LINES ----
REPO_URL="https://github.com/krishiparekh11/The_recipe_box.git"
AWS_REGION="us-east-1"
# ------------------------------

RECIPES_TABLE="Recipes"
APP_DIR="/opt/recipe-box"

# 1. System packages + Node.js 20 (NodeSource).
apt-get update -y
apt-get install -y git curl ca-certificates
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt-get install -y nodejs

# 2. Get the application code.
rm -rf "$APP_DIR"
git clone "$REPO_URL" "$APP_DIR"
cd "$APP_DIR"
npm install --omit=dev

# 3. Environment file the service reads.
cat > /etc/recipe-box.env <<EOF
PORT=3000
AWS_REGION=${AWS_REGION}
RECIPES_TABLE=${RECIPES_TABLE}
EOF

# 4. Install and start the systemd service.
cp deploy/recipebox.service /etc/systemd/system/recipebox.service
systemctl daemon-reload
systemctl enable recipebox
systemctl restart recipebox

echo "Recipe Box bootstrap complete."
