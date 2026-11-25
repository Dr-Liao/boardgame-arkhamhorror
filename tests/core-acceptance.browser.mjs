import { test, expect } from '@playwright/test'

async function checkCatalog(page, request, width) {
  await page.setViewportSize({ width, height: width === 390 ? 844 : 950 })
  const verified=await (await request.get('/api/mods/arkhamhorror/catalog?packCode=core&effectStatus=verified&limit=200')).json()
  expect(verified.total).toBe(183)
  await page.route('**/mods/arkhamhorror/img/thumbs/**', route => route.fulfill({ status: 404 }))
  await page.goto('/index.html')
  await page.locator('.bg-card').filter({hasText:'诡镇奇谈'}).click()
  await page.getByRole('button',{name:'开始新游戏'}).click()
  await page.getByRole('button',{name:'全卡图鉴',exact:true}).click()
  const modal=page.getByRole('dialog',{name:'诡镇全卡图鉴'})
  await modal.getByLabel('卡号或名称').fill('01127')
  await modal.getByRole('button',{name:'检索',exact:true}).click()
  await expect(modal.locator('.ah-catalog-card')).toHaveCount(1)
  await expect(modal.locator('.ah-catalog-card')).toContainText('01127')
  await expect(modal.locator('.ah-catalog-card')).not.toContainText(/已验收|已校验/)
  await modal.locator('.ah-catalog-card').click()
  const detail=page.getByRole('dialog',{name:'卡牌详情'})
  await expect(detail.locator('.ah-status-badges')).toContainText('当前可玩')
  await expect(detail.locator('.ah-status-badges')).not.toContainText(/已验收|已校验/)
  await expect(detail.locator('.ah-status-badges')).not.toContainText('待规则审计')
  await page.screenshot({path:`artifacts/arkham-polish/core-acceptance-catalog-${width}.png`})
  const expansion=await (await request.get('/api/mods/arkhamhorror/catalog?code=99003')).json()
  expect(expansion.cards.find(c=>c.code==='99003').effectStatus).not.toBe('verified')
}

for (const width of [1440, 390]) {
  test(`Core 01127 图鉴与详情隐藏验收标记（${width}）`, async ({ page, request }) => {
    await checkCatalog(page, request, width)
  })
}
