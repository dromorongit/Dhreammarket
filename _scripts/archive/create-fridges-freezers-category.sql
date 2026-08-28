INSERT INTO product_categories (name, slug, parent_id, is_active)
VALUES ('Fridges and Freezers', 'fridges-freezers', 'cmqhbs8gb004d1knomlti1y9b', true)
ON CONFLICT (slug) DO NOTHING;
