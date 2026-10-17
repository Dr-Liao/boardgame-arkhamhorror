import { test, expect } from '@playwright/test'
test('结算逐步显示状态，最终检定与操作仅在演出结束后解锁，卡面档案统一', async ({ page }) => {
  const errors=[]; page.on('pageerror',e=>errors.push(e.message))
  await page.addInitScript(() => localStorage.setItem('arkham-presentation', JSON.stringify({sound:false,fast:true})))
  let session
  await page.route('**/api/start', async route => {
    const response = await route.fetch({postData:JSON.stringify({modId:'arkhamhorror',settings:{legacyAutoStart:true,playerCount:1,seed:'state-presentation'}})})
    const body = await response.json(); session = body.session
    session.state.pendingChoice = null; session.state.investigators[0].hand = ['01020']; session.state.phase='investigation'
    await route.fulfill({response,json:body})
  })
  await page.route('**/api/session?*', route => route.fulfill({json:{ok:true,session}}))
  await page.setViewportSize({width:1440,height:1000})
  await page.goto('/index.html'); await page.locator('.bg-card').filter({hasText:'诡镇奇谈'}).click()
  await page.getByRole('button',{name:'开始新游戏'}).click(); await page.getByRole('button',{name:'跳过演出'}).click()
  await page.clock.install()
  const originalResources = session.state.investigators[0].resources
  session.state.revision++
  const snapshot = structuredClone(session.state)
  snapshot.investigators[0].resources++
  delete snapshot.pendingChoice; delete snapshot.skillTest; delete snapshot.legalMoves
  snapshot.phase = 'upkeep'
  session.events.push({seq:session.events.length,type:'info',text:'罗兰获得1资源',presentation:{kind:'automatic',phase:'upkeep',round:2,effect:'resource',delta:1,seat:0,tableState:snapshot}})
  session.state.investigators[0].resources += 2
  session.state.phase='mythos'; session.state.skillTest={seat:0,skill:'willpower',value:3,difficulty:3,committed:[],source:{name:'腐烂的尸体'}}
  session.state.pendingChoice={id:'personal-test',seat:0,kind:'commit',prompt:'罗兰的意志检定',options:[{id:'done',label:'开始检定'}]}
  session.state.legalMoves=[{action:'choose',choiceId:'personal-test',optionId:'done',label:'开始检定'}]
  session.events.push({seq:session.events.length,type:'info',text:'神话阶段遭遇',presentation:{kind:'automatic',phase:'mythos',round:2,effect:'encounter',seat:0,code:'01163',name:'腐烂的尸体'}})
  await page.getByRole('button',{name:'刷新局势'}).click()
  await page.clock.runFor(100)
  await expect(page.locator('.ah-phase-scene')).toHaveAttribute('data-phase','upkeep')
  await expect(page.getByRole('button',{name:'开始检定',exact:true})).toHaveCount(0)
  expect(await page.locator('.ah-table').evaluate(e=>e.classList.contains('ah-presenting') && !e.inert)).toBe(true)
  await expect(page.locator('.ah-pool-resource > strong')).toHaveText(String(originalResources))
  // 演出期间不能操作，但可以查看卡牌详情与时间线。
  await page.locator('.ah-hand-card').first().click({button:'right'})
  await expect(page.getByRole('dialog',{name:'卡牌详情'})).toBeVisible()
  await page.getByRole('button',{name:'关闭卡牌详情'}).click()
  await page.locator('.ah-timeline-toggle').click()
  await expect(page.locator('.ah-table-timeline')).toHaveClass(/is-open/)
  await page.locator('.ah-timeline-toggle').click()
  await page.getByRole('button',{name:'打开战术讨论'}).click()
  const chatInput=page.getByRole('textbox',{name:'战术讨论输入'})
  await chatInput.fill('演出期间继续输入')
  await chatInput.evaluate(el=>{window.presentationChatInput=el})
  await page.clock.runFor(1600)
  await expect(chatInput).toHaveValue('演出期间继续输入')
  expect(await chatInput.evaluate(el=>el===window.presentationChatInput&&document.activeElement===el)).toBe(true)
  await page.getByRole('button',{name:'收起战术讨论'}).click()
  await page.keyboard.press('F1')
  const book=page.getByRole('dialog',{name:'游戏规则书'})
  await expect(book).toBeVisible()
  await book.locator('input').evaluate(el=>{window.rulebookInput=el;el.focus()})
  await expect(page.locator('.ah-phase-scene')).toHaveAttribute('data-phase','mythos')
  await expect(page.locator('.ah-pool-resource > strong')).toHaveText(String(originalResources+1))
  await expect(page.getByRole('button',{name:'开始检定',exact:true})).toHaveCount(0)
  await page.clock.runFor(5000)
  expect(await page.evaluate(()=>window.rulebookInput.isConnected)).toBe(true)
  await expect(page.locator('.ah-phase-scene')).toHaveCount(0)
  await book.getByRole('button',{name:'关闭规则书'}).click()
  expect(errors).toEqual([])
  await expect(page.locator('.ah-pool-resource > strong')).toHaveText(String(originalResources+2))
  await expect(page.getByRole('button',{name:'开始检定',exact:true})).toBeVisible()
  expect(await page.locator('.ah-table').evaluate(e=>e.classList.contains('ah-presenting'))).toBe(false)
  await page.clock.resume()
  await page.locator('.ah-hand-card').first().click({button:'right'})
  const dialog = page.getByRole('dialog',{name:'卡牌详情'})
  await expect(dialog.locator('.ah-rule-symbol')).not.toHaveCount(0)
  await expect(dialog).not.toContainText('[object Object]')
  await expect(dialog).not.toContainText('[action]')
  await page.screenshot({path:'artifacts/arkham-polish/card-dossier-final.png',animations:'disabled'})
  await page.getByRole('button',{name:'关闭卡牌详情'}).click()
  await page.locator('.ah-story-book .ah-script-card').last().click()
  await expect(dialog.locator('.ah-runtime-text')).toContainText('线索')
  await expect(dialog).not.toContainText('[object Object]')
  await page.screenshot({path:'artifacts/arkham-polish/act-dossier-final.png',animations:'disabled'})
})
