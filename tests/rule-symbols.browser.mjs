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
    st.pendingChoice=null; st.currentSeat=0; st.phase='investigation'; st.enemies=[]
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

test('地点演出、待决选择和时间线使用真正的卡面符号，保留详情与原有操作',async({page})=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message))
  const f=await fixture(page)
  const rules='强制 — 在你进入本地点后：检定[willpower](4)。如果你检定失败，受到1点伤害和1点恐惧。'
  await f.update(s=>{
    s.events.push({seq:s.events.length,type:'info',text:rules,presentation:{kind:'location',seat:0,location:'cellar',code:'01150',name:'阿卡姆密林 · 邪恶之地',title:'地点揭示',shroud:4,clues:2,onEnter:{test:{skill:'willpower',difficulty:4}},text:rules}})
  })
  const scene=page.locator('.ah-location-reveal'),detail=scene.locator('.ah-cinematic-detail')
  await expect(detail.locator('[data-card-symbol="willpower"]')).toHaveAttribute('aria-label','意志')
  await expect(detail).not.toContainText('[willpower]')
  await expect(detail.locator('button')).toHaveCount(0)
  expect(await detail.locator('.ah-card-glyph').evaluate(async el=>{
    await document.fonts.load('24px AHCardSymbols','A')
    return getComputedStyle(el).fontFamily.includes('AHCardSymbols')&&document.fonts.check('24px AHCardSymbols','A')
  })).toBe(true)
  await scene.locator('img').first().evaluate(img=>img.decode())
  await page.screenshot({path:output+'location-rule-symbols.png',animations:'disabled'})
  await scene.getByRole('button',{name:'继续',exact:true}).click()
  await expect(scene).toHaveCount(0)
  await f.update(s=>{
    s.state.pendingChoice={id:'symbols-choice',seat:0,kind:'target',prompt:'选择[willpower]或[combat]',options:[{id:'test',label:'检定[intellect](3)'}]}
    s.state.legalMoves=[{action:'choose',choiceId:'symbols-choice',optionId:'test',label:'检定[intellect](3)'}]
    s.events.push({seq:s.events.length,type:'info',text:'地窖：检定[willpower]，获得[resource]。'})
  })
  await expect(page.locator('.ah-choice-prompt [data-card-symbol="willpower"]')).toBeVisible()
  await expect(page.locator('.ah-choice-option [data-card-symbol="intellect"]')).toBeVisible()
  await expect(page.locator('.ah-choice-option button')).toHaveCount(0)
  await page.getByRole('button',{name:'展开时间线'}).click()
  await expect(page.locator('.ah-log [data-card-symbol="willpower"]').first()).toBeVisible()
  await page.locator('.ah-log-card-link').filter({hasText:'地窖'}).first().click()
  await expect(page.locator('.ah-location-detail')).toBeVisible()
  await page.getByRole('button',{name:'关闭卡牌详情'}).click()
  await page.locator('.ah-choice-option[data-option-id="test"]').click()
  await expect.poll(()=>f.submitted.length).toBe(1)
  expect(errors).toEqual([])
})

test('双括号特性、混乱标记别名与未知内容不会被误转换或产生嵌套按钮',async({page})=>{
  await fixture(page)
  const result=await page.evaluate(async()=>{
    const {setRulesText,renderRulesText}=await import('/mods/arkhamhorror/card-text.js')
    const {renderTableLog}=await import('/mods/arkhamhorror/table-timeline.js')
    const h=(tag,attrs,...children)=>{
      const node=document.createElement(tag)
      for(const [key,value] of Object.entries(attrs))if(key.startsWith('on'))node[key]=value;else node.setAttribute(key==='className'?'class':key,value)
      node.append(...children.flat(Infinity));return node
    }
    const node=document.createElement('div')
    setRulesText(node,'[[Cultist]] [cultist] [eldersign] [auto_fail] [guardian] [seeker] [rogue] [mystic] [survivor] [bless] [curse] [frost] [seal_a] [day] [night] [codex] [tdc_rune_z] [knowledge] [unknown] <script>harmless</script>')
    const log=renderTableLog(h,{state:{},events:[{seq:0,type:'presentation',kind:'chaos',token:'eldersign'},{seq:1,type:'presentation',kind:'chaos',token:-2}]})
    const linked=h('div',{},renderRulesText(h,'[action] 战斗'))
    return {
      symbols:[...node.querySelectorAll('[data-card-symbol]')].map(el=>el.dataset.cardSymbol),
      glyphs:Object.fromEntries([...node.querySelectorAll('[data-card-symbol]')].map(el=>[el.dataset.cardSymbol,{text:el.textContent,className:el.firstElementChild?.className}])),
      trait:node.querySelector('strong')?.textContent,text:node.textContent,buttons:node.querySelectorAll('button').length,scripts:node.querySelectorAll('script').length,
      linked:linked.querySelectorAll('[data-rule-id]').length,logSymbol:log.querySelector('[data-card-symbol]')?.dataset.cardSymbol,logText:log.textContent,
    }
  })
  expect(result.symbols).toEqual(['cultist','elder_sign','auto_fail','guardian','seeker','rogue','mystic','survivor','bless','curse','frost','seal_a','day','night','codex','tdc_rune_z','intellect'])
  expect(result.glyphs.mystic.text).toBe('W')
  expect(result.glyphs.bless.className).toContain('ah-card-glyph-icons')
  for(const symbol of ['frost','seal_a','day','night','codex','tdc_rune_z']) expect(result.glyphs[symbol].className).toContain('ah-card-glyph-slim')
  expect(await page.evaluate(async()=>{
    await Promise.all([document.fonts.load('20px AHCardSymbols','W'),document.fonts.load('20px AHCardSymbolIcons','\ue92a'),document.fonts.load('20px AHCardSymbolSlim','\ue919')])
    return ['AHCardSymbols','AHCardSymbolIcons','AHCardSymbolSlim'].map(font=>document.fonts.check(`20px ${font}`))
  })).toEqual([true,true,true])
  expect(result.trait).toBe('Cultist')
  expect(result.text).toContain('[unknown]')
  expect(result.buttons).toBe(0);expect(result.scripts).toBe(0);expect(result.linked).toBeGreaterThan(0)
  expect(result.logSymbol).toBe('elder_sign');expect(result.logText).toContain('-2')
})

