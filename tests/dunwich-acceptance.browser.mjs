import { test, expect } from '@playwright/test'

test('敦威治333张逐卡验收状态在 API 与真实图鉴一致', async ({ page, request }) => {
  const dunwich = []
  for (const pack of ['dwl', 'tmm', 'tece', 'bota', 'uau', 'wda', 'litas']) {
    const result = await (await request.get(
      `/api/mods/arkhamhorror/catalog?packCode=${pack}&effectStatus=verified&limit=200`,
    )).json()
    expect(result.cards).toHaveLength(result.total)
    dunwich.push(...result.cards)
  }
  expect(dunwich).toHaveLength(333)
  expect(dunwich.every(card => card.effectStatus === 'verified')).toBe(true)

  await page.goto('/index.html')
  await page.locator('.bg-card').filter({ hasText: '诡镇奇谈' }).click()
  await page.getByRole('combobox', { name: '席位数量', exact: true }).selectOption('1')
  await page.getByRole('button', { name: '开始新游戏' }).click()
  await page.getByRole('button', { name: '全卡图鉴', exact: true }).click()
  const modal = page.getByRole('dialog', { name: '诡镇全卡图鉴' })
  for (const code of ['02001', '02016', '02081', '02255', '02311', '02328']) {
    await modal.getByLabel('卡号或名称').fill(code)
    await modal.getByRole('button', { name: '检索', exact: true }).click()
    await expect(modal.locator('.ah-catalog-card')).toHaveCount(1)
    await expect(modal.locator('.ah-catalog-card')).toContainText('已验收')
  }
})
