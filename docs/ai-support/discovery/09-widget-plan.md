# STAGE_H_WIDGET_WIRING_PLAN — Support AI widget v1/v2 wiring plan

**Repo:** Dhream Market main app, branch `release/policy-copy` (Next.js 14 + Prisma).  
**Mode:** Read-only plan document only. No code changes, no migrations, no `.env` values, no build, no push.  
**Related:** `docs/ai-support/discovery/07-copy-change-sheet.md`, `docs/ai-support/discovery/08-legal-proposals-for-lawyer.md`, `audit/02-architecture.md`.

---

## 1. Current widget

**File:** `components/support-ai/support-chat-widget.tsx` (`'use client'`).  
**Mount:** `app/layout.tsx:70` — `<SupportChatWidget userRole={session?.role ?? null} />`, session loaded at `app/layout.tsx:51` via `getServerSession()` (`lib/auth.ts:56`). Renders `null` for `ADMIN`/`SUPER_ADMIN` (`support-chat-widget.tsx:122`).

**What it does:** Fixed bottom-right bubble (`fixed bottom-24 right-5`, panel `w-[360px] max-w-[calc(100vw-40px)]`). Two views: AI chat (`/api/support-ai/chat`, v1) and "Live Support" (`LiveSupportConversation`, streams `/api/support/conversations/[ref]/stream`).

**v1 endpoint it calls:** `POST /api/support-ai/chat` (`app/api/support-ai/chat/route.ts`), body `{ message }`, `credentials: 'include'`. No auth check in the route itself; the v1 engine (`lib/support-ai/engine`) receives the `token` cookie. Response shape (`lib/support-ai/types.ts`): `{ intentMatched, response, confidence, suggestedEscalation }`. The widget renders `data.response` as the bot message, stores `confidence` and `suggestedEscalation` on the message.

**Loading:** local `loading` state; skeleton bubbles while in flight; input disabled while loading.

**Errors:** any fetch/JSON failure → catch block appends one bot fallback message ("Something went wrong... contact our support team: WhatsApp <link>") with `suggestedEscalation: true`; `error` state also shown near the form. No distinction between 4xx/5xx/network.

**Slow or offline networks:** `fetch` has no timeout and no retry. A hung or offline request leaves `loading === true` indefinitely (input disabled, skeleton shown forever) until the page is refreshed. No offline indicator, no RequestIdleCallback/navigator.onLine handling.

**Greeting/notice:** `GREETING` lists what the AI can help with, including "Order status lookups (log in required)" and "Payout/onboarding status (log in required)". WhatsApp link `https://wa.me/447869840464/` (`lib/support-ai/knowledge-base.ts:290`), email `support@dhreamarket.com`.

---

## 2. v2 route contract today

**Files:** `app/api/support-ai/v2/chat/route.ts`, `app/api/support-ai/v2/feedback/route.ts`, pipeline `lib/support-ai-v2/src/pipeline/handle-message.ts`, ports `lib/support-ai-v2/ports.ts`, types `lib/support-ai-v2/src/types.ts`.

**Request (chat):** `POST /api/support-ai/v2/chat`, body `{ message: string, conversationId?: string }`. Message must be a non-empty string ≤ 2000 chars (400 otherwise). `conversationId` is client-supplied; if missing/empty the server generates `req_<ts>_<random>`. History is never sent (`loadHistory: () => []`).

**Sessions / logged-out vs logged-in:**
- Kill switch first (see below), then rate limit (`support-ai-chat`: 20 req / 60 s, keyed by IP when no session), then **session required**: `getServerSession()` → 401 `{ error: 'Authentication required.' }` when there is no active session. **Logged-out visitors cannot use v2 today** (401). Logged-in users: `userId` + `role` from the verified session; role comes from the session only, never from message text (`resolve-role`). Actor role mapped to v2 roles `visitor | buyer | vendor | support_agent`.

**Kill switch:** `supportAiV2Enabled()` — hard env override `SUPPORT_AI_V2_ENABLED` ("true"/"false"), else `SuperAdminSettings.supportAiV2Enabled` (default `false`). When off: HTTP 200 `{ action: 'ESCALATE', message: HUMAN_SUPPORT_FALLBACK_MESSAGE, reasonCode: 'SYSTEM_ERROR', traceId }` — no retrieval, no LLM call.

