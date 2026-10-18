// N2 浏览器验收：图鉴检索、双面详情、卡图语言回退、断网与纯文字可读性、对局隔离。
// 全程拦截外部图片请求：不依赖远程资产可用性，也不把远程候选当成离线可用。
import { test, expect } from '@playwright/test'

const IMAGE_GLOB = 'http://*/**/*.{avif,png,jpg,jpeg,webp}'
const IMAGE_GLOB_TLS = 'https://*/**/*.{avif,png,jpg,jpeg,webp}'
const PIXEL = Buffer.from('R0lGODdhAQABAIAAAAAAAAACAkQBADs=', 'base64')

async function trackImages(page, handler) {
  const requested = []
  for (const glob of [IMAGE_GLOB, IMAGE_GLOB_TLS]) {
    await page.route(glob, async route => {
      const url = route.request().url()
      requested.push(url)
      await handler(route, url)
    })
  }
  return requested
}

async function openCatalog(page) {
  await page.goto('/index.html')
  await expect(page.getByRole('button', { name: /图鉴/ })).toHaveCount(0)
  await page.locator('.bg-card').filter({ hasText: '诡镇奇谈' }).click()
  await page.getByRole('combobox', { name: /^玩家人数/ }).selectOption('1')
  await page.getByRole('button', { name: '开始新游戏' }).click()
  await page.getByRole('button', { name: '全卡图鉴', exact: true }).click()
  const modal = page.getByRole('dialog', { name: '诡镇全卡图鉴' })
  await expect(modal.getByRole('status').first()).toContainText('找到')
  return modal
}

async function openFirstCard(modal, page) {
  await modal.locator('.ah-catalog-card').first().click()
  return page.getByRole('dialog', { name: '卡牌详情' })
}

async function filterType(modal, label) {
  await modal.getByLabel('类型').selectOption({ label })
  await expect(modal.getByRole('status').first()).toContainText('找到')
}

test('全卡图鉴复用经验战役费用筛选，并支持详情与清除',async({page})=>{
  const modal=await openCatalog(page),filters=modal.locator('[data-filter-scope="catalog"]')
  await filters.getByLabel('筛选战役',{exact:true}).selectOption('core')
  await filters.getByLabel('筛选职业',{exact:true}).selectOption('guardian')
  await filters.getByLabel('筛选经验',{exact:true}).selectOption('2')
  await filters.getByLabel('筛选费用',{exact:true}).selectOption('4+')
  await expect(modal.locator('.ah-catalog-summary')).toContainText('找到')
  const result=await page.request.get('/api/mods/arkhamhorror/catalog?campaign=core&klass=guardian&xp=2&cost=4%2B')
  const body=await result.json()
  await expect(modal.locator('.ah-catalog-card')).toHaveCount(body.cards.length)
  expect(body.cards.length).toBeGreaterThan(0)
  await modal.locator('.ah-catalog-card').first().click()
  await expect(page.getByRole('dialog',{name:'卡牌详情'})).toBeVisible()
  await page.getByRole('button',{name:'关闭卡牌详情'}).click()
  await expect(filters.getByLabel('筛选经验',{exact:true})).toHaveValue('2')
  await filters.getByRole('button',{name:'清除筛选'}).click()
  await expect(filters.getByLabel('筛选经验',{exact:true})).toHaveValue('')
  await expect(modal.locator('.ah-catalog-card')).toHaveCount(24)
  await modal.getByRole('button',{name:'下一页'}).click()
  await expect(modal.locator('.ah-catalog-pagination')).toContainText('第 2 页')
  await filters.getByLabel('筛选经验',{exact:true}).selectOption('5+')
  await expect(modal.locator('.ah-catalog-pagination')).toContainText('第 1 页')
  await expect(modal.locator('.ah-catalog-summary')).toContainText('找到')
  await page.setViewportSize({width:390,height:844})
  expect(await modal.evaluate(el=>el.scrollWidth<=el.clientWidth+1)).toBe(true)
  await page.screenshot({path:'artifacts/arkham-polish/catalog-xp-filter.png'})
})

