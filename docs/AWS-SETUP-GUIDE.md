# The Recipe Box — AWS Setup Guide (console, step by step)

This guide takes you from an empty AWS account to a running, load-balanced,
auto-scaling deployment of the Recipe Box. It is written for the **AWS Management
Console** (clicking, not the CLI) because that is the clearest way to do it once.

**Do the steps in this order.** Later resources depend on earlier ones.

Each part is labeled with the Jira/board card it satisfies.

**Before you start**
- An AWS account with admin access (or a course/sandbox account).
- Your code pushed to a **public GitHub repo** (the instances clone it on boot).
  If it must be private, see the note at the end of Step 6.
- **Pick one Region and use it for everything.** This guide uses
  **US East (N. Virginia) `us-east-1`**. If you pick another, keep it consistent
  everywhere, and set the same value in the launch template's user data.

A note on cost: `t3.micro` instances, one ALB, and on-demand DynamoDB are cheap,
but **not free forever**. Do **Step 9 (Teardown)** when you finish to avoid charges.

---

## Step 1 — DynamoDB table  · card #5

The database has no dependencies, so build it first.

1. Console search bar → **DynamoDB** → **Create table**.
2. **Table name:** `Recipes`
3. **Partition key:** `recipeId`, type **String**. Leave sort key empty.
4. **Table settings:** choose **Customize settings**.
5. **Read/write capacity:** select **On-demand**. (No capacity planning; you pay
   per request. Perfect for a project.)
6. Leave everything else default → **Create table**.
7. Wait until **Status = Active**.

That is the whole schema. Every recipe is one item keyed by a UUID that the API
generates; all other fields (name, category, ingredients, instructions, favorite,
createdAt) are just attributes.

> Alternative: you can create this table from code instead by running
> `npm run create-table` locally with your admin credentials. Same result.

---

## Step 2 — IAM role for EC2 (so instances can reach DynamoDB)  · dependency

The app uses **no access keys**. Instead each EC2 instance carries an IAM role,
and the AWS SDK picks those credentials up automatically. Create that role now.

1. Console → **IAM** → **Roles** → **Create role**.
2. **Trusted entity type:** AWS service. **Use case:** **EC2**. → Next.
3. On the permissions page, click **Create policy** (opens a new tab). Choose the
   **JSON** tab and paste this least-privilege policy (replace `REGION` and
   `ACCOUNT_ID`; find your account ID at top-right of the console):

   ```json
   {
     "Version": "2012-10-17",
     "Statement": [
       {
         "Effect": "Allow",
         "Action": [
           "dynamodb:GetItem",
           "dynamodb:PutItem",
           "dynamodb:UpdateItem",
           "dynamodb:DeleteItem",
           "dynamodb:Scan",
           "dynamodb:Query"
         ],
         "Resource": "arn:aws:dynamodb:REGION:ACCOUNT_ID:table/Recipes"
       }
     ]
   }
   ```

   Name it `RecipeBoxDynamoAccess` → **Create policy**.
   *(Shortcut if you're in a hurry: skip the custom policy and attach the AWS
   managed `AmazonDynamoDBFullAccess` instead. Less secure, but fine for a demo.)*
4. Back on the role tab, refresh the policy list, tick **`RecipeBoxDynamoAccess`**
   → Next.
5. **Role name:** `RecipeBoxEC2Role` → **Create role**.

Creating an EC2 role in the console automatically creates a matching **instance
profile** of the same name, which is what you'll attach in Step 6.

---

## Step 3 — Custom VPC and networking  · card #1

1. Console → **VPC** → **Create VPC**.
2. Select **VPC and more** (this builds the VPC, subnets, internet gateway, and
   route tables together — far less error-prone than doing each by hand).
3. Settings:
   - **Name tag auto-generation:** `recipebox`
   - **IPv4 CIDR:** `10.0.0.0/16`
   - **Number of Availability Zones (AZs):** **2**  ← this is the "across 2 AZs" requirement
   - **Number of public subnets:** **2**
   - **Number of private subnets:** **0** (the app runs in public subnets, matching
     the architecture diagram; keeps things simple and lets instances reach the
     public DynamoDB endpoint through the internet gateway)
   - **NAT gateways:** **None**  (avoids ~$1/day charges)
   - **VPC endpoints:** **None**
4. **Create VPC.** When it finishes, you now have: one VPC, two public subnets
   (one per AZ, e.g. `recipebox-subnet-public1-us-east-1a` and `...1b`), an
   internet gateway attached, and a public route table pointing `0.0.0.0/0` at it.

Note the VPC name/ID — you'll pick it in the next steps.

---

## Step 4 — Security groups  · part of card #1

