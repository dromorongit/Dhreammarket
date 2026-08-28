import 'dotenv/config';
import pg from 'pg';
import { customAlphabet } from 'nanoid';

const { Client } = pg;

const nanoid = customAlphabet('0123456789abcdefghijklmnopqrstuvwxyz', 21);

const client = new Client({
  connectionString: process.env.DATABASE_URL,
});

await client.connect();

const existingUpdates = [
  { slug: 'sponsored', displayOrder: 10 },
  { slug: 'quick-links', displayOrder: 20 },
  { slug: 'trending-now', displayOrder: 30 },
  { slug: 'dynamic-random-product-rail', displayOrder: 40 },
  { slug: 'trending-services', displayOrder: 85 },
  { slug: 'verified-vendors', displayOrder: 115 },
  { slug: 'food-showcase', displayOrder: 155 },
  { slug: 'flash-sales', displayOrder: 215 },
  { slug: 'gadget-display', displayOrder: 225 },
  { slug: 'big-top-deals', displayOrder: 235 },
  { slug: 'brand-store', displayOrder: 245 },
  { slug: 'top-clearance-sales', displayOrder: 255 },
  { slug: 'top-services', displayOrder: 265 },
  { slug: 'home-theatre', displayOrder: 275 },
  { slug: 'top-express-offers', displayOrder: 285 },
  { slug: 'new-services', displayOrder: 295 },
  { slug: 'fashion', displayOrder: 305 },
  { slug: 'groceries', displayOrder: 315 },
  { slug: 'mens-sneakers', displayOrder: 325 },
  { slug: 'televisions', displayOrder: 335 },
  { slug: 'appliances', displayOrder: 345 },
];

for (const update of existingUpdates) {
  const result = await client.query(
    'UPDATE homepage_sections SET "displayOrder" = $1 WHERE slug = $2',
    [update.displayOrder, update.slug]
  );
  if (result.rowCount === 0) {
    console.log(`WARNING: No section found with slug ${update.slug}`);
  } else {
    console.log(`Updated displayOrder for ${update.slug} to ${update.displayOrder}`);
  }
}

