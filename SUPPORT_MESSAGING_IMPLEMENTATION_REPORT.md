# Real-Time Live Messaging and Customer Support Ticket System — Implementation Report

## 1. Forensic Audit Findings (Before Implementation)

### Existing Support Infrastructure
- **SupportTicket model** already exists in `prisma/schema.prisma` at line 854.
- Existing fields: `id`, `userId`, `subject`, `message`, `type`, `status`, `priority`, `adminReply`, `createdAt`, `updatedAt`.
- Existing enums: `SupportTicketType`, `SupportTicketStatus`, `SupportTicketPriority`.
- Existing notification types already include `SUPPORT_TICKET_CREATED`, `SUPPORT_TICKET_REPLIED`, `SUPPORT_TICKET_STATUS_UPDATED`.

### Existing API Endpoints
- `GET/POST /api/support` — authenticated user ticket creation and listing.
- `GET/PATCH /api/admin/support/[id]` — admin ticket detail and status/reply updates.
- `POST /api/support-tickets` — public/help-center ticket submission.

### Existing Admin Dashboard
- `app/dashboard/admin/support/page.tsx` exists but is modal-based and not real-time.
- Admin auth via `requireAdmin()` in `lib/adminAuth.ts` supports both `ADMIN` and `SUPER_ADMIN`.

### Authentication & Authorization
- JWT-based auth with session validation in `lib/auth-middleware.ts`.
- Roles: `SUPER_ADMIN`, `ADMIN`, `VENDOR`, `CUSTOMER`.
- Guest users have no auth; cookie-based guest token strategy needed.

### Real-Time Infrastructure
- **No existing WebSocket or SSE infrastructure found.**
- Deployment target: Railway (PostgreSQL). No dedicated WebSocket server process configured.
- Decision: **SSE via ReadableStream** selected because it works within Next.js API routes, requires no extra server process, and is compatible with Railway deployment.

### UI Components
- Existing reusable components: `Button`, `Input`, `Card`, `Badge`, `Skeleton`.
- Existing floating button pattern: `WhatsAppFloatButton` — used as styling reference.
- Root layout: `app/layout.tsx` — chosen mount point for global widget.

---

## 2. Database Models

### New Models Created
- `SupportConversation` — one-to-one extension of `SupportTicket` with conversation-level state.
- `SupportMessage` — individual messages linked to a ticket/conversation.

### Schema Changes
- **Additive-only migration** applied via `prisma db execute --file` to avoid migration history conflicts.
- New tables: `support_conversations`, `support_messages`.
- New enum: `SupportMessageSenderType` (`GUEST`, `CUSTOMER`, `ADMIN`, `SUPER_ADMIN`).
- Existing `SupportTicket` model unchanged except Prisma relation fields were added for type safety.

### Migration Safety
- No `prisma migrate dev` was run against production.
- No existing data modified or deleted.
- SQL used `CREATE TABLE IF NOT EXISTS` and additive `CREATE INDEX` only.

---

## 3. Real-Time Mechanism

**Selected: Server-Sent Events (SSE) via ReadableStream**

**Why:**
- Project is hosted on Railway with Next.js app service.
- No existing WebSocket server or Redis adapter.
- SSE works over standard HTTP, survives Railway’s request model, and requires no additional infrastructure.
- Compatible with Next.js API routes using `runtime = 'nodejs'`.

**Streams Implemented:**
- `GET /api/support/conversations/[conversationRef]/stream` — customer/guest stream.
- `GET /api/admin/support/tickets/[id]/stream` — admin stream.

**Behavior:**
- Client opens stream on conversation open.
- Server polls ticket/conversation state every 3 seconds and emits `activity` and `status` events.
- Client receives event → refetches messages via REST → updates UI without page refresh.
- Automatic reconnection with 3-second backoff on failure.
- No duplicate messages after reconnect because state is always fetched from DB.

---

## 4. Guest Conversation Identity Strategy

- **Cookie:** `support_guest_token` — `httpOnly`, `secure` in production, `sameSite: 'lax'`, 1-year maxAge.
- **Token format:** 64-character hex string generated via `crypto.randomBytes(32)`.
- **Storage:** Server stores token hash-equivalent in `SupportConversation.guestToken`.
- **Validation:** Every guest message request validates cookie token matches conversation record.
- **Security:** Cryptographically secure random token; never sequential IDs; never exposed in URLs.

---

## 5. Authenticated Customer Identity Strategy

- Uses existing JWT `token` cookie and `verifyToken` from `lib/auth-middleware`.
- Conversation associated with authenticated `userId`.
- Ownership enforced server-side: customer can only access conversations where `ticket.userId === payload.userId`.

---

## 6. API Endpoints Created

### Public / Customer
- `POST /api/support/conversations` — create conversation/ticket atomically.
- `GET /api/support/conversations` — list current user/guest conversations.
- `GET /api/support/conversations/[conversationRef]/messages` — fetch message history.
- `POST /api/support/conversations/[conversationRef]/messages` — send message.
- `GET /api/support/conversations/[conversationRef]/stream` — SSE real-time updates.

### Admin
- `POST /api/admin/support/tickets/[id]/messages` — admin/super admin reply.
- `GET /api/admin/support/tickets/[id]/stream` — admin real-time ticket updates.

### Reused Existing
- `GET/POST /api/support` — authenticated ticket listing/creation.
- `GET/PATCH /api/admin/support/[id]` — admin ticket detail and status updates.

---

