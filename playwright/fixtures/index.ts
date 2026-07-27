import { test as base } from '@playwright/test'
import { AuthFixture } from './auth.fixture'

type Fixtures = {
  auth: AuthFixture
}

export const test = base.extend<Fixtures>({
  auth: async ({ page }, use) => {
    await use(new AuthFixture(page))
  },
})

export { expect } from '@playwright/test'
