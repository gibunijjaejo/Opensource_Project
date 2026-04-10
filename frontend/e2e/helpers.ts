import { Page } from '@playwright/test'

// 테스트 전용 계정 (pytest conftest의 test_user와 동일)
export const TEST_USER = {
  email: 'test9999999@sogang.ac.kr',
  password: 'TestPass123!',
}

/**
 * 로그인 후 대시보드(/)로 이동하는 공통 헬퍼
 */
export async function loginAs(page: Page, email = TEST_USER.email, password = TEST_USER.password) {
  await page.goto('/login')
  await page.fill('#email', email)
  await page.fill('#password', password)
  await page.click('button[type="submit"]')
  await page.waitForURL('/', { timeout: 10000 })
}