## 7. Floating Public Live Support Button

**Component:** `components/LiveSupportWidget.tsx`

**Mount Point:** `app/layout.tsx` — rendered inside root layout so it persists across all public pages via client-side navigation.

**Behavior:**
- Hidden on `/dashboard/**` and `/vendor/**` routes.
- Fixed position `bottom-5 right-5`, z-index 50.
- Opens compact chat panel (360px wide, max-height 500px).
- First message flow: user types issue → enters subject → creates ticket + conversation atomically.
- Subsequent messages reuse existing conversation.
- Unread badge count on floating button.
- Connection status indicator: Online / Connecting / Reconnecting.

---

## 8. Admin / Super Admin Dashboard Implementation

**Updated:** `app/dashboard/admin/support/page.tsx`

**Features:**
- Ticket list with status counts, search, filters (status, type, priority).
- Ticket detail modal with:
  - Complete conversation history from `SupportMessage`.
  - Real-time updates via SSE stream.
  - Reply composer with send button.
  - Status change dropdown with update button.
- Role support: both `ADMIN` and `SUPER_ADMIN` can view and reply via `requireAdmin()`.

**Reused:** Existing `SupportTicket` list APIs and admin auth middleware.

---

## 9. Ticket Creation Flow

1. Guest/customer opens widget, types message.
2. If no conversation exists, widget requests subject.
3. `POST /api/support/conversations` creates `SupportTicket` + `SupportConversation` + first `SupportMessage`.
4. Returns `conversationRef` to client.
5. Client stores conversation ref in state and opens chat.
6. All subsequent messages POST to `/api/support/conversations/[conversationRef]/messages`.

**Atomicity:** Single API route handles ticket creation and conversation creation sequentially; Prisma `create` calls are not wrapped in explicit transaction but ticket creation failure prevents conversation creation due to early return.

---

## 10. Real-Time Message Flow

**Customer/Guest → Admin:**
1. Customer sends message via widget.
2. Message persisted to DB via REST API.
3. Admin SSE stream polls every 3s, detects new message/status.
4. Admin UI refetches messages and ticket list.

**Admin → Customer/Guest:**
1. Admin sends reply in dashboard.
2. Message persisted to DB.
3. Customer SSE stream polls every 3s, detects new message/status.
4. Widget UI refetches messages automatically.

---

## 11. Ticket Status Lifecycle

- New conversation: `OPEN`.
- Admin replies: status stays `OPEN` or can be manually changed to `IN_PROGRESS`.
- Admin can mark `RESOLVED` or `CLOSED`.
- Customer reply to `RESOLVED`/`CLOSED` reopens to `OPEN`.
- Status changes emit via SSE to connected clients.

---

## 12. Rate Limiting & Abuse Protection

- Reuses existing `rateLimit('support-ticket')` — 10 requests/hour per IP.
- Message length capped at 5000 chars; subject capped at 200 chars.
- Empty messages rejected.
- Sanitization via `sanitizeUserContent` strips HTML and dangerous characters.

---

## 13. Privacy & Security Protections

- Guest token is `httpOnly` cookie, never exposed to JS except via server-set cookie.
- Conversation ownership validated server-side on every request.
- Admin sender type determined server-side from session; never trusted from client payload.
- No database IDs exposed unnecessarily in public APIs.
- Existing sanitization and auth middleware reused.

---

## 14. Mobile & Desktop Verification

- Widget responsive: max-width constrained, full-width fallback on small screens.
- Message bubbles use flex layout, no horizontal overflow.
- Safe-area not explicitly handled in initial version; can be enhanced if needed.
- Desktop: fixed 360px panel; Mobile: near-full-width panel.

---

## 15. Production Deployment Considerations

- **SSE selected over WebSocket** because Railway Next.js deployment does not expose persistent WebSocket infrastructure in current architecture.
- `runtime = 'nodejs'` set on stream routes to ensure Node.js runtime.
- No external real-time service introduced.
- Database migration was additive-only via raw SQL to avoid migration-history conflicts.

---

## 16. Database Safety Confirmation

- No `prisma migrate reset` used.
- No `prisma db push` used.
- No destructive migration commands.
- No existing table altered or dropped.
- New tables created with `IF NOT EXISTS`.
- Existing `support_tickets` data untouched.

---

## 17. Verification Results

| Check | Result |
|-------|--------|
| `npm run lint` | **Passed** |
| `npx tsc --noEmit` | **Passed** |
| `npm run build` | **Skipped per user request** |

---

## 18. Remaining Limitations / Manual Configuration

1. **Prisma Migration History:** New tables were created via raw SQL, not `prisma migrate dev`. If future schema changes are needed, use `prisma migrate dev` cautiously or continue with additive raw SQL migrations.
2. **Build Not Run:** `npm run build` was skipped. Run it before production deployment to verify full Next.js compilation.
3. **Admin Assignment:** `assignedAdminId` exists on `SupportConversation` but no UI for assignment was added in this phase. Can be added later.
4. **Message Pagination:** Initial implementation loads all messages. For long conversations, add cursor-based pagination.
5. **Mobile Safe-Area:** Widget does not explicitly respect `env(safe-area-inset-bottom)` on iOS. Can be enhanced.
6. **Email Notifications:** Reuses existing notification system; email delivery depends on configured Brevo/SendGrid provider.
7. **Super Admin Dashboard Section:** Super Admin reuses admin support page via `requireAdmin()`. A dedicated Super Admin section can be added later if needed.
