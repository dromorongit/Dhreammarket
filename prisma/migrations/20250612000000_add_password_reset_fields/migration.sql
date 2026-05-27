-- AddPasswordResetFields
-- This migration is now idempotent to handle databases that already have these columns
ALTER TABLE users ADD COLUMN IF NOT EXISTS resetPasswordToken TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS resetPasswordExpires TIMESTAMP(3);
CREATE INDEX IF NOT EXISTS users_resetPasswordToken_idx ON users(resetPasswordToken);  