You need two: one for the load balancer, one for the instances. Create the ALB
group first so you can reference it from the instance group.

**4a. ALB security group**
1. VPC → **Security groups** → **Create security group**.
2. **Name:** `recipebox-alb-sg`  · **Description:** `ALB inbound HTTP`
   · **VPC:** your `recipebox` VPC.
3. **Inbound rules → Add rule:** Type **HTTP**, Port **80**, Source **Anywhere-IPv4
   (`0.0.0.0/0`)**.
4. Leave outbound as default (all traffic). **Create.**

**4b. EC2 (instance) security group**
1. **Create security group** again.
2. **Name:** `recipebox-ec2-sg`  · **Description:** `App instances`
   · **VPC:** your `recipebox` VPC.
3. **Inbound rules → Add rule:** Type **Custom TCP**, Port **3000**, Source
   **Custom → select `recipebox-alb-sg`**. (Only the load balancer may reach the
   app port — not the public internet.)
4. *(Optional, for SSH debugging)* Add rule: Type **SSH**, Port **22**, Source
   **My IP**.
5. **Create.**

---

## Step 5 — (You already have the code) push it to GitHub  · prep for card #2

The instances install themselves by cloning your repo on boot, so it must be
reachable.

1. Create a repo, e.g. `recipe-box`, and push this project to it.
2. Confirm the repo is **public** (or read the private-repo note in Step 6).
3. Copy the repo's HTTPS clone URL — you'll paste it into the user-data script.

---

## Step 6 — Launch Template (defines each instance)  · card #2

The Auto Scaling Group needs a **launch template** describing what every instance
looks like. This is where "deploy EC2 with Ubuntu" actually lives.

1. Console → **EC2** → **Launch Templates** → **Create launch template**.
2. **Name:** `recipebox-lt`  · **Description:** `Recipe Box app instance`.
3. **Application and OS Images (AMI):** search and select
   **Ubuntu Server 24.04 LTS** (64-bit x86). *(22.04 also works.)*
4. **Instance type:** `t3.micro`.
5. **Key pair:** choose one if you want SSH access, or **Proceed without a key pair**.
6. **Network settings → Security groups:** select **`recipebox-ec2-sg`**.
   Do **not** pick a subnet here — the Auto Scaling Group assigns subnets so it can
   spread instances across both AZs.
7. Expand **Advanced details**:
   - **IAM instance profile:** select **`RecipeBoxEC2Role`**.
   - Scroll to **User data** and paste the contents of `deploy/user-data.sh`
     from this project. **Edit the two placeholder lines first:**
     - `REPO_URL="https://github.com/YOUR_USERNAME/recipe-box.git"`
     - `AWS_REGION="us-east-1"` (match your Region)
8. **Create launch template.**

What the user data does on each boot: installs Node 20, clones your repo, runs
`npm install`, writes `/etc/recipe-box.env`, and starts the app as a `systemd`
service on port 3000. It also survives reboots (`systemctl enable`).

> **Private repo?** Public is simplest. If it must be private, either (a) bake the
> code into a custom AMI instead of cloning, or (b) store the code in an S3 bucket
> and have user data pull it with the instance role. Public repo avoids all of this.

---

## Step 7 — Target group + Application Load Balancer  · card #3

**7a. Target group** (the ALB needs somewhere to send traffic)
1. EC2 → **Target Groups** → **Create target group**.
2. **Target type:** **Instances**.
3. **Name:** `recipebox-tg`.
4. **Protocol / Port:** **HTTP** / **3000**.
5. **VPC:** your `recipebox` VPC.
6. **Health checks → Health check path:** `/health`  ← the app exposes this; it must
   return 200 for an instance to receive traffic.
7. *(Optional, faster demos)* Under **Advanced health check settings**, set
   **Healthy threshold** to `2` and **Interval** to `10` seconds.
8. **Next** → do **not** register any instances manually (the ASG will do it) →
   **Create target group.**

**7b. Load balancer**
1. EC2 → **Load Balancers** → **Create load balancer** →
   **Application Load Balancer** → Create.
2. **Name:** `recipebox-alb`.
3. **Scheme:** **Internet-facing**  · **IP address type:** IPv4.
4. **Network mapping:** select your `recipebox` VPC, then tick **both** AZs and
   choose the **public** subnet in each.
5. **Security groups:** remove the default, select **`recipebox-alb-sg`**.
6. **Listeners and routing:** Protocol **HTTP**, Port **80**, **Default action →
   Forward to `recipebox-tg`**.
7. **Create load balancer.** Wait until its state becomes **Active** and copy its
   **DNS name** (looks like `recipebox-alb-1234567890.us-east-1.elb.amazonaws.com`).
   That DNS name is your app's public URL.