test('图鉴按类型与卡号检索，并明确区分收录与可玩', async ({ page }) => {
  await trackImages(page, route => route.fulfill({ body: PIXEL, contentType: 'image/gif' }))
  const modal = await openCatalog(page)
  await expect(modal).toContainText('收录不等于可玩')

  await filterType(modal, '调查员')
  const investigators = Number((await modal.getByRole('status').first().innerText()).match(/找到 (\d+)/)[1])
  expect(investigators).toBeGreaterThan(100)

  await filterType(modal, '地点')
  const locations = Number((await modal.getByRole('status').first().innerText()).match(/找到 (\d+)/)[1])
  expect(locations).toBeGreaterThan(1000)

  await filterType(modal, '全部类型')
  await modal.getByLabel('卡号或名称').fill('01119')
  await modal.getByRole('button', { name: '检索' }).click()
  await expect(modal.getByRole('status').first()).toContainText('找到 1 张')
  await expect(modal.locator('.ah-catalog-card').first()).toContainText('01119')
})

test('卡牌详情展示正反面文字与实现状态，未实现差异对玩家可见', async ({ page }) => {
  await trackImages(page, route => route.fulfill({ body: PIXEL, contentType: 'image/gif' }))
  const modal = await openCatalog(page)
  await modal.getByLabel('卡号或名称').fill('01001')
  await modal.getByRole('button', { name: '检索' }).click()
  const detail = await openFirstCard(modal, page)

  await expect(detail).toContainText('01001')
  const front = await detail.locator('.ah-card-full').innerText()
  await detail.getByRole('button', { name: '背面' }).click()
  await expect(detail.locator('.ah-card-full')).not.toHaveText(front)
  await expect(detail.getByRole('button', { name: '背面' })).toHaveAttribute('aria-pressed', 'true')
  await expect(detail.locator('.ah-status-badges')).not.toBeEmpty()
  await expect(detail).toContainText('文字语言状态')
})

test('中文缺图回退英文，且重复渲染不无限重试', async ({ page }) => {
  const requested = await trackImages(page, async (route, url) => {
    if (url.includes('/zh/')) return route.abort()
    return route.fulfill({ body: PIXEL, contentType: 'image/gif' })
  })
  const modal = await openCatalog(page)
  await modal.getByLabel('卡号或名称').fill('01001')
  await modal.getByRole('button', { name: '检索' }).click()
  const detail = await openFirstCard(modal, page)
  await expect(detail.locator('.ah-art').first()).toHaveAttribute('data-image-state', 'displayable')
  expect(requested.some(url => url.includes('/zh/'))).toBe(true)

  const repeated = () => requested.filter((url, index) => requested.indexOf(url) !== index)
  for (let i = 0; i < 3; i++) {
    await detail.getByRole('button', { name: '背面' }).click()
    await detail.getByRole('button', { name: '正面' }).click()
  }
  await expect(detail.locator('.ah-art').first()).toHaveAttribute('data-image-state', 'displayable')
  expect(repeated()).toEqual([])
})

test('全部卡图失败或纯文字模式下，卡文与图鉴仍可读', async ({ page }) => {
  const requested = await trackImages(page, route => route.abort())
  const modal = await openCatalog(page)
  await modal.getByLabel('卡号或名称').fill('01001')
  await modal.getByRole('button', { name: '检索' }).click()
  const detail = await openFirstCard(modal, page)
  await expect(detail.locator('.ah-art').first()).toHaveAttribute('data-image-state', 'text-fallback')
  await expect(detail.locator('.ah-card-full')).toContainText(/\S/)

  await detail.getByText('图片与语言设置').click()
  await detail.getByLabel('纯文字模式，不加载远程图片').check()
  const before = requested.length
  await detail.getByRole('button', { name: '背面' }).click()
  await detail.getByRole('button', { name: '正面' }).click()
  await expect(detail.locator('.ah-art').first()).toContainText('纯文字模式')
  expect(requested.length).toBe(before)
})

