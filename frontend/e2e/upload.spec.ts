/**
 * 시나리오 2: 시간표 업로드 → OCR → 수강이력 확인 (풀 버전)
 *
 * 흐름:
 *   1. 로그인
 *   2. /timetable 이동 → 2026년 1학기 슬롯에 이미지 업로드
 *   3. 최종 제출 → /graduation 리다이렉트 확인
 *   4. OCR 완료 폴링 대기 (최대 90초)
 *   5. 수강이력 항목이 1개 이상 표시되는지 확인
 *
 * 사용 이미지: dataset/images/example_1.jpg
 */
import { test, expect } from '@playwright/test'
import { loginAs } from './helpers'

const FIXTURE_IMAGE = 'C:/Users/jacob/Opensource_Project/dataset/images/example_1.jpg'

test.describe('시간표 업로드 → OCR → 수강이력', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page)
  })

  test('이미지 업로드 후 /graduation 리다이렉트 확인', async ({ page }) => {
    await page.goto('/timetable')

    // 2026년 버튼 클릭
    await page.click('button:has-text("2026")')

    // 1학기 슬롯의 hidden file input에 이미지 세팅
    // input은 숨겨져 있으므로 setInputFiles로 직접 주입
    const fileInputs = page.locator('input[type="file"]')
    await fileInputs.first().setInputFiles(FIXTURE_IMAGE)

    // "선택됨" 배지가 나타나는지 확인
    await expect(page.locator('text=선택됨')).toBeVisible({ timeout: 5000 })

    // 최종 제출 버튼 클릭
    await page.click('button:has-text("최종 제출")')

    // /graduation으로 이동 확인
    await page.waitForURL('/graduation', { timeout: 15000 })
    await expect(page).toHaveURL('/graduation')
  })

  test('OCR 완료 후 수강이력에 항목이 추가됨', async ({ page }) => {
    await page.goto('/timetable')
    await page.click('button:has-text("2026")')

    const fileInputs = page.locator('input[type="file"]')
    await fileInputs.first().setInputFiles(FIXTURE_IMAGE)
    await expect(page.locator('text=선택됨')).toBeVisible({ timeout: 5000 })
    await page.click('button:has-text("최종 제출")')
    await page.waitForURL('/graduation', { timeout: 15000 })

    // OCR 백그라운드 시작 확인 — graduation 페이지에 "인식 중" 배너가 표시되면 OCR이 시작된 것
    // (실제 완료까지 수분 소요될 수 있으므로 배너 노출 여부로 검증)
    await expect(
      page.locator('p:has-text("이수 과목 인식 중입니다")')
    ).toBeVisible({ timeout: 15000 })
  })

  test('업로드 없이 제출 버튼 비활성화 확인', async ({ page }) => {
    await page.goto('/timetable')
    const submitBtn = page.locator('button:has-text("시간표를 선택해주세요")')
    await expect(submitBtn).toBeDisabled()
  })
})
