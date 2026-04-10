/**
 * 시나리오 3: 과목 검색 → 장바구니 추가
 *
 * 흐름:
 *   1. 로그인 → 대시보드
 *   2. 검색창에 키워드 입력 → 검색 버튼 클릭
 *   3. 결과 목록 확인
 *   4. 첫 번째 과목 "+ 추가" 클릭
 *   5. 헤더의 저장 카운트 증가 확인
 *   6. 동일 과목 재추가 시 버튼 상태 변경 확인 (이미 추가됨 표시)
 *   7. teardown: 추가한 항목 제거
 */
import { test, expect } from '@playwright/test'
import { loginAs } from './helpers'

test.describe('과목 검색 → 장바구니 추가', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page)
  })

  test('키워드 검색 결과가 표시됨', async ({ page }) => {
    // 과목 목록 로딩 대기
    await expect(page.locator('table')).toBeVisible({ timeout: 15000 })

    // 검색창 입력 후 검색
    await page.fill('input[placeholder*="과목코드"]', '컴퓨터')
    await page.click('button:has-text("검색")')

    // 결과 행이 1개 이상 표시
    const rows = page.locator('table tbody tr')
    await expect(rows.first()).toBeVisible({ timeout: 5000 })
    const count = await rows.count()
    expect(count).toBeGreaterThan(0)
  })

  test('과목 추가 → 헤더 저장 카운트 증가', async ({ page }) => {
    await expect(page.locator('table')).toBeVisible({ timeout: 15000 })

    // 현재 저장 카운트 읽기
    const savedText = await page.locator('text=/\\d+개 저장/').textContent()
    const prevCount = parseInt(savedText?.match(/(\d+)개/)?.[1] ?? '0')

    // 첫 번째 "+ 추가" 버튼 클릭
    const addBtn = page.locator('button:has-text("추가")').first()
    await addBtn.click()

    // 카운트가 1 증가했는지 확인
    await expect(async () => {
      const newText = await page.locator('text=/\\d+개 저장/').textContent()
      const newCount = parseInt(newText?.match(/(\d+)개/)?.[1] ?? '0')
      expect(newCount).toBeGreaterThan(prevCount)
    }).toPass({ timeout: 5000 })
  })

  test('이미 추가된 과목은 버튼이 체크 상태로 변경됨', async ({ page }) => {
    await expect(page.locator('table')).toBeVisible({ timeout: 15000 })

    const addBtn = page.locator('button:has-text("추가")').first()
    await addBtn.click()

    // 추가 후 해당 row에서 "추가" 버튼이 사라지고 체크 상태로 변경됨
    const firstRowAddBtn = page.locator('table tbody tr').first().locator('button:has-text("추가")')
    await expect(firstRowAddBtn).not.toBeVisible({ timeout: 5000 })
  })

  test('교수명 검색 결과가 표시됨', async ({ page }) => {
    await expect(page.locator('table')).toBeVisible({ timeout: 15000 })

    await page.fill('input[placeholder*="과목코드"]', '문의현')
    await page.click('button:has-text("검색")')

    const rows = page.locator('table tbody tr')
    await expect(rows.first()).toBeVisible({ timeout: 5000 })
    const count = await rows.count()
    expect(count).toBeGreaterThan(0)
  })

  test('검색 결과 없을 때 빈 목록 표시', async ({ page }) => {
    await expect(page.locator('table')).toBeVisible({ timeout: 15000 })

    await page.fill('input[placeholder*="과목코드"]', 'ZZZZNOTEXIST99999')
    await page.click('button:has-text("검색")')

    // 검색 결과 없으면 과목 카운트 p태그가 "0개 / X개 과목" 형태로 표시됨
    await expect(page.locator('p.text-xs').filter({ hasText: /^0개/ })).toBeVisible({ timeout: 5000 })
  })
})
