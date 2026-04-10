/**
 * 시나리오 1: 로그인 흐름
 * - 정상 로그인 → 대시보드 이동 + JWT 저장 확인
 * - 잘못된 비밀번호 → 에러 메시지 표시
 * - 미로그인 상태로 보호 페이지 접근 → 로그인으로 리다이렉트
 */
import { test, expect } from '@playwright/test'
import { TEST_USER, loginAs } from './helpers'

test.describe('로그인 흐름', () => {
  test('정상 로그인 → 대시보드 이동 및 JWT 저장', async ({ page }) => {
    await loginAs(page)

    // 대시보드 도달 확인
    await expect(page).toHaveURL('/')

    // JWT 토큰이 localStorage에 저장됐는지 확인
    const token = await page.evaluate(() => localStorage.getItem('access_token'))
    expect(token).not.toBeNull()

    // 헤더에 사용자 이름 표시 확인
    await expect(page.getByText('로그아웃')).toBeVisible()
  })

  test('잘못된 비밀번호 → 에러 메시지 표시', async ({ page }) => {
    await page.goto('/login')
    await page.fill('#email', TEST_USER.email)
    await page.fill('#password', 'wrongpassword!')
    await page.click('button[type="submit"]')

    // 에러 메시지가 화면에 표시되어야 함 (로그인 실패 시 p 태그 에러 텍스트)
    await expect(page.locator('p').filter({ hasText: /로그인|비밀번호|실패|올바르지/ })).toBeVisible({ timeout: 5000 })
    // 로그인 페이지에 그대로 있어야 함
    await expect(page).toHaveURL('/login')
  })

  test('미로그인 상태로 대시보드 접근 → /login 리다이렉트', async ({ page }) => {
    // localStorage 비운 상태로 / 접근
    await page.goto('/')
    await page.evaluate(() => localStorage.removeItem('access_token'))
    await page.goto('/')
    await page.waitForURL('/login', { timeout: 5000 })
    await expect(page).toHaveURL('/login')
  })

  test('로그아웃 → 로그인 페이지로 이동', async ({ page }) => {
    await loginAs(page)
    await page.click('button:has-text("로그아웃")')
    await page.waitForURL('/login', { timeout: 5000 })
    await expect(page).toHaveURL('/login')
  })
})
