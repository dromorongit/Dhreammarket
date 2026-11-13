import { getPrisma } from '@/lib/prisma'

/** Kill switch: env override is hard, otherwise the SuperAdminSettings flag (default off). */
export async function supportAiV2Enabled(): Promise<boolean> {
  const envOverride = process.env.SUPPORT_AI_V2_ENABLED
  if (envOverride !== undefined && envOverride !== '') {
    return envOverride.trim().toLowerCase() === 'true'
  }
  try {
    const settings = await getPrisma().superAdminSettings.findFirst()
    return settings?.supportAiV2Enabled === true
  } catch {
    return false
  }
}

