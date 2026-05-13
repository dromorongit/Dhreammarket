-- AddPasswordResetFields  
ALTER TABLE users ADD COLUMN resetPasswordToken TEXT  
ALTER TABLE users ADD COLUMN resetPasswordExpires TIMESTAMP(3)  
CREATE INDEX users_resetPasswordToken_idx ON users(resetPasswordToken);  
