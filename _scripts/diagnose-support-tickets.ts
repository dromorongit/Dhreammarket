import { Pool } from 'pg'
require('dotenv').config({ path: '.env' })

async function diagnoseSupport() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 1,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
    ssl: { rejectUnauthorized: false },
  })

  try {
    // 1. Count rows in each support table
    const ticketCount = await pool.query('SELECT COUNT(*) FROM "support_tickets"')
    const conversationCount = await pool.query('SELECT COUNT(*) FROM "support_conversations"')
    const messageCount = await pool.query('SELECT COUNT(*) FROM "support_messages"')

    console.log('=== ROW COUNTS ===')
    console.log(`support_tickets:      ${ticketCount.rows[0].count}`)
    console.log(`support_conversations: ${conversationCount.rows[0].count}`)
    console.log(`support_messages:     ${messageCount.rows[0].count}`)

    // 2. Last 10 tickets ordered by createdAt desc
    console.log('\n=== LAST 10 SUPPORT TICKETS (createdAt desc) ===')
    const lastTickets = await pool.query(`
      SELECT id, "userId", subject, type, status, priority, "assignedAdminId", "createdAt", "updatedAt"
      FROM "support_tickets"
      ORDER BY "createdAt" DESC
      LIMIT 10
    `)
    console.table(lastTickets.rows)

    // 3. Status distribution
    console.log('\n=== TICKET STATUS DISTRIBUTION ===')
    const statusDist = await pool.query(`
      SELECT status, COUNT(*) as count
      FROM "support_tickets"
      GROUP BY status
      ORDER BY count DESC
    `)
    console.table(statusDist.rows)

    // 4. Type distribution
    console.log('\n=== TICKET TYPE DISTRIBUTION ===')
    const typeDist = await pool.query(`
      SELECT type, COUNT(*) as count
      FROM "support_tickets"
      GROUP BY type
      ORDER BY count DESC
    `)
    console.table(typeDist.rows)

    // 5. Tickets with NULL userId (guest submissions)
    console.log('\n=== TICKETS WITH NULL userId (guest submissions) ===')
    const guestTickets = await pool.query(`
      SELECT id, subject, status, type, "createdAt"
      FROM "support_tickets"
      WHERE "userId" IS NULL
      ORDER BY "createdAt" DESC
      LIMIT 10
    `)
    console.table(guestTickets.rows)

    // 6. Last 10 conversations
    console.log('\n=== LAST 10 SUPPORT CONVERSATIONS (lastMessageAt desc) ===')
    const lastConversations = await pool.query(`
      SELECT id, "ticketId", "conversationRef", "guestToken", "customerType", status, "assignedAdminId", "lastMessageAt", "createdAt"
      FROM "support_conversations"
      ORDER BY "lastMessageAt" DESC
      LIMIT 10
    `)
    console.table(lastConversations.rows)

    // 7. Last 10 messages
    console.log('\n=== LAST 10 SUPPORT MESSAGES (createdAt desc) ===')
    const lastMessages = await pool.query(`
      SELECT id, "ticketId", "senderType", "senderId", LEFT("message", 50) as message_preview, "createdAt"
      FROM "support_messages"
      ORDER BY "createdAt" DESC
      LIMIT 10
    `)
    console.table(lastMessages.rows)

    // 8. Check for orphan conversations (no matching ticket)
    console.log('\n=== ORPHAN CONVERSATIONS (conversation with no matching ticket) ===')
    const orphanConversations = await pool.query(`
      SELECT c.id, c."ticketId", c."conversationRef"
      FROM "support_conversations" c
      LEFT JOIN "support_tickets" t ON c."ticketId" = t.id
      WHERE t.id IS NULL
    `)
    console.table(orphanConversations.rows)

    // 9. Check for orphan messages (no matching ticket)
    console.log('\n=== ORPHAN MESSAGES (message with no matching ticket) ===')
    const orphanMessages = await pool.query(`
      SELECT m.id, m."ticketId"
      FROM "support_messages" m
      LEFT JOIN "support_tickets" t ON m."ticketId" = t.id
      WHERE t.id IS NULL
    `)
    console.table(orphanMessages.rows)

    // 10. Check tickets created in last 24 hours
    console.log('\n=== TICKETS CREATED IN LAST 24 HOURS ===')
    const recentTickets = await pool.query(`
      SELECT id, "userId", subject, status, type, "createdAt"
      FROM "support_tickets"
      WHERE "createdAt" > NOW() - INTERVAL '24 hours'
      ORDER BY "createdAt" DESC
    `)
    console.table(recentTickets.rows)

  } catch (error) {
    console.error('Error querying database:', error)
    process.exit(1)
  } finally {
    await pool.end()
  }
}

diagnoseSupport()