**Rate limit:** 429 `{ error: 'Too many requests...', resetTime }` with `Retry-After`, `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset` headers. Reuses the `support-ai-chat` config (20/min per IP).

**Response shapes (HTTP 200 unless noted):** `SupportResponse = { action: 'ANSWER' | 'CLARIFY' | 'ESCALATE' | 'REFUSE', message: string, reasonCode: string, traceId: string, escalationTag?: string }`.
- **ANSWER:** `message` = approved document content + `\n\nSource: <title>` (ports generator), `reasonCode: 'ANSWERED'`.
- **ESCALATE:** `message` = escalation template, `reasonCode` (e.g. `POLICY_GAP`, `HIGH_RISK`, `VALIDATION_FAILURE`), `escalationTag`; an `EscalationPort` creates a `SupportTicket` (`subject: 'Support AI v2: <tag>'`, type GENERAL, priority mapped, `userId` when authenticated).
- **REFUSE:** `reasonCode` e.g. `SECURITY_BLOCK`, `OUT_OF_SCOPE`; refusal template message.
- **CLARIFY:** `reasonCode: 'CLARIFY'`; ask-for-detail template.
- **Kill switch off:** `action: 'ESCALATE'`, `reasonCode: 'SYSTEM_ERROR'`, human fallback message, HTTP 200.
- **500:** `{ error: 'Internal server error. Please try again later.' }` (errors sanitized, raw messages never leaked).
- **401:** unauthenticated. **400:** invalid input. **429:** rate limited.

**Feedback:** `POST /app/api/support-ai/v2/feedback`, body `{ conversationId, traceId, helpful: boolean, reason?: string ≤ 500 }` → `supportFeedback.create` + audit log `SUPPORT_FEEDBACK_RECEIVED` (only when authenticated). Works without a session (`userId` null, no audit). 429 reuses `support-ai-chat` config.

**Pipeline redaction (API edge):** `redact()` replaces card numbers (Luhn-valid 13–19 digits), Ghana Card `GHA-...`, emails, Ghana phones/momo, OTP/PIN/password/CVV phrases and bare 3–8 digit secrets with placeholders (`[CARD_REDACTED]`, `[OTP_REDACTED]`, `[PIN_REDACTED]`, `[PASSWORD_REDACTED]`, `[CVV_REDACTED]`, `[PHONE_REDACTED]`, `[EMAIL_REDACTED]`, `[ID_REDACTED]`). `secretExposed` true for card/otp/pin/password/cvv. A security scan block (prompt injection, exfiltration, unauthorized access, etc.) → `REFUSE` `SECURITY_BLOCK`. All port/audit payloads receive redacted text only.

---

## 3. Safe v1/v2 switch (server-driven)

**Requirement:** v1 stays default; v2 opt-in without redeploy; v2 failure never falls back to v1 answers.

**Proposed switch:** a tiny public config endpoint `GET /app/api/support-ai/config/route.ts` (NEW) returning `{ v2Enabled: boolean }`, computed server-side per request:
1. `process.env.SUPPORT_AI_V2_ENABLED` — when set, hard override (no DB read).
2. Else `SuperAdminSettings.supportAiV2Enabled` (default `false`).

The widget (client component) fetches this on mount; alternatively `app/layout.tsx` (server component, already fetches session) can compute the flag and pass it as a prop to `SupportChatWidget` at line 70. Either way no secret is leaked to the client (only a boolean).

**Behaviour matrix:**

| v2 switch | Widget path | v2 error / kill-switch off |
|---|---|---|
| off | v1 (`/api/support-ai/chat`) | — (v1 unchanged) |
| on | v2 (`/api/support-ai/v2/chat`) | Show human-support message (WhatsApp/email/Dashboard > Help). **Never retry with v1** — avoids mixing policy sources. Offer "Talk to human support". |

**Failure behaviour on v2 error:** network failure, 500, or unexpected shape → single bot message: human-support fallback + escalation button; `loading` cleared; input re-enabled. No silent retry, no v1 fallback.

**Open question (for the founder):** since v2 requires authentication (401), should the v2 switch apply only to logged-in users while logged-out visitors stay on v1, or should v2 gain a guest-session path?

---

## 4. UI requirements to implement

