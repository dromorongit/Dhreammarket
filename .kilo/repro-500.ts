import 'dotenv/config'

async function main() {
  // Mirror the exact guard in lib/paystack.ts initializePaystackPayment
  const isPaystackConfigured = () => {
    const k = process.env.PAYSTACK_SECRET_KEY
    return !!k && k !== 'sk_test_your_secret_key'
  }

  console.log('[repro] PAYSTACK_SECRET_KEY =', JSON.stringify(process.env.PAYSTACK_SECRET_KEY))
  console.log('[repro] isPaystackConfigured() =', isPaystackConfigured())
  console.log('[repro] NEXT_PUBLIC_APP_URL =', JSON.stringify(process.env.NEXT_PUBLIC_APP_URL))
  console.log('[repro] APP_URL =', JSON.stringify(process.env.APP_URL))

  // Simulate the exact throw in initializeBillingPayment (billing-service.ts:25-27)
  try {
    if (!isPaystackConfigured()) {
      throw new Error('Paystack is not configured. Cannot process payment.')
    }
  } catch (e: any) {
    console.log('[repro] THROWS =>', e.message)
    console.log('[repro] billing route would return => {"error":"Internal server error"} HTTP 500')
  }
}

main()
