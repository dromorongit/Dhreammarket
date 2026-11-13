-- Support AI v2: speed up conversation ownership lookups by conversationId in audit logs.
-- Partial expression index for SUPPORT_AI_V2_CHAT rows.
CREATE INDEX IF NOT EXISTS "audit_logs_support_ai_v2_chat_conversation_idx"
ON "audit_logs" (("afterData"->>'conversationId'))
WHERE "action" = 'SUPPORT_AI_V2_CHAT';
