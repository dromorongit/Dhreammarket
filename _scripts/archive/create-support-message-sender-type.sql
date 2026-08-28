-- Create SupportMessageSenderType enum if it does not exist
-- This enum is referenced by the SupportMessage.senderType column in prisma/schema.prisma

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'SupportMessageSenderType') THEN
    CREATE TYPE "SupportMessageSenderType" AS ENUM ('GUEST', 'CUSTOMER', 'ADMIN', 'SUPER_ADMIN');
  END IF;
END
$$;