test('错误图片主机不影响图鉴检索与卡文阅读', async ({ page }) => {
  await trackImages(page, route => route.abort())
  const modal = await openCatalog(page)
  await modal.getByText('图片与语言设置').first().click()
  await modal.getByLabel('卡图主机').first().fill('not a host')
  await modal.getByRole('button', { name: '应用主机' }).first().click()
  await expect(modal).toContainText('HTTP(S) 主机地址')
  await filterType(modal, '敌人')
  await expect(modal.locator('.ah-catalog-card').first()).toContainText(/\S/)
})

test('对局内可查阅卡牌与图鉴，翻面不改变对局状态', async ({ page }) => {
  await trackImages(page, route => route.abort())
  await page.route('**/api/start', async route => {
    const body = route.request().postDataJSON()
    await route.continue({ postData: JSON.stringify({ ...body, settings: { ...body.settings, playerCount: 1, legacyAutoStart: true } }) })
  })
  await page.goto('/index.html')
  await page.locator('.bg-card').filter({ hasText: '诡镇奇谈' }).click()
  await page.getByRole('button', { name: '开始新游戏' }).click()
  await page.getByRole('button', { name: '展开时间线' }).click()
  const log = page.locator('.ah-log')
  await expect(log).toBeVisible()
  const before = await log.innerText()

  await page.locator('.ah-minicard').first().click()
  const detail = page.getByRole('dialog', { name: '卡牌详情' })
  await expect(detail).toContainText('翻面不是游戏动作')
  await detail.getByRole('button', { name: '背面' }).click()
  await page.getByRole('button', { name: '关闭卡牌详情' }).click()

  await page.getByRole('button', { name: '全卡图鉴' }).click()
  const modal = page.getByRole('dialog', { name: '诡镇全卡图鉴' })
  await expect(modal.getByRole('status').first()).toContainText('找到')
  await modal.getByRole('button', { name: '关闭图鉴' }).click()
  expect(await log.innerText()).toBe(before)
  await expect(page.locator('.ah-action').first()).toBeEnabled()
})

test('本地图库同源直出，第三方主机不可达也照常显示卡图', async ({ page }) => {
  // 只阻断外部资产主机；本机服务器保持可用，模拟"没有外网"的真实使用场景。
  await page.route('**://assets.arkhamhorror.app/**', route => route.abort())
  const requested = []
  page.on('request', request => { if (/\.(avif|jpe?g|png|webp)$/i.test(new URL(request.url()).pathname)) requested.push(request.url()) })
  const modal = await openCatalog(page)
  await modal.getByLabel('卡号或名称').fill('01001')
  await modal.getByRole('button', { name: '检索' }).click()
  const detail = await openFirstCard(modal, page)

  await expect(detail.locator('.ah-art').first()).toHaveAttribute('data-image-state', 'displayable')
  const img = detail.locator('.ah-art img').first()
  expect(await img.evaluate(node => node.naturalWidth)).toBeGreaterThan(100)
  await detail.getByRole('button', { name: '背面' }).click()
  await expect(detail.locator('.ah-art').first()).toHaveAttribute('data-image-state', 'displayable')

  // 全部图片请求都应落在本机，不访问第三方资产主机。
  expect(requested.length).toBeGreaterThan(0)
  expect(requested.filter(url => !url.startsWith('http://127.0.0.1:'))).toEqual([])
})

test('其他桌游 Mod 不受展示资源改动影响', async ({ page }) => {
  await page.goto('/index.html')
  await page.locator('.bg-card').filter({ hasText: '五子棋' }).click()
  await page.getByRole('button', { name: '开始对局' }).click()
  await expect(page.locator('.bg-board')).toBeVisible()
  await expect(page.locator('.ah-library-tools')).toHaveCount(0)
})
