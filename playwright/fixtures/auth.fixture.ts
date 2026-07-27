import { type Page } from '@playwright/test'

export class AuthFixture {
  constructor(private page: Page) {}

  async register(email: string, password: string, role: 'CUSTOMER' | 'VENDOR' = 'CUSTOMER', name?: string) {
    await this.page.goto('/register')
    await this.page.getByLabel('Email address').fill(email)
    await this.page.getByLabel('Mobile Number').fill('0242222222')

    if (role === 'CUSTOMER') {
      await this.page.getByLabel('Customer - Browse and purchase products').check()
      if (name) {
        await this.page.getByLabel('Full Name').fill(name)
      }
    } else {
      await this.page.getByLabel('Vendor - Sell products and manage your store').check()
    }

    await this.page.getByLabel('Password').fill(password)
    await this.page.getByLabel('Confirm Password').fill(password)
    await this.page.getByLabel(/I agree to the/).check()
    await this.page.getByRole('button', { name: 'Create account' }).click()

    await this.page.waitForURL(/\/(dashboard|customer|vendor|verify-email)/, { timeout: 30000 }).catch(() => {})
  }

  async login(email: string, password: string) {
    await this.page.goto('/login')
    await this.page.getByLabel('Email address').fill(email)
    await this.page.getByLabel('Password').fill(password)
    await this.page.getByRole('button', { name: 'Sign in' }).click()

    await this.page.waitForURL(/\/(dashboard|customer|vendor|admin|super-admin)/, { timeout: 30000 }).catch(() => {})
  }

  async logout() {
    const avatarButton = this.page.locator('button[aria-haspopup="true"]').first()
    if (await avatarButton.isVisible({ timeout: 5000 }).catch(() => false)) {
      await avatarButton.click()
      await this.page.getByRole('button', { name: 'Sign Out' }).click()
      await this.page.waitForURL('/', { timeout: 10000 }).catch(() => {})
    }
  }

  async getAuthToken(): Promise<string | null> {
    const cookies = await this.page.context().cookies()
    return cookies.find(c => c.name === 'token')?.value ?? null
  }
}
