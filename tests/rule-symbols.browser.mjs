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

for (const width of [1440, 390]) {
  test(`检定投入、抽标记和结果弹窗不泄漏英文技能键（${width}）`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 })
    await page.emulateMedia({ reducedMotion: 'reduce' })
    const f = await fixture(page)
    const skills = ['willpower', 'intellect', 'combat', 'agility']
    const source = { label: '遭遇检定', name: '联合检定', code: '01163' }
    await f.update(s => {
      s.state.skillTest = { seat: 0, skill: skills, value: 4, baseValue: 4, difficulty: 3, committed: [], source }
      s.state.pendingChoice = { id: 'mixed-skills', kind: 'commit', seat: 0,
        prompt: '检定willpower + [intellect] + COMBAT + agility，可投入wild或[knowledge]。',
        options: [{ id: 'done', label: '开始检定' }] }
      s.state.legalMoves = [{ action: 'choose', choiceId: 'mixed-skills', optionId: 'done', label: '开始检定' }]
    })
    await expect(page.locator('.ah-test-preview')).toHaveAttribute('aria-label', '意志+智识+战斗+敏捷：基础 4，修正 +0，当前 4，难度 3')
    expect(await page.locator('.ah-test-skill-icons [data-game-symbol]').evaluateAll(els => els.map(el => el.dataset.gameSymbol))).toEqual(skills)
    await expect(page.locator('.ah-choice-prompt')).not.toContainText(/willpower|intellect|combat|agility|wild|knowledge/i)
    await expect(page.locator('.ah-choice-prompt [data-card-symbol="intellect"]')).toHaveCount(2)
    await f.update(s => {
      s.state.skillTest = null; s.state.pendingChoice = null; s.state.legalMoves = []
      s.events.push({ seq: s.events.length, type: 'presentation', kind: 'chaos', token: '-1', seat: 0,
        name: '罗兰·班克斯', skill: skills, difficulty: 3, source })
      s.events.push({ seq: s.events.length, type: 'presentation', kind: 'test', drawn: ['-1'], success: true,
        name: '罗兰·班克斯', skill: skills, difficulty: 3, value: 4, source })
    })
    const popup = page.locator('.ah-chaos-reveal')
    await expect(popup).toBeVisible()
    expect(await popup.locator('.ah-chaos-test-line [data-card-symbol]').evaluateAll(els => els.map(el => el.dataset.cardSymbol))).toEqual(skills)
    await expect(popup).not.toContainText(/willpower|intellect|combat|agility/i)
    await page.screenshot({ path: output + `skill-test-popup-${width}.png`, animations: 'disabled' })
    await popup.getByRole('button', { name: '继续', exact: true }).click()
    const result = page.locator('.ah-fx-banner')
    await expect(result).toBeVisible()
    expect(await result.locator('.ah-fx-eyebrow [data-card-symbol]').evaluateAll(els => els.map(el => el.dataset.cardSymbol))).toEqual(skills)
    await expect(result).not.toContainText(/willpower|intellect|combat|agility/i)
  })

  test(`选人与牌桌统一使用游戏技能、心脏和脑部符号（${width}）`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 })
    await page.goto('/index.html')
    await page.locator('.bg-card').filter({ hasText: '诡镇奇谈' }).click()
    await page.getByRole('button', { name: '开始新游戏' }).click()
    const hub = page.locator('.ah-hub')
    await hub.getByRole('button', { name: '选择调查员', exact: true }).click()
    await hub.getByRole('button', { name: /选择调查员：罗兰/ }).click()
    const metrics = hub.locator('.ah-office-investigator-copy').first()
    for (const name of ['combat', 'intellect', 'willpower', 'agility', 'health', 'sanity']) {
      await expect(metrics.locator(`[data-game-symbol="${name}"]`).first()).toBeVisible()
    }
    // 四维图标尺寸回归：档案里的属性图标不能小于 18px（1x 屏可辨认下限；移动端 20px）。
    for (const name of ['combat', 'intellect', 'willpower', 'agility']) {
      const box = await metrics.locator(`.ah-office-metric [data-game-symbol="${name}"]`).first().boundingBox()
      expect(box.width).toBeGreaterThanOrEqual(18)
    }
    await page.evaluate(() => document.fonts.load('22px AHCardSymbols', 'ADFS'))
    await metrics.locator('.ah-office-metrics').evaluate(el => el.scrollIntoView({ block: 'center' }))
    await page.screenshot({ path: output + `investigator-game-symbols-${width}.png`, animations: 'disabled' })

    await page.evaluate(() => localStorage.clear())
    await fixture(page)
    for (const name of ['combat', 'intellect', 'willpower', 'agility']) {
      await expect(page.locator(`[data-skill="${name}"] [data-game-symbol="${name}"]`)).toBeVisible()
    }
    for (const name of ['health', 'sanity']) {
      const icon = page.locator(`.ah-vital-${name} [data-game-symbol="${name}"]`)
      await expect(icon).toBeVisible()
      // 生命/理智是矢量剪影：必须是内联 SVG 路径，不能退回会糊的 2000px 位图蒙版。
      await expect(icon).toHaveClass(/ah-symbol-vector/)
      const vector = await icon.evaluate(el => ({
        mask: getComputedStyle(el).maskImage,
        path: el.querySelector('path')?.getAttribute('d') || '',
        fill: el.querySelector('path') ? getComputedStyle(el.querySelector('path')).fill : '',
      }))
      expect(vector.mask === 'none' || vector.mask === '').toBe(true)
      expect(vector.path.length).toBeGreaterThan(40)
      expect(vector.fill).not.toBe('none')
      const box = await icon.boundingBox()
      expect(box.width).toBeGreaterThanOrEqual(12)
    }
    const shared = await page.evaluate(async () => {
      const { tableIcon, classIcon } = await import('/mods/arkhamhorror/table-components.js')
      const { cardSymbol } = await import('/mods/arkhamhorror/card-text.js')
      const h = (tag, attrs, ...children) => {
        const el = document.createElement(tag)
        for (const [key, value] of Object.entries(attrs)) el.setAttribute(key === 'className' ? 'class' : key, value)
        el.append(...children.flat(Infinity))
        return el
      }
      return ['willpower', 'intellect', 'combat', 'agility', 'wild', 'guardian', 'seeker', 'rogue', 'mystic', 'survivor', 'neutral', 'action', 'reaction', 'free'].map(name => {
        const ui = tableIcon(name), card = cardSymbol(h, name)
        return { name, ui: ui.textContent, card: card.textContent,
          font: ui.querySelector('text').getAttribute('font-family'),
          classIcon: ['guardian', 'seeker', 'rogue', 'mystic', 'survivor', 'neutral'].includes(name) ? classIcon(name) : null }
      })
    })
    for (const symbol of shared) {
      expect(symbol.ui).toBe(symbol.card)
      expect(symbol.font).toBe(symbol.name === 'neutral' ? 'AHCardSymbolSlim' : 'AHCardSymbols')
      if (symbol.classIcon) expect(symbol.classIcon).toBe(symbol.name)
    }
    await page.evaluate(() => document.fonts.load('22px AHCardSymbols', 'ADFS'))
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    await page.screenshot({ path: output + `dashboard-game-symbols-${width}.png`, animations: 'disabled' })
  })
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

