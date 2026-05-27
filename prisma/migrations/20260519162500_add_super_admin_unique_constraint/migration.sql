-- This migration is now idempotent to handle databases that already have this index
CREATE UNIQUE INDEX IF NOT EXISTS only_one_super_admin ON "users" (role) WHERE role = 'SUPER_ADMIN';