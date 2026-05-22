DO $$
BEGIN
    -- Check if slug column exists in categories table
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'categories' AND column_name = 'slug'
    ) THEN
        -- Add slug column if it doesn't exist
        ALTER TABLE categories ADD COLUMN slug VARCHAR(255);
        
        -- Populate slug from name (lowercase, replace spaces with hyphens, remove special chars)
        UPDATE categories
        SET slug = LOWER(REGEXP_REPLACE(TRIM(name), '[^a-z0-9]+', '-', 'g'))
        WHERE slug IS NULL;
        
        -- Ensure no empty slugs (set to id-based slug if name results in empty)
        UPDATE categories
        SET slug = 'category-' || id
        WHERE slug IS NULL OR slug = '' OR slug = '-';
    END IF;
END $$;

-- Now handle duplicates and add unique constraint
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