**Files to change:**
- `components/support-ai/support-chat-widget.tsx` — main rework
- `components/support-ai/support-chat-message.tsx` — answer/source/feedback rendering
- `app/layout.tsx:70` — pass v2 flag (or widget fetches `/api/support-ai/config`)
- `app/api/support-ai/config/route.ts` — NEW public config endpoint
- Tests: `components/support-ai/support-chat-widget.test.tsx` (NEW), `app/api/support-ai/config/route.test.ts` (NEW); extend `app/api/support-ai/v2/chat/route.test.ts` and `.../feedback/route.test.ts`

**Details:**
1. Mobile-first: keep `max-w-[calc(100vw-40px)]`, touch-friendly inputs, no layout shift on load.
2. Low-bandwidth: no new heavy deps; small JSON bodies; fetch with timeout (e.g. 8–10 s) and retry-offline recovery (refresh hint); disable input only for the in-flight request.
3. Answer with source title: display v2 `message`; when it ends with `Source: <title>` show "Source: <title>" next to the answer.
4. "Was this helpful?": thumbs up/down under every AI answer; optional reason text (≤ 500 chars) POSTed to `/api/support-ai/v2/feedback` with `conversationId` and `traceId` from the v2 response; optimistic "Thanks" confirmation; errors surfaced without breaking the chat.
5. "Talk to human support" button on every answer and on every escalation message (not only at the bottom of the AI view).
6. Escalation: creates a `SupportTicket` through the existing `EscalationPort` (`lib/support-ai-v2/ports.ts:135`) with the conversation reference (wire `conversationId`/`traceId` into the ticket subject or `conversationRef`); customer shown ticket reference.
7. Safety notice under the input: "This assistant shares general help information only. It cannot see or change your orders, account, or payments. Don't type passwords, OTPs, card numbers or ID numbers." — plus a short redaction warning example ("Card numbers, OTPs, PINs, passwords and IDs are automatically redacted before they reach the assistant.").

---

## 5. Human handoff

**Reuse existing flow:**
- Authenticated `/contact`-style ticket creation: `POST /api/support` (`app/api/support/route.ts:77`) — token auth, `supportTicket.create`, notifications to all `ADMIN`/`SUPER_ADMIN` users.
- Conversations: `POST/GET /api/support/conversations` creates `SupportTicket` + `SupportConversation` with `conversationRef` (32-char) and `guestToken` for guests (`app/api/support/conversations/route.ts`); guest identity via `support_guest_token` cookie; stream + messages routes resolve by `conversationRef` + guest token or userId.
- Admin inbox: `app/dashboard/admin/support/page.tsx` fetches `/api/admin/support` (`app/api/admin/support/route.ts`); admin ticket detail/reply at `app/api/admin/support/[id]/route.ts`, messages at `app/api/admin/support/[id]/messages/route.ts`, stream at `app/api/admin/support/[id]/stream/route.ts`.

**v2 escalation lands in the same tables:** `SupportTicket` (subject `Support AI v2: <tag>`), `SupportFeedback` (`conversationId`, `traceId`, `helpful`, `reason`, `userId`), audit log `SUPPORT_AI_V2_CHAT` / `SUPPORT_TICKET_CREATED`.

**Who sees it:** `ADMIN` and `SUPER_ADMIN` (admin support page, ticket notifications). Widget already hides from `ADMIN`/`SUPER_ADMIN`.

**What the customer is shown after escalating (draft wording only — no invented response times):** "Your message has been sent to our support team. Reference: <ticket id>. A support team member will pick it up — you'll see replies here. For urgent help, WhatsApp <link>." Do not promise minutes/hours.

**Open question:** does the founder want a displayed SLA/response-time line, or should we deliberately avoid one?

---

## 6. Redaction and safety at the UI edge

**UI warning (to add):** helper text under the widget input: "Don't type passwords, OTPs, card numbers, ID numbers (e.g. Ghana Card) or mobile-money PINs." Plus the redaction note above. Client-side hint only — the server is authoritative.

**What the API does today (v2):** `redact()` (`lib/support-ai-v2/src/sanitize/redact.ts`) substitutes placeholders; `secretExposed` (card/otp/pin/password/cvv) feeds risk assessment; `scan()` blocks prompt injection / exfiltration / unauthorized access → `REFUSE` `SECURITY_BLOCK`. Validity limits: ≤ 2000 chars; bare secrets detected as 3–8 digit values near secret keywords (orders/prices excluded). Known gap: street addresses are NOT detected (`redact.ts:257` TODO). V1 redaction behaviour is not covered by the files reviewed — confirm before shipping v2 to v1 switch.

