// scripts/seed.js
// Loads a handful of sample recipes so the app isn't empty during a demo.
// Run:  npm run seed
const crypto = require("crypto");
const { PutCommand } = require("@aws-sdk/lib-dynamodb");
const { ddbDoc, TABLE_NAME } = require("../src/config/dynamo");

const samples = [
  {
    name: "Marry Me Chicken",
    category: "Dinner",
    ingredients:
      "Chicken breasts, sun-dried tomatoes, heavy cream, parmesan, garlic, chicken broth, basil",
    instructions:
      "Sear seasoned chicken. Build cream sauce with garlic, broth, sun-dried tomatoes, and parmesan. Simmer chicken in sauce until cooked through. Finish with basil.",
    sourceUrl: "https://instagram.com/",
    favorite: true,
  },
  {
    name: "Overnight Oats",
    category: "Breakfast",
    ingredients: "Rolled oats, milk, chia seeds, maple syrup, vanilla, berries",
    instructions:
      "Combine oats, milk, chia, syrup, and vanilla in a jar. Refrigerate overnight. Top with berries before eating.",
    sourceUrl: "https://tiktok.com/",
    favorite: false,
  },
  {
    name: "Sheet-Pan Fajita Bowls",
    category: "Meal Prep",
    ingredients:
      "Chicken thighs, bell peppers, onion, fajita seasoning, rice, lime, cilantro",
    instructions:
      "Toss chicken and veggies with seasoning and oil. Roast at 425F for 25 min. Portion over rice with lime and cilantro.",
    sourceUrl: "",
    favorite: false,
  },
  {
    name: "Brown Butter Chocolate Chip Cookies",
    category: "Dessert",
    ingredients:
      "Butter, brown sugar, sugar, egg, vanilla, flour, baking soda, salt, chocolate chips",
    instructions:
      "Brown the butter and cool. Cream with sugars, add egg and vanilla. Fold in dry ingredients and chocolate. Chill, then bake at 350F for 11 min.",
    sourceUrl: "https://instagram.com/",
    favorite: true,
  },
];

async function main() {
  console.log(`Seeding ${samples.length} recipes into ${TABLE_NAME}...`);
  for (const s of samples) {
    const item = {
      recipeId: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      ...s,
    };
    await ddbDoc.send(new PutCommand({ TableName: TABLE_NAME, Item: item }));
    console.log("  +", s.name);
  }
  console.log("Done.");
}

main().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