---

## Step 8 — Auto Scaling Group  · card #4

This launches instances across both AZs, registers them with the target group,
replaces unhealthy ones, and scales with load.

1. EC2 → **Auto Scaling Groups** → **Create Auto Scaling group**.
2. **Name:** `recipebox-asg`. **Launch template:** `recipebox-lt` → Next.
3. **Network:** select your `recipebox` VPC and tick **both public subnets**
   (one per AZ) → Next.
4. **Load balancing:** choose **Attach to an existing load balancer** →
   **Choose from your load balancer target groups** → select **`recipebox-tg`**.
5. **Health checks:** turn on **Turn on Elastic Load Balancing health checks** so
   the group replaces any instance the ALB marks unhealthy. → Next.
6. **Group size:**
   - **Desired capacity:** `2`
   - **Minimum capacity:** `2`  (one instance in each AZ = high availability)
   - **Maximum capacity:** `4`
7. **Scaling policies:** choose **Target tracking scaling policy**, metric
   **Average CPU utilization**, target **50**. This grows the group under load and
   shrinks it when idle. → Next through the rest → **Create Auto Scaling group.**

Within a couple of minutes the ASG launches two instances. Each runs the user-data
script, comes up on port 3000, and passes the `/health` check.

---

## Step 9 — Verify (and the demo)

1. EC2 → **Target Groups** → `recipebox-tg` → **Targets** tab. Wait for both
   instances to show **healthy**. (If they stay `initial`/`unhealthy`, jump to
   Troubleshooting.)
2. Open `http://<your-ALB-DNS-name>/` in a browser. The Recipe Box loads.
3. Add a recipe, favorite it, search, filter by category, open details, delete.
   All of it reads/writes the DynamoDB `Recipes` table.
4. **Prove auto-scaling / HA** for your write-up: in the Auto Scaling Group →
   **Instance management**, terminate one instance. The ALB stops routing to it and
   the ASG launches a replacement in the same AZ, with **no downtime** on the URL.

*(Optional)* To pre-load demo data, run `npm run seed` locally against the same
Region/table before the demo.

---

## Troubleshooting

- **Targets unhealthy.** SSH into an instance (if you set a key pair) and run
  `sudo systemctl status recipebox` and `sudo journalctl -u recipebox -n 50`.
  Common causes: user-data repo URL wrong, `npm install` failed, or wrong Region.
  Confirm the app answers locally: `curl localhost:3000/health`.
- **App loads but recipes error / 500.** The instance role can't reach DynamoDB.
  Check the IAM role is attached (EC2 → instance → **Security** tab shows the role)
  and that the policy Region/table ARN matches your table.
- **Can't reach the ALB at all.** Check the ALB security group allows inbound 80
  from `0.0.0.0/0`, and that the ALB is **Active** across both public subnets.
- **ALB reaches instances but times out.** The EC2 security group must allow port
  **3000** from the **ALB security group** (source = the SG, not an IP).
- **`git clone` fails in user data.** Repo is private, or the URL is wrong. Make it
  public or use the S3/AMI approach from Step 6.

To watch a fresh instance boot: EC2 → select instance → **Actions → Monitor and
troubleshoot → Get system log** shows the user-data output.

---

## Step 10 — Teardown (do this to stop charges)

Delete in reverse dependency order:

1. **Auto Scaling Group** `recipebox-asg` → Delete (this terminates the instances).
2. **Load Balancer** `recipebox-alb` → Delete.
3. **Target Group** `recipebox-tg` → Delete.
4. **Launch Template** `recipebox-lt` → Delete.
5. **VPC** `recipebox` → **Delete VPC** (removes subnets, IGW, route tables, and the
   security groups with it).
6. **DynamoDB** table `Recipes` → Delete (only if you don't need the data).
7. **IAM** role `RecipeBoxEC2Role` and policy `RecipeBoxDynamoAccess` → Delete.

---

## How this maps to the architecture

```
User (browser)
      │  HTTP :80
      ▼
Application Load Balancer  (recipebox-alb, public subnets, 2 AZs)
      │  HTTP :3000  (only ALB SG allowed in)
      ▼
EC2 instances  (Ubuntu, Node/Express, managed by recipebox-asg across 2 AZs)
      │  AWS SDK, credentials from RecipeBoxEC2Role
      ▼
Amazon DynamoDB  (Recipes table, on-demand)
```

This is exactly the flow from the proposal: **User → ALB → EC2 (multi-AZ) →
Node.js/Express API → DynamoDB**, with an Auto Scaling Group providing scalability
and reliability.