---

## 7. Admin and support-agent visibility

**SUPER_ADMIN / ADMIN can read today:**
- `SupportTicket` via `GET /api/admin/support` (filters: status, type, priority, search) and the admin support page — includes v2 escalation tickets (subject `Support AI v2: <tag>`).
- `SupportConversation` / `SupportMessage` per ticket via `GET /api/admin/support/[id]/messages`.
- v2 audit events: `auditLog` entries `action: 'SUPPORT_AI_V2_CHAT'` with `afterData { state, reasonCodes, intent, riskLevel, role, conversationId, confidence, retrievalSources }` and `SUPPORT_TICKET_CREATED` (only when `userId` exists — logged-out visitors produce none).
- `SupportFeedback`: `conversationId`, `traceId`, `helpful`, `reason`, `userId`, `createdAt`.

**What is missing:**
- No read API or admin UI for `supportFeedback` (write-only route today); no join view of feedback → traceId → audit event → ticket.
- v2-created tickets do not store `conversationRef` (`ports.ts` escalate does not set it), so tracing a feedback/traceId to its ticket is hard.
- No admin view of v2 kill-switch state or rate-limit hits.
- No way to see which approved document (`supportDocument.title`, version) was used per answer (audit `retrievalSources` is stored but not exposed).

---

## 8. Test plan

**Unit / component (vitest):**
- `support-chat-widget.test.tsx`: v1 vs v2 path selected by config flag; feedback thumbs POST payload (`conversationId`, `traceId`, `helpful`, `reason`); human button rendered under answer and escalation messages; v2 error → human fallback, never v1; loading cleared after timeout/failure.
- `app/api/support-ai/config/route.test.ts`: env override true/false; SuperAdminSettings flag true/false; default false when env unset.
- API (existing, extend): `v2/chat/route.test.ts` — add kill-switch (env + flag), 401, 429 with Retry-After, answer-with-source, escalation ticket create with userId, security-block refuse; `v2/feedback/route.test.ts` — existing coverage plus unauthenticated feedback and missing conversation-ref linkage.

**E2E (playwright):**
- Seed one approved `supportDocument` via `prisma/seed.ts` (e.g. delivery/returns intent, status APPROVED/PUBLISHED, known content).
- Flow: open widget → ask seeded question → v2 on: answer + "Source: <title>" visible → thumbs down + reason → feedback stored (assert via API or DB) → "Talk to human support" → ticket created with v2 tag → toggle kill-switch off → same question returns human fallback, no retrieval.

**Kill-switch / rate-limit checks:** toggle `SUPPORT_AI_V2_ENABLED=false` and SuperAdminSettings flag → HTTP 200 escalation fallback without retrieval; 21st request in 60 s → 429 + Retry-After.

---

## 9. Proposed order of steps (effort / risk)

1. Add `GET /app/api/support-ai/config/route.ts` + unit test (S / low).
2. Wire flag into widget via layout prop or config fetch; keep v1 default (S / low).
3. v2 answer UI: source title, human button under every answer/escalation, safety + redaction notice (M / medium — message parsing).
4. Feedback thumbs + reason POST to v2 feedback endpoint (S / low).
5. Escalation wiring: pass `conversationId`/`traceId` into EscalationPort ticket; consider `conversationRef` on ticket (M / medium — schema touch).
6. Logged-out decision + guest path if founder wants v2 for visitors (L / high — auth boundary).
7. Admin visibility: feedback read route/listing + audit join view (M / medium).
8. E2E with seeded document; kill-switch and rate-limit checks (M / low).

**Risks:** v2 requires session (blocks logged-out users); no fetch timeout can hang the UI; mixing v1 and v2 answers in one conversation would confuse customers (hence never-fallback-to-v1 rule); in-memory rate limit not shared across instances; `conversationRef` not stored on v2 tickets weakens audit traceability.

**Question for the founder:** Should v2 be available to logged-out visitors (requires adding a guest/session path to `/api/support-ai/v2/chat`, today it returns 401), or should the v1/v2 switch apply only to logged-in customers? Also: do we want to avoid publishing any response-time SLA after escalation?
