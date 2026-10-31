import 'dotenv/config'
import { getPrisma } from '@/lib/prisma'
import fs from 'fs'

async function main() {
  const prisma = getPrisma()
  const rows = await prisma.waitlistSignup.findMany({
    orderBy: { createdAt: 'asc' },
  })

  const header = ['id', 'full_name', 'email', 'phone', 'interest', 'device', 'source', 'utm_medium', 'utm_campaign', 'created_at', 'notified_at']
  const lines = [header.join(',')]
  for (const r of rows) {
    const vals = [
      r.id,
      `"${(r.fullName || '').replace(/"/g, '""')}"`,
      r.email,
      r.phone ? `"${r.phone.replace(/"/g, '""')}"` : '',
      r.interest,
      r.device || '',
      r.source || '',
      r.utmMedium || '',
      r.utmCampaign || '',
      r.createdAt.toISOString(),
      r.notifiedAt ? r.notifiedAt.toISOString() : '',
    ]
    lines.push(vals.join(','))
  }

  const out = 'waitlist-export.csv'
  fs.writeFileSync(out, lines.join('\n'))
  console.log(`Exported ${rows.length} signups to ${out}`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
