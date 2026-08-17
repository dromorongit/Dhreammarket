const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./dev.db');

db.all(
  "SELECT id, name, slug FROM product_categories WHERE name LIKE '%Fridge%' OR slug LIKE '%fridge%' OR name LIKE '%Freezer%'",
  (err, rows) => {
    if (err) {
      console.error(err);
      process.exit(1);
    }
    console.log(JSON.stringify(rows, null, 2));
    db.close();
    process.exit(0);
  }
);
