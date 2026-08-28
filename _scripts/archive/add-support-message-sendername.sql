-- Add senderName column to support_messages
-- Allows storing the display name of the message sender (e.g. admin's real name)
-- so it can be shown in the chat UI instead of generic "Support Agent" labels.

BEGIN;

ALTER TABLE "support_messages"
  ADD COLUMN IF NOT EXISTS "senderName" TEXT DEFAULT NULL;

COMMIT;