const newSections = [
  { name: 'Deals You Don\'t Want To Miss', slug: 'deals-you-dont-want-to-miss', type: 'PRODUCT_GRID', subtitle: 'Up to 60% Off', settings: { contentSource: 'MANUAL' }, displayOrder: 15 },
  { name: 'Fridges & Freezers', slug: 'fridges-freezers', type: 'CATEGORY_PRODUCTS', subtitle: 'Up to 45% Off', settings: { contentSource: 'AUTOMATIC', categoryIds: ['cmsx0p7h300071kqs0zfgxece'] }, displayOrder: 45 },
  { name: 'Cooking Appliances', slug: 'cooking-appliances', type: 'CATEGORY_PRODUCTS', subtitle: 'Kitchen Makeover', settings: { contentSource: 'AUTOMATIC', categoryIds: ['cmqhdm3je006c1knofqmh8r2n', 'cmswxvwrh00001kqs3swbtq31'] }, displayOrder: 55 },
  { name: 'Washers & Dryers', slug: 'washers-dryers', type: 'CATEGORY_PRODUCTS', subtitle: 'Up to 40% Off', settings: { contentSource: 'AUTOMATIC', categoryIds: ['cmswy05r400011kqst1wuwn92', 'cmswy0q6800021kqsiqmdertq'] }, displayOrder: 65 },
  { name: 'Small Appliances', slug: 'small-appliances', type: 'CATEGORY_PRODUCTS', subtitle: 'Home Makeover', settings: { contentSource: 'AUTOMATIC', categoryIds: ['cmswy4iws00031kqsm0ciz8tt'] }, displayOrder: 75 },
  { name: 'Mobile Phones', slug: 'mobile-phones', type: 'CATEGORY_PRODUCTS', subtitle: 'Up to 40% Off', settings: { contentSource: 'AUTOMATIC', categoryIds: ['cmqhci126004u1knoz6327n3r'] }, displayOrder: 95 },
  { name: 'Smart Accessories', slug: 'smart-accessories', type: 'CATEGORY_PRODUCTS', subtitle: 'Up to 50% Off', settings: { contentSource: 'AUTOMATIC', categoryIds: ['cmqhcjqtr004y1knor96kv08x', 'cmqhck6gv004z1knox23rcpnh', 'cmqhcl8oi00511knob1y39l9q', 'cmqhclnjo00521knokamyshi8', 'cmqhcm02500531kno3eprrs5h'] }, displayOrder: 105 },
  { name: 'Fashion Steez', slug: 'fashion-steez', type: 'CATEGORY_PRODUCTS', subtitle: 'Style on a budget', settings: { contentSource: 'AUTOMATIC', categoryIds: ['cmqhcuu12005a1knokiuuk1kl', 'cmqhcven1005b1knobgxqvntb', 'cmqhcy2gl005d1knod4520h8p', 'cmqhcyotm005e1knoz71exlgj', 'cmqhcz09b005f1kno3ijvj9qx', 'cmqhczj1l005g1knoytb1axka', 'cmqhczyay005h1knoblfb8ush', 'cmqhd0hsd005i1knoh9kpgtih', 'cmqhd0w8g005j1knojjmtbliu', 'cmqhd1ea3005k1knoziwcyg3c', 'cmqhd1q4r005l1knokftjz2f0', 'cmqhd2472005m1kno23kbb7v7', 'cmqhcwj5m005c1knopg4y42a0'] }, displayOrder: 125 },
  { name: 'Beauty & Perfumes', slug: 'beauty-perfumes', type: 'CATEGORY_PRODUCTS', subtitle: 'Up to 40% Off', settings: { contentSource: 'AUTOMATIC', categoryIds: ['cmqhbrdot004b1knoodiilp17', 'cmqhd37u1005p1kno7r6g6mww', 'cmqhd3h28005q1knoov9jfs82', 'cmqhd3zw7005r1knou847ij86', 'cmqhd47no005s1knoxyan3l24', 'cmqhd4yd8005t1kno1b9ixk8u', 'cmqhd5e0b005u1knotvr80yzj', 'cmqhd5r7n005v1knoadj4mcwv', 'cmqhd7o6v005y1knontti944t', 'cmqhd8k3r005z1kno6gwfo1pp'] }, displayOrder: 135 },
  { name: 'FALAA Deals', slug: 'falaa-deals', type: 'PRODUCT_GRID', subtitle: 'Quicks for you', settings: { contentSource: 'MANUAL' }, displayOrder: 145 },
  { name: 'Automotives & Motorcycles', slug: 'automotives-motorcycles', type: 'CATEGORY_PRODUCTS', subtitle: 'Up to 20% Off', settings: { contentSource: 'AUTOMATIC', categoryIds: ['cmqhbt045004f1kno58pkwfwd', 'cmqhdv290006q1knoudb2ci62', 'cmqhdvif4006r1kno765hty4t', 'cmqhdxj06006t1kno7881fjp5', 'cmqhdye3m006u1kno9rlwzxvo', 'cmqhdz6dh006v1knoix3qjxu7', 'cmqhdzldd006w1knonktzbvoh', 'cmqhe01gf006x1knoy2yz9hwc'] }, displayOrder: 165 },
  { name: 'Storage & Accessories', slug: 'storage-accessories-section', type: 'CATEGORY_PRODUCTS', subtitle: 'Homes & Shops', settings: { contentSource: 'AUTOMATIC', categoryIds: ['cmqhdo04g006g1knopyukhsjk', 'cmswyi2nc00041kqsnq3dcwct', 'cmswyilmt00051kqsqazpvmvk'] }, displayOrder: 175 },
  { name: 'Sports & Fitness', slug: 'sports-fitness', type: 'CATEGORY_PRODUCTS', subtitle: 'Up to 60% Off', settings: { contentSource: 'AUTOMATIC', categoryIds: ['cmqhdabkj00611kno7k61gh8y', 'cmqhe89r900741kno9yrbe1kg', 'cmqhee24t007a1kno1ytjysaz', 'cmswyn32600061kqs8mvaoak5', 'cmqhecbbn00771knosr9fa2u0', 'cmqhe8tbk00751knos6j4q5fg', 'cmqhebuxt00761kno20ealxh0'] }, displayOrder: 185 },
  { name: 'Kids Playnest', slug: 'kids-playnest', type: 'CATEGORY_PRODUCTS', subtitle: 'Fun deals', settings: { contentSource: 'AUTOMATIC', categoryIds: ['cmqhe56th00701knooxdgd0y2', 'cmqhe6ka400711knoaes11770', 'cmqhe3kj8006z1kno46tsbaam', 'cmqhe6ya300721kno142lblx3', 'cmqhe0muq006y1knorckygvrf', 'cmqhe7cjj00731knoorxi9dfq'] }, displayOrder: 195 },
  { name: 'Black Friday Deals', slug: 'black-friday-deals', type: 'PRODUCT_GRID', subtitle: 'Our Top Friday Discounts', settings: { contentSource: 'MANUAL' }, displayOrder: 205 },
  { name: 'Shop More, Spend Less', slug: 'shop-more-spend-less', type: 'RANDOM_PRODUCTS', subtitle: 'Up to 35% Off', settings: { contentSource: 'AUTOMATIC' }, displayOrder: 355 },
];

for (const section of newSections) {
  const id = nanoid();
  const sql = `
    INSERT INTO homepage_sections (id, name, slug, type, subtitle, settings, "displayOrder", "isEnabled", "createdAt", "updatedAt")
    VALUES ($1, $2, $3, $4, $5, $6::json, $7, $8, NOW(), NOW())
    ON CONFLICT (slug) DO NOTHING
  `;
  const result = await client.query(sql, [
    id,
    section.name,
    section.slug,
    section.type,
    section.subtitle,
    JSON.stringify(section.settings),
    section.displayOrder,
    true,
  ]);
  console.log(`Upserted section: ${section.slug} (${result.rowCount > 0 ? 'created' : 'already existed'})`);
}

const verifyResult = await client.query('SELECT slug, name, type, "displayOrder" FROM homepage_sections WHERE "isEnabled" = true ORDER BY "displayOrder" ASC');
console.log('\nFinal sections:');
console.table(verifyResult.rows);

await client.end();