test('技能显示兼容单项、组合、别名和语言切换，原始卡文与特性保持原样', async ({ page }) => {
  await fixture(page)
  const result = await page.evaluate(async () => {
    const { skillLabel, skillSymbols, skillText } = await import('/mods/arkhamhorror/skill-presentation.js')
    const { setRulesText } = await import('/mods/arkhamhorror/card-text.js')
    const { renderHauntedChoice } = await import('/mods/arkhamhorror/tcu-ui.js')
    const { setLocale } = await import('/mods/arkhamhorror/i18n.js')
    const zh = ['willpower', 'intellect', 'combat', 'agility', 'wild', 'knowledge', 'unknown'].map(skillLabel)
    const symbols = skillSymbols(['[WILLPOWER]', 'knowledge', 'combat,agility'])
    const plain = skillText('检定combat、[willpower]，wild可以投入', { symbols: false })
    const trait = skillText('[[Combat]] [combat]')
    const node = document.createElement('div')
    setRulesText(node, 'Combat Training [[Combat]]')
    const h = (tag, attrs, ...children) => {
      const el = document.createElement(tag)
      for (const [key, value] of Object.entries(attrs)) {
        if (value != null && !key.startsWith('on')) el.setAttribute(key === 'className' ? 'class' : key, value)
      }
      el.append(...children.flat(Infinity).filter(child => child != null))
      return el
    }
    const haunted = renderHauntedChoice(h, { choice: { id: 'haunted-symbols' }, location: {},
      prompt: '选择闹鬼能力', options: [], abilityText: '检定[willpower](3)。' })
    setLocale('en')
    const en = skillLabel(['willpower', 'intellect', 'combat', 'agility'])
    setLocale('zh-CN')
    return { zh, symbols, plain, trait, card: node.textContent, en,
      haunted: haunted.querySelector('.ah-haunted-source [data-card-symbol]')?.dataset.cardSymbol }
  })
  expect(result.zh).toEqual(['意志', '智识', '战斗', '敏捷', '任意技能', '智识', '技能'])
  expect(result.symbols).toBe('[willpower]+[intellect]+[combat]+[agility]')
  expect(result.plain).toBe('检定战斗、意志，任意技能可以投入')
  expect(result.trait).toBe('[[Combat]] [combat]')
  expect(result.card).toBe('Combat Training Combat')
  expect(result.en).toBe('Willpower+Intellect+Combat+Agility')
  expect(result.haunted).toBe('willpower')
})

