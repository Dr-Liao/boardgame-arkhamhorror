import { test, expect } from '@playwright/test'
import { scenario } from '../content/campaigns/nightOfTheZealot/scenarios/theGathering/definition.js'
import { mkdirSync } from 'node:fs'
const output = 'artifacts/arkham-polish/'
mkdirSync(output,{recursive:true})

async function fixture(page) {
  let session
  const submitted=[]
  await page.route('**/api/start', async route=>{
    const response=await route.fetch({postData:JSON.stringify({modId:'arkhamhorror',settings:{legacyAutoStart:true,playerCount:1,playerInvestigator:'01001',seed:'location-details'}})})
    const payload=await response.json(); session=payload.session
    const st=session.state
    st.chaosBag=['+1','0','0','-1','-2','skull','skull','eldersign','autofail'];st.chaos={revealed:['cultist'],sealed:[{token:'tablet',source:'asset'}],removed:['curse']};st.pendingChoice=null; st.currentSeat=0; st.phase='investigation'; st.enemies=[]
    st.locations=['hallway','attic','cellar'].map(id=>({...scenario.locations[id],revealed:id!=='attic',clues:id==='cellar'?2:0,maxClues:2}))
    st.investigators[0].location='cellar'
    st.legalMoves=[{action:'investigate',label:'调查地窖'},{action:'move',locationId:'hallway',label:'移动到走廊'}]
    await route.fulfill({response,json:payload})
  })
  await page.route('**/api/session?*',route=>route.fulfill({json:{ok:true,session}}))
  await page.route('**/api/move',route=>{submitted.push(route.request().postDataJSON());session.state.revision++;return route.fulfill({json:{ok:true,session}})})
  await page.goto('/index.html');await page.locator('.bg-card').filter({hasText:'诡镇奇谈'}).click()
  await page.getByRole('button',{name:'开始新游戏'}).click()
  await page.getByRole('button',{name:'跳过演出'}).click()
  return {session,submitted,async update(fn){fn(session);session.state.revision++;await page.getByRole('button',{name:'刷新局势'}).click();await expect(page.locator('.ah-table')).toHaveAttribute('data-revision',String(session.state.revision))}}
}

test('点击混乱袋查看实时图标与数量，揭示和封印单列，支持键盘和窄屏',async({page})=>{
  const errors=[];page.on('pageerror',error=>errors.push(error.message))
  const f=await fixture(page), before=JSON.stringify(f.session.state.chaosBag)
  const bag=page.getByRole('button',{name:'查看混乱袋'})
  await bag.click()
  const dialog=page.getByRole('dialog',{name:'当前混乱袋'})
  await expect(dialog).toBeVisible()
  await expect(dialog).toContainText('袋内 9 枚 · 7 种标记')
  await expect(dialog.locator('[data-bag-zone="bag"] [data-token="skull"]')).toHaveAttribute('aria-label','骷髅，2 枚')
  await expect(dialog.locator('[data-bag-zone="bag"] [data-token="eldersign"] img')).toHaveAttribute('src',/ct-eldersign\.png$/)
  await expect(dialog.locator('[data-bag-zone="revealed"] [data-token="cultist"]')).toBeVisible()
  await expect(dialog.locator('[data-bag-zone="sealed"] [data-token="tablet"]')).toBeVisible()
  await expect(dialog.locator('[data-token="curse"]')).toHaveCount(0)
  await expect(dialog.locator('[data-bag-zone="bag"] [data-token="cultist"]')).toHaveCount(0)
  await dialog.locator('img').evaluateAll(images=>Promise.all(images.map(img=>img.decode())))
  await page.screenshot({path:output+'chaos-bag-desktop.png',animations:'disabled'})
  await page.keyboard.press('Tab')
  await expect(dialog.getByRole('button',{name:'关闭混乱袋'})).toBeFocused()
  await page.keyboard.press('Escape')
  await expect(dialog).toHaveCount(0)
  await expect(bag).toBeFocused()
  await page.keyboard.press('Enter')
  await expect(dialog).toBeVisible()
  await page.setViewportSize({width:390,height:844})
  expect(await dialog.evaluate(el=>el.scrollWidth<=el.clientWidth)).toBe(true)
  await expect(dialog.getByRole('button',{name:'关闭混乱袋'})).toBeInViewport()
  await page.screenshot({path:output+'chaos-bag-mobile.png',animations:'disabled'})
  expect(f.submitted).toEqual([])
  expect(JSON.stringify(f.session.state.chaosBag)).toBe(before)
  // Mimic the normal background session refresh while the bag is open.
  f.session.state.chaosBag.push('bless');f.session.state.revision++
  await page.getByRole('button',{name:'刷新局势'}).evaluate(el=>el.click())
  await expect(dialog).toContainText('袋内 10 枚 · 8 种标记')
  await expect(dialog.locator('[data-bag-zone="bag"] [data-token="bless"]')).toHaveCount(1)
  await dialog.getByRole('button',{name:'关闭混乱袋'}).click()
  await f.update(s=>{s.state.chaosBag=[];s.state.chaos={}})
  await bag.click()
  await expect(dialog).toContainText('当前袋中没有标记')
  await expect(dialog).toContainText('袋内 0 枚')
  expect(errors).toEqual([])
})

test('混乱袋分组兼容符号别名、未知标记，排序不修改原袋顺序',async({page})=>{
  await page.goto('/index.html')
  const result=await page.evaluate(async()=>{
    const {groupedChaosTokens}=await import('/mods/arkhamhorror/chaos-bag-view.js')
    const bag=['elder_sign','-2','eldersign','+1','mystery','skull','0'],copy=JSON.stringify(bag)
    const groups=groupedChaosTokens(bag)
    return {groups,unchanged:copy===JSON.stringify(bag)}
  })
  expect(result.unchanged).toBe(true)
  expect(result.groups.map(g=>g.key)).toEqual(['plus1','0','minus2','eldersign','skull','mystery'])
  expect(result.groups.find(g=>g.key==='eldersign').count).toBe(2)
  expect(result.groups.at(-1).src).toBe(null)
})

