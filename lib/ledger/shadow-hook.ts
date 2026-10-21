// Shadow write of the corrective ledger into refund settlement.
//
// The write is feature-flagged (LEDGER_SHADOW_WRITE) and failure-tolerant:
// with the flag off it returns before touching the database; with the flag on
// it records the vendor clawback and swallows every error so a ledger problem
// can never fail a refund.
import { isLedgerShadowWriteEnabled } from '@/lib/feature-flags'
import { logDebug, logError } from '@/lib/logger'
import { recordRefundClawback, type LedgerClient } from './corrective-ledger'

/**
 * Record the vendor clawback for a refund after the settlement transaction
 * that marked it PROCESSED has committed.
 *
 * The caller is responsible for invoking this only after commit and only when
 * this call performed the transition to PROCESSED - see the "Shadow hook
 * wiring" section of docs/corrective-ledger/DESIGN.md.
 *
 * Never throws and never rejects: every error from the ledger is caught and
 * logged (refund id and error message only) so the settlement path is never
 * broken by the ledger. No transaction is opened here.
 */
export async function recordClawbackAfterSettlement(
  client: LedgerClient,
  refundId: string
): Promise<void> {
  if (!isLedgerShadowWriteEnabled()) return

  try {
    const result = await recordRefundClawback(client, refundId)
    logDebug('Shadow ledger: refund clawback recorded', { refundId, status: result.status })
  } catch (error) {
    logError('Shadow ledger: refund clawback failed', error, { refundId })
  }
}
