-- Deduplicate category slugs before adding unique constraint
-- This keeps the first occurrence of each slug and appends "-copy-N" to duplicates

WITH duplicates AS (
    SELECT 
        id,
        slug,
        ROW_NUMBER() OVER (PARTITION BY slug ORDER BY createdAt ASC) AS rn
    FROM categories
    WHERE slug IS NOT NULL
)
UPDATE categories
SET slug = categories.slug || '-' || duplicates.rn
FROM duplicates
WHERE categories.id = duplicates.id
  AND duplicates.rn > 1;

-- Add unique constraint on slug column
CREATE UNIQUE INDEX IF NOT EXISTS categories_slug_key ON categories (slug);
