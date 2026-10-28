import { test, expect } from '@playwright/test'
import { mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
const output = fileURLToPath(new URL('../../../artifacts/arkham-polish', import.meta.url))
async function fixture(page, { players = 1, onMove } = {}) {
  let session
  const submitted = []
  await page.route('**/api/start', async route => {
    const response = await route.fetch({ postData: JSON.stringify({ modId: 'arkhamhorror', settings: { legacyAutoStart: true, playerCount: players, playerInvestigator: '01001', seed: 'direct-cards' } }) })
    const payload = await response.json(); session = payload.session
    const st = session.state; st.pendingChoice = null; st.currentSeat = 0; st.phase = 'investigation'
    Object.assign(st.cards, {
      '01017': { ...st.cards['01017'], code:'01017', name:'体能训练', type:'asset', cost:2 },
      '01023': { ...st.cards['01023'], code:'01023', name:'闪躲', type:'event', cost:1, hasReactionPrompt:true },
      '01025': { ...st.cards['01025'], code:'01025', name:'证据！', type:'event', cost:1 },
      '01029': { ...st.cards['01029'], code:'01029', name:'霰弹枪', type:'asset', slot:'Hand x2', slots:['Hand x2'], cost:5 },
      '01060': { ...st.cards['01060'], code:'01060', name:'皱缩术', type:'asset', slot:'Arcane', slots:['Arcane'], cost:3 },
      '01061': { ...st.cards['01061'], code:'01061', name:'探知术', type:'asset', slot:'Arcane', slots:['Arcane'], cost:1 },
      '01070': { ...st.cards['01070'], code:'01070', name:'影之书', type:'asset', slot:'Hand', slots:['Hand'], extraSlots:{arcane:1}, cost:4 },
      '01087': { ...st.cards['01087'], code:'01087', name:'手电筒', type:'asset', slot:'hand', cost:2 },
      '01088': { ...st.cards['01088'], code:'01088', name:'应急物品', type:'event', cost:0 },
    })
    st.investigators[0].hand = ['01087','01088','01025','01087']; st.investigators[0].resources = 20
    st.investigators[0].assets = [{ id: 'gun', code: '01016', uses: 3, exhausted: false }]
    st.legalMoves = [{ action: 'play', cardId: '01087', label: '装备手电筒' },{ action: 'play', cardId: '01088', label: '打出应急物品' }]
    await route.fulfill({ response, json: payload })
  })
  await page.route('**/api/session?*', route => route.fulfill({ json: { ok: true, session } }))
  await page.route('**/api/move', async route => {
    const body = route.request().postDataJSON(); submitted.push(body)
    if (onMove) return onMove(route, body, session)
    session.state.revision++; session.state.pendingChoice = null; session.state.legalMoves = []
    await route.fulfill({ json: { ok: true, session } })
  })
  await page.goto('/index.html'); await page.locator('.bg-card').filter({ hasText: '诡镇奇谈' }).click()
  await page.getByRole('button', { name: '开始新游戏' }).click()
  await expect(page.locator('.ah-player-board')).toBeVisible()
  await page.getByRole('button', { name: '跳过演出' }).click()
  return { get session() { return session }, submitted, async update(change) { change(session.state); session.state.revision++; const skipScene=page.getByRole('button',{name:'跳过演出'}); if(await skipScene.count())await skipScene.first().click(); await page.getByRole('button', { name: '刷新局势' }).click(); await expect(page.locator('.ah-table')).toHaveAttribute('data-revision', String(session.state.revision)) } }
}
const entity = (page,key) => page.locator(`[data-interaction="${key}"]`).filter({ visible: true }).first()

test('使用卡牌与结算重绘保持地图位置和已加载图片，不出现原点闪帧',async({page})=>{
  await page.setViewportSize({width:1440,height:1000})
  await page.addInitScript(()=>localStorage.setItem('arkham-presentation',JSON.stringify({sound:false,fast:true})))
  const f=await fixture(page,{onMove:async(route,body,s)=>{
    const inv=s.state.investigators[0]
    inv.hand.splice(inv.hand.indexOf('01087'),1);inv.assets.push({id:'flashlight',code:'01087',uses:3,exhausted:false})
    inv.resources--;s.state.revision++;s.state.legalMoves=[]
    s.events.push({seq:s.events.length,type:'presentation',kind:'play',seat:0,code:'01087'})
    s.events.push({seq:s.events.length,type:'presentation',kind:'checkpoint',tableState:structuredClone(s.state)})
    inv.resources++
    s.events.push({seq:s.events.length,type:'presentation',kind:'automatic',phase:'upkeep',round:1,effect:'resource',seat:0,delta:1,text:'补充资源',tableState:structuredClone(s.state)})
    await route.fulfill({json:{ok:true,session:s}})
  }})
  await expect(page.locator('.ah-map-node .ah-table-art').first()).toHaveAttribute('data-image-state','displayable')
  await page.evaluate(()=>{
    const art=document.querySelector('.ah-map-node .ah-table-art')
    window.mapFrames={count:0,errors:[]}
    let previous
    window.mapAudit=new MutationObserver(()=>{
      const scene=document.querySelector('.ah-map-scene')
      if(!scene || scene===previous)return
      previous=scene;window.mapFrames.count++
      if(!scene.style.transform.includes('translate('))window.mapFrames.errors.push('unpositioned map')
      if(scene.querySelector('.ah-map-node .ah-table-art')!==art)window.mapFrames.errors.push('replaced loaded art')
      if(art.dataset.imageState!=='displayable')window.mapFrames.errors.push('image placeholder')
    })
    window.mapAudit.observe(document.body,{childList:true,subtree:true})
  })
  await entity(page,'hand:0:0').click()
  await page.locator('.ah-equip-slot[data-slot="hand"]').last().click()
  await expect.poll(()=>f.submitted.length).toBe(1)
  await expect(page.locator('.ah-phase-scene')).toBeVisible()
  await expect(page.locator('.ah-card-inspection')).toHaveCount(0)
  await expect(page.locator('.ah-phase-scene')).toHaveCount(0)
  await expect(page.locator('.ah-table')).not.toHaveClass(/ah-presenting/)
  const frames=await page.evaluate(()=>{window.mapAudit.disconnect();return window.mapFrames})
  expect(frames.count).toBeGreaterThan(2);expect(frames.errors).toEqual([])
})

test('出牌事件与结算不重复播放，连续打出同名卡仍各播放一次',async({page})=>{
  await page.addInitScript(()=>localStorage.setItem('arkham-presentation',JSON.stringify({sound:false,fast:true})))
  const f=await fixture(page,{onMove:async(route,body,s)=>{
    const inv=s.state.investigators[0]
    inv.hand.splice(inv.hand.indexOf('01017'),1)
    inv.assets.push({id:'training-'+inv.assets.length,code:'01017'})
    inv.resources-=2;s.state.revision++
    s.state.legalMoves=inv.hand.length?[{action:'play',cardId:'01017'}]:[]
    s.events.push({seq:s.events.length,type:'info',presentation:{kind:'play',seat:0,code:'01017'}})
    s.events.push({seq:s.events.length,type:'presentation',kind:'checkpoint',tableState:structuredClone(s.state)})
    await route.fulfill({json:{ok:true,session:s}})
  }})
  await f.update(st=>{st.investigators[0].assets=[];st.investigators[0].hand=['01017','01017'];st.legalMoves=[{action:'play',cardId:'01017'}]})
  await expect(page.locator('.ah-table')).not.toHaveClass(/ah-presenting/)
  await page.evaluate(()=>{
    window.playFlights=0
    window.playAudit=new MutationObserver(records=>{for(const record of records)for(const node of record.addedNodes)if(node.matches?.('.ah-fx-card[data-fx-kind="play"]'))window.playFlights++})
    window.playAudit.observe(document.body,{subtree:true,childList:true})
  })
  for(const count of [1,2]){
    await entity(page,'hand:0:0').click()
    await page.locator('.ah-equip-slot[data-slot="other"]').last().click()
    await expect.poll(()=>f.submitted.length).toBe(count)
    await expect(page.locator('.ah-equip-other .ah-minicard')).toHaveCount(count)
    await expect(page.locator('.ah-table')).not.toHaveClass(/ah-presenting/)
    expect(await page.evaluate(()=>window.playFlights)).toBe(count)
    await page.getByRole('button',{name:'刷新局势'}).click()
    expect(await page.evaluate(()=>window.playFlights)).toBe(count)
  }
  await page.evaluate(()=>window.playAudit.disconnect())
})

test('抽牌逐张移动实际卡面，同名新卡落入各自手牌位置',async({page})=>{
  const f=await fixture(page)
  await expect(page.locator('.ah-table')).not.toHaveClass(/ah-presenting/)
  await page.evaluate(()=>{
    window.drawnArt=[];window.drawAuditErrors=[]
    window.drawAudit=new MutationObserver(records=>{
      for(const record of records)for(const el of record.addedNodes) {
        if(!el.matches?.('.ah-card-transit[data-fx-kind="draw"]'))continue
        const art=el.querySelector('.ah-table-art')
        window.drawnArt.push(art)
        if(!art)window.drawAuditErrors.push('flight is a copied image')
        if(document.querySelectorAll('.ah-hand-card:not([style*="visibility: hidden"])').length!==4+window.drawnArt.length-1)window.drawAuditErrors.push('arrival visible before landing')
        if(!document.querySelector('.ah-table').classList.contains('ah-presenting'))window.drawAuditErrors.push('table unlocked during draw')
      }
    });window.drawAudit.observe(document.body,{childList:true,subtree:true})
  })
  await f.update(st=>{st.investigators[0].hand.push('01087','01087')})
  await expect(page.locator('.ah-card-transit[data-fx-kind="draw"]')).toBeVisible()
  mkdirSync(output,{recursive:true});await page.screenshot({path:output+'card-motion-draw.png'})
  await expect(page.locator('.ah-hand-card')).toHaveCount(6)
  await expect(page.locator('.ah-table')).not.toHaveClass(/ah-presenting/)
  expect(await page.evaluate(()=>({count:window.drawnArt.length,errors:window.drawAuditErrors,
    landed:window.drawnArt.map((art,i)=>art===document.querySelector(`[data-interaction="hand:0:${i+4}"] .ah-table-art`))}))).toEqual({count:2,errors:[],landed:[true,true]})
  await expect(page.locator('.ah-card-transit')).toHaveCount(0)
  await page.evaluate(()=>window.drawAudit.disconnect())
})

test('拖动手牌使用原卡面，取消拖动后同一张卡归位',async({page})=>{
  const f=await fixture(page)
  await expect(entity(page,'hand:0:0').locator('.ah-table-art')).toHaveAttribute('data-image-state','displayable')
  await page.evaluate(()=>window.draggedArt=document.querySelector('[data-interaction="hand:0:0"] .ah-table-art'))
  const box=await entity(page,'hand:0:0').boundingBox()
  await page.mouse.move(box.x+box.width/2,box.y+box.height/2);await page.mouse.down()
  await page.mouse.move(box.x+box.width/2-60,box.y-90,{steps:5})
  await expect(page.locator('.ah-card-ghost')).toBeVisible()
  expect(await page.evaluate(()=>document.querySelector('.ah-card-ghost .ah-table-art')===window.draggedArt)).toBe(true)
  await expect(entity(page,'hand:0:0')).toBeHidden()
  await page.keyboard.press('Escape');await page.mouse.up()
  await expect(page.locator('.ah-card-ghost')).toHaveCount(0)
  await expect(entity(page,'hand:0:0')).toBeVisible()
  expect(await page.evaluate(()=>document.querySelector('[data-interaction="hand:0:0"] .ah-table-art')===window.draggedArt)).toBe(true)
  expect(f.submitted).toHaveLength(0)
})

test('拖动手牌的幽灵卡按卡位缩放真实卡面，不放大裁切',async({page})=>{
  await fixture(page)
  const card=entity(page,'hand:0:0')
  await expect(card.locator('.ah-table-art')).toHaveAttribute('data-image-state','displayable')
  const box=await card.boundingBox()
  await page.mouse.move(box.x+box.width/2,box.y+box.height/2);await page.mouse.down()
  await page.mouse.move(box.x+box.width/2-50,box.y-120,{steps:6})
  const ghost=page.locator('.ah-card-ghost')
  await expect(ghost).toBeVisible()
  const metrics=await page.evaluate(()=>{
    const ghost=document.querySelector('.ah-card-ghost'),art=ghost.querySelector('.ah-table-art'),img=art?.querySelector('img')
    return{ghost:[ghost.offsetWidth,ghost.offsetHeight],padding:getComputedStyle(ghost).padding,
      art:[art.offsetWidth,art.offsetHeight],artMinHeight:getComputedStyle(art.querySelector('.ah-art')).minHeight,
      img:[img?.clientWidth,img?.clientHeight],fit:img&&getComputedStyle(img).objectFit}
  })
  // 幽灵卡是 5:7 的 94×132 卡位；卡面铺满 2px 描边以内的 90×128 内容区。
  expect(metrics.ghost).toEqual([94,132])
  expect(metrics.padding).toBe('0px')
  expect(metrics.art).toEqual([90,128])
  expect(metrics.artMinHeight).toBe('0px')
  expect(metrics.fit).toBe('contain')
  // 卡图必须和卡面一样大：离开 .ah-table 后基础 .ah-art 的 min-height 会把它撑到 240px 高再裁掉大半。
  expect(metrics.img[0]).toBe(90)
  expect(Math.abs(metrics.img[1]-128)).toBeLessThanOrEqual(1)
  await page.keyboard.press('Escape');await page.mouse.up()
  await expect(ghost).toHaveCount(0)
})

test('打出的实际卡面从手牌连续进入装备槽，事件牌进入弃牌区',async({page})=>{
  let event=false
  const f=await fixture(page,{onMove:async(route,body,s)=>{
    const inv=s.state.investigators[0],code=event?'01088':'01087'
    inv.hand.splice(inv.hand.indexOf(code),1);s.state.revision++
    s.events.push({seq:s.events.length,type:'presentation',kind:'play',seat:0,code,tableState:structuredClone(s.state)})
    if(event)inv.discard.push(code);else inv.assets.push({id:'motion-flashlight',code,uses:3})
    s.events.push({seq:s.events.length,type:'presentation',kind:'checkpoint',tableState:structuredClone(s.state)})
    await route.fulfill({json:{ok:true,session:s}})
  }})
  for(const kind of ['asset','event']) {
    await entity(page,'hand:0:0').click()
    await page.evaluate(()=>{
      window.playedArt=document.querySelector('[data-interaction="hand:0:0"] .ah-table-art')
      window.playedTransit=null;window.playIdentityErrors=[]
      window.identityAudit=new MutationObserver(records=>{
        for(const record of records)for(const el of record.addedNodes)if(el.matches?.('.ah-card-transit[data-fx-kind="play"]')) {
          if(window.playedTransit)window.playIdentityErrors.push('second flight')
          window.playedTransit=el
          if(el.querySelector('.ah-table-art')!==window.playedArt)window.playIdentityErrors.push('copied art')
        }
      });window.identityAudit.observe(document.body,{childList:true,subtree:true})
    })
    await (event?entity(page,'zone:play'):page.locator('.ah-equip-slot[data-slot="hand"]').last()).click()
    await expect(page.locator('.ah-card-transit[data-fx-kind="play"]')).toBeVisible()
    await expect(page.locator('.ah-table')).toHaveClass(/ah-presenting/)
    await expect(page.locator('.ah-table')).not.toHaveClass(/ah-presenting/)
    expect(await page.evaluate(()=>window.playIdentityErrors)).toEqual([])
    if(!event)expect(await page.evaluate(()=>document.querySelector('[data-interaction="asset:motion-flashlight"] .ah-table-art')===window.playedArt)).toBe(true)
    await expect(page.locator('.ah-card-transit')).toHaveCount(0)
    await page.evaluate(()=>window.identityAudit.disconnect())
    event=true
  }
  expect(f.submitted).toHaveLength(2)
})

test('整备抽牌使用同一张卡进入手牌，减少动态效果不会留下隐藏卡',async({page})=>{
  const f=await fixture(page)
  await page.evaluate(()=>{
    window.upkeepArt=null
    window.upkeepAudit=new MutationObserver(records=>{for(const record of records)for(const el of record.addedNodes)
      if(el.matches?.('.ah-card-transit[data-fx-kind="draw"]'))window.upkeepArt=el.querySelector('.ah-table-art')
    });window.upkeepAudit.observe(document.body,{childList:true,subtree:true})
  })
  await f.update(st=>{
    st.investigators[0].hand.push('01088')
    f.session.events.push({seq:f.session.events.length,type:'presentation',kind:'automatic',phase:'upkeep',round:1,effect:'draw',seat:0,text:'罗兰抽取一张牌',tableState:structuredClone(st)})
    f.session.events.push({seq:f.session.events.length,type:'presentation',kind:'checkpoint',tableState:structuredClone(st)})
  })
  await expect(page.locator('.ah-phase-scene')).toBeVisible()
  await expect(page.locator('.ah-cinematic-draw')).toHaveCount(0)
  await expect(page.locator('.ah-card-transit[data-fx-kind="draw"]')).toBeVisible()
  await expect(page.locator('.ah-table')).not.toHaveClass(/ah-presenting/)
  expect(await page.evaluate(()=>window.upkeepArt===document.querySelector('[data-interaction="hand:0:4"] .ah-table-art'))).toBe(true)
  await page.emulateMedia({reducedMotion:'reduce'})
  await f.update(st=>st.investigators[0].hand.push('01088'))
  await expect(page.locator('.ah-table')).not.toHaveClass(/ah-presenting/)
  await expect(entity(page,'hand:0:5')).toBeVisible()
  await expect(page.locator('.ah-card-transit')).toHaveCount(0)
  await page.evaluate(()=>window.upkeepAudit.disconnect())
})

test('线索支付使用大号数字轮盘，限制上下界并显式确认，窄屏完整可见',async({page})=>{
  const f=await fixture(page)
  await f.update(st=>{
    choice(st,'payment',['1','2','3']);st.pendingChoice.source='group-clues'
    st.pendingChoice.payment={required:6,remaining:3,paid:3,round:2,min:1,max:3,available:4}
  })
  const panel=page.getByRole('region',{name:'共同支付线索'}),input=page.getByRole('spinbutton',{name:'支付线索数量'})
  await expect(panel).toBeVisible();await expect(panel).toContainText('第 2 轮分摊')
  await expect(panel).toContainText('总需求 6');await expect(panel).toContainText('已支付 3');await expect(panel).toContainText('还需 3')
  const box=await panel.boundingBox();expect(box.width).toBeGreaterThan(350);expect(box.height).toBeGreaterThan(350)
  await expect(input).toHaveValue('1');await expect(page.getByRole('button',{name:'减少支付线索'})).toBeDisabled()
  await page.getByRole('button',{name:'增加支付线索'}).click();await expect(input).toHaveValue('2')
  expect(f.submitted).toHaveLength(0)
  await input.fill('999');await input.press('Tab');await expect(input).toHaveValue('3')
  await expect(page.getByRole('button',{name:'增加支付线索'})).toBeDisabled()
  await input.fill('0');await input.press('Tab');await expect(input).toHaveValue('1')
  await input.focus();await input.press('ArrowUp');await expect(input).toHaveValue('2')
  mkdirSync(output,{recursive:true});await page.screenshot({path:output+'clue-payment-dial.png'})
  await page.setViewportSize({width:390,height:844});await expect(panel).toBeInViewport({ratio:1})
  await expect(input).toHaveValue('2')
  await page.getByRole('button',{name:'确认支付 2 个线索'}).click()
  await expect.poll(()=>f.submitted.length).toBe(1)
  expect(f.submitted[0].move.optionId).toBe('2')
  await expect(panel).toHaveCount(0)
})

test('时间线卡牌名称带下划线，可查看卡牌遭遇地点并保持阅读位置',async({page})=>{
  const f=await fixture(page)
  const loc=f.session.state.locations[0]
  loc.revealed=false
  const encounter=Object.values(f.session.state.cards).find(card=>card.type==='treachery'&&card.originalCode==='01163')
  expect(encounter).toBeTruthy()
  const text=`在「${loc.name}」使用「手电筒」，遭遇「${encounter.name}」。`
  for(let i=0;i<36;i++)f.session.events.push({seq:f.session.events.length,type:'info',text})
  await f.update(()=>{})
  await expect(page.locator('.ah-table')).not.toHaveClass(/ah-presenting/)
  await page.getByRole('button',{name:'展开时间线'}).click()
  const log=page.locator('.ah-log')
  await log.evaluate(el=>{el.scrollTop=180})
  const line=page.locator('.ah-log-line').nth(10)
  await line.scrollIntoViewIfNeeded()
  const card=line.getByRole('button',{name:'查看手电筒详情'})
  await expect(card).toHaveCSS('text-decoration-line','underline')
  const scroll=await log.evaluate(el=>el.scrollTop)
  expect(scroll).toBeGreaterThan(0)
  await card.click()
  const dialog=page.getByRole('dialog',{name:'卡牌详情'})
  await expect(dialog).toBeVisible();await expect(dialog).toContainText('01087')
  await page.getByRole('button',{name:'关闭卡牌详情'}).click()
  await expect.poll(()=>log.evaluate(el=>el.scrollTop)).toBe(scroll)
  await line.getByRole('button',{name:`查看${encounter.name}详情`}).click()
  await expect(dialog).toContainText('01163')
  await page.getByRole('button',{name:'关闭卡牌详情'}).click()
  await line.getByRole('button',{name:`查看${loc.name}详情`}).focus()
  await page.keyboard.press('Enter')
  await expect(page.locator('.ah-location-dossier')).toContainText('未揭示')
  await expect(page.getByRole('button',{name:'已揭示',exact:true})).toBeDisabled()
  await page.getByRole('button',{name:'关闭卡牌详情'}).click()
  await expect.poll(()=>log.evaluate(el=>el.scrollTop)).toBe(scroll)
  expect(f.submitted).toHaveLength(0)
  mkdirSync(output,{recursive:true});await page.screenshot({path:output+'timeline-card-links.png'})
})

test('常驻推进场景按钮显示有效线索，灰态与真实推进动作保持一致',async({page})=>{
  const f=await fixture(page,{players:2})
  const button=page.getByRole('button',{name:'推进场景',exact:true})
  await f.update(st=>{
    st.acts[st.actIndex].objective={type:'clues',perInvestigator:2,atLocation:st.investigators[0].location}
    st.investigators[0].clues=1;st.investigators[1].clues=5;st.investigators[1].location='elsewhere';st.legalMoves=[]
  })
  await expect(button).toBeDisabled();await expect(button).toContainText('线索 1 / 4')
  await f.update(st=>{st.investigators[1].location=st.investigators[0].location;st.investigators[1].defeated=true})
  await expect(button).toContainText('线索 1 / 4')
  await f.update(st=>{st.investigators[1].defeated=false;st.investigators[1].clues=3})
  await expect(button).toBeDisabled();await expect(button).toHaveAttribute('title',/等待本场景规定/)
  await f.update(st=>{st.legalMoves=[{action:'advanceAct',label:'共同支付线索推进场景'}]})
  await expect(button).toBeEnabled();await expect(button).toContainText('线索 4 / 4')
  mkdirSync(output,{recursive:true});await page.screenshot({path:output+'act-advance-ready.png',animations:'disabled'})
  await button.click()
  await expect.poll(()=>f.submitted.length).toBe(1)
  expect(f.submitted[0].move.action).toBe('advanceAct')
  await f.update(st=>{
    st.pendingChoice={id:'act-end',kind:'act',seat:0,options:[{id:'advance',label:'共同支付并推进'},{id:'skip',label:'暂不推进'}]}
    st.legalMoves=[{action:'choose',choiceId:'act-end',optionId:'advance'}]
  })
  await expect(button).toBeEnabled();await button.click()
  await expect.poll(()=>f.submitted.length).toBe(2)
  expect(f.submitted[1].move).toMatchObject({action:'choose',choiceId:'act-end',optionId:'advance'})
})

test('聊天未读、头像气泡和频道已读状态，重绘与刷新不重复提醒',async({page})=>{
  const f=await fixture(page,{players:2})
  // 换牌结束后会播开场故事；先跳过，否则全屏故事幕会拦截刷新按钮。
  const skipScene=page.getByRole('button',{name:'跳过演出'})
  if(await skipScene.count())await skipScene.first().click()
  await expect(page.locator('.ah-table')).not.toHaveClass(/ah-presenting/)
  const errors=[];page.on('pageerror',e=>errors.push(e.message))
  let chatRequests=0;await page.route('**/api/chat',route=>{chatRequests++;return route.abort()})
  f.session.players[1].name='队友小林';f.session.players[1].avatar='🦉'
  const append=(text,to=null,ts=Date.now(),seat=1)=>f.session.events.push({seq:f.session.events.length,type:'chat',seat,to,text,ts,origin:'action',replyRequested:false})
  append('我找到了线索，准备推进。');append('我会留在书房协助你。',1)
  await f.update(()=>{})
  await expect(page.locator('.bg-chat-unread')).toHaveText('2')
  await expect(page.locator('.bg-chat-toast')).toHaveCount(2)
  await expect(page.locator('.bg-chat-toast .bg-chat-avatar').first()).toHaveText('🦉')
  await expect(page.locator('.bg-chat-toast').first()).toContainText('我找到了线索')
  await page.screenshot({path:output+'chat-unread-bubbles.png',animations:'disabled'})
  await page.setViewportSize({width:390,height:844})
  await expect(page.getByRole('button',{name:'推进场景',exact:true})).toBeInViewport()
  await expect(page.locator('.bg-chat-toast').first()).toBeInViewport()
  await page.screenshot({path:output+'act-chat-mobile.png',animations:'disabled'})
  await page.setViewportSize({width:1400,height:950})
  await page.getByRole('button',{name:'刷新局势'}).click()
  await expect(page.locator('.bg-chat-toast')).toHaveCount(2)
  await page.getByRole('button',{name:'打开战术讨论'}).click()
  await expect(page.locator('.bg-chat-msg .bg-chat-avatar')).toHaveCount(1)
  await expect(page.locator('.bg-chat-tab-unread')).toHaveText('1')
  await page.getByRole('button',{name:'收起战术讨论'}).click()
  await expect(page.locator('.bg-chat-unread')).toHaveText('1')
  await page.locator('.bg-chat-toast-open').click()
  await expect(page.locator('.bg-chat-msg-text')).toHaveText('我会留在书房协助你。')
  await expect(page.locator('.bg-chat-toast')).toHaveCount(0)
  await page.screenshot({path:output+'chat-avatar-records.png',animations:'disabled'})
  await page.getByRole('button',{name:'收起战术讨论'}).click()
  append('旧消息，只计未读。',null,Date.now()-60000);append('自己的发言',null,Date.now(),0)
  await f.update(()=>{})
  await expect(page.locator('.bg-chat-unread')).toHaveText('1');await expect(page.locator('.bg-chat-toast')).toHaveCount(0)
  await page.clock.install()
  append('新的进展。');await f.update(()=>{})
  await expect(page.locator('.bg-chat-toast')).toHaveCount(1)
  await page.clock.fastForward(8000)
  await expect(page.locator('.bg-chat-toast')).toHaveCount(0);await expect(page.locator('.bg-chat-unread')).toHaveText('2')
  await page.reload()
  await expect(page.locator('.ah-cinematic')).toBeVisible()
  await page.getByRole('button',{name:'跳过演出'}).click()
  await expect(page.locator('.bg-chat-unread')).toHaveText('2');await expect(page.locator('.bg-chat-toast')).toHaveCount(0)
  // A private toast expiring while typing in public chat keeps the input node.
  append('私聊提醒。',1);await f.update(()=>{})
  await page.getByRole('button',{name:'打开战术讨论'}).click()
  await page.locator('.bg-chat-input').fill('还没发送的草稿')
  await page.locator('.bg-chat-input').evaluate(el=>{window.chatDraftNode=el})
  await page.clock.fastForward(8000)
  await expect(page.locator('.bg-chat-toast')).toHaveCount(0)
  await expect(page.locator('.bg-chat-input')).toHaveValue('还没发送的草稿')
  expect(await page.locator('.bg-chat-input').evaluate(el=>el===window.chatDraftNode && document.activeElement===el)).toBe(true)
  expect(chatRequests).toBe(0);expect(errors).toEqual([])
})

test('已占用槽位的卡牌表面与槽位使用相同的拖放高亮和落牌判断', async ({ page }) => {
  const f = await fixture(page)
  const source = entity(page, 'hand:0:0'), target = entity(page, 'asset:gun')
  await source.click()
  await expect(target).toHaveClass(/ah-drop-valid/)
  await page.keyboard.press('Escape')
  const a = await source.boundingBox(), b = await target.boundingBox()
  await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2)
  await page.mouse.down()
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps: 10 })
  await expect(target).toHaveClass(/ah-drop-valid/)
  await expect(target).toHaveClass(/ah-drop-hover/)
  await page.mouse.up()
  await expect.poll(() => f.submitted.length).toBe(1)
  expect(f.submitted[0].move).toMatchObject({ action: 'play', cardId: '01087' })
})

test('远端状态在拖牌期间延迟换桌，释放后以最新 revision 安全取消', async ({ page }) => {
  const f = await fixture(page)
  const source = entity(page,'hand:0:0'), target = entity(page,'asset:gun')
  const beforeRevision = Number(await page.locator('.ah-table').getAttribute('data-revision'))
  await page.locator('.ah-table').evaluate(table => {
    window.gestureTable = table
    window.gestureReplacements = 0
    window.gestureObserver = new MutationObserver(records => {
      for (const record of records) for (const node of record.addedNodes) {
        if (node.nodeType === Node.ELEMENT_NODE && (node.matches?.('.ah-table') || node.querySelector?.('.ah-table'))) window.gestureReplacements++
      }
    })
    window.gestureObserver.observe(document.getElementById('app'),{childList:true,subtree:true})
  })
  const a=await source.boundingBox(), b=await target.boundingBox()
  await page.mouse.move(a.x+a.width/2,a.y+a.height/2);await page.mouse.down()
  await page.mouse.move(a.x+a.width/2+20,a.y+a.height/2+10,{steps:4})
  f.session.state.revision++;f.session.state.investigators[0].resources++
  const response=page.waitForResponse(res=>res.url().includes('/api/session?'))
  await page.getByRole('button',{name:'刷新局势'}).evaluate(button=>button.click())
  await response
  expect(await page.evaluate(()=>window.gestureTable.isConnected&&document.querySelector('.ah-table')===window.gestureTable)).toBe(true)
  expect(await page.evaluate(()=>window.gestureReplacements)).toBe(0)
  await page.mouse.move(b.x+b.width/2,b.y+b.height/2,{steps:4});await page.mouse.up()
  await expect(page.locator('.ah-table')).toHaveAttribute('data-revision',String(beforeRevision+1))
  expect(f.submitted).toHaveLength(0)
  await expect(page.getByText('牌桌已更新，拖动已取消。')).toBeVisible()
  const replacements=await page.evaluate(()=>{window.gestureObserver.disconnect();return window.gestureReplacements})
  expect(replacements).toBeLessThanOrEqual(2)
})

test('独立手部与法术槽：淡色底图、跨槽占用、额外手部和第二法术位拖放', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 })
  const f = await fixture(page)
  await f.update(st => { st.investigators[0].assets = [] })
  const slots = page.locator('.ah-equip-slot'), hands = slots.filter({ has: page.locator('[data-slot-art="hand"]') })
  await expect(slots).toHaveCount(9)
  await expect(slots.locator('.ah-slot-backdrop svg')).toHaveCount(9)
  await expect(hands).toHaveCount(2)
  await expect(hands.nth(0)).toHaveAccessibleName('左手装备槽 0/1')
  await expect(hands.nth(1)).toHaveAccessibleName('右手装备槽 0/1')
  await expect(hands.nth(1).locator('.ah-slot-backdrop')).toHaveClass(/is-mirrored/)
  const spells = page.locator('.ah-equip-slot[data-slot="arcane"]')
  await expect(spells).toHaveCount(2)
  const widths = await slots.evaluateAll(els => els.map(el => el.getBoundingClientRect().width))
  expect(Math.max(...widths)-Math.min(...widths)).toBeLessThan(1)
  await expect(page.locator('.ah-equip-empty')).toHaveCount(0)
  await page.evaluate(async()=>Promise.all([...document.images].map(img=>img.decode().catch(()=>{}))))
  mkdirSync(output,{recursive:true})
  await page.screenshot({path:output+'equipment-slot-backdrops.png',animations:'disabled'})
  await f.update(st => {
    st.investigators[0].assets = [{id:'shotgun',code:'01029',uses:2}]
  })
  await expect(page.locator('.ah-equip-slot[data-slot="hand"][data-slot-used="1"]')).toHaveCount(2)
  await expect(hands.locator('.ah-minicard')).toHaveCount(1)
  await expect(hands.locator('.ah-slot-linked')).toHaveAccessibleName(/双手占用/)
  await page.evaluate(async()=>Promise.all([...document.images].map(img=>img.decode().catch(()=>{}))))
  await page.screenshot({path:output+'equipment-two-hand.png',animations:'disabled'})
  await f.update(st => { st.investigators[0].assets.push({id:'bandolier',code:'01008'}) })
  await expect(hands).toHaveCount(4)
  await expect(hands.nth(2)).toHaveAccessibleName('额外手部 1装备槽 0/1')
  await f.update(st => {
    st.investigators[0].assets = [{id:'spell-a',code:'01060'},{id:'spell-b',code:'01061'}]
    st.cards['01060'].slots = ['arcane']; st.cards['01061'].slots = ['arcane']
  })
  await expect(spells.nth(0).locator('.ah-minicard')).toHaveAttribute('data-card-code','01060')
  await expect(spells.nth(1).locator('.ah-minicard')).toHaveAttribute('data-card-code','01061')
  await f.update(st => {
    st.investigators[0].assets = []; st.investigators[0].hand = ['01060']
    st.legalMoves = [{action:'play',cardId:'01060',label:'使用法术'}]
  })
  await entity(page,'hand:0:0').dragTo(spells.nth(1))
  await expect.poll(()=>f.submitted.length).toBe(1)
  expect(f.submitted[0].move).toMatchObject({action:'play',cardId:'01060'})
})

test('其他资产逐张补空位，新增容量独立显示且卡位内不滚动', async ({ page }) => {
  await page.setViewportSize({width:1920,height:1080})
  const f = await fixture(page)
  const others = page.locator('.ah-equip-slot[data-slot="other"]')
  const spells = page.locator('.ah-equip-slot[data-slot="arcane"]')
  await f.update(st => {
    st.investigators[0].assets = [{id:'training-a',code:'01017'}]
    st.investigators[0].hand = ['01017']
    st.legalMoves = [{action:'play',cardId:'01017',label:'装备体能训练'}]
  })
  await expect(others).toHaveCount(2)
  await expect(others.first().locator('.ah-minicard')).toHaveCount(1)
  await expect(others.last()).toHaveAttribute('data-slot-used','0')
  await entity(page,'hand:0:0').dragTo(others.last())
  await expect.poll(()=>f.submitted.length).toBe(1)
  expect(f.submitted[0].move).toMatchObject({action:'play',cardId:'01017'})
  await f.update(st => {
    st.investigators[0].assets.push({id:'training-b',code:'01017'},{id:'book',code:'01070'})
  })
  await expect(others).toHaveCount(3)
  await expect(others.locator('.ah-minicard')).toHaveCount(2)
  await expect(spells).toHaveCount(3)
  await expect(spells.last()).toHaveAttribute('data-slot-used','0')
  await expect(page.locator('.ah-equip-slot[data-slot="hand"] .ah-minicard')).toHaveCount(1)
  for (const width of [1920,700]) {
    await page.setViewportSize({width,height:1080})
    const overflow = await page.locator('.ah-equip-slot').evaluateAll(els => els.flatMap(el => {
      const box=el.getBoundingClientRect(),card=el.querySelector('.ah-minicard')?.getBoundingClientRect()
      return el.scrollWidth>el.clientWidth || (card && (card.left<box.left || card.right>box.right+1 || card.bottom>box.bottom+1)) ? [el.getAttribute('aria-label')] : []
    }))
    expect(overflow).toEqual([])
  }
  await page.setViewportSize({width:1920,height:1080})
  await page.mouse.move(1800,400)
  await page.evaluate(async()=>Promise.all([...document.images].map(img=>img.decode().catch(()=>{}))))
  mkdirSync(output,{recursive:true})
  await page.screenshot({path:output+'equipment-expanding-slots.png',animations:'disabled'})
  await f.update(st => {st.investigators[0].assets=[]})
  await expect(others).toHaveCount(1)
  await expect(spells).toHaveCount(2)
})

test('桌面滚轮定点缩放、卡牌不触发缩放、双击适配', async ({ page }) => {
  const f = await fixture(page)
  const viewport = page.locator('.ah-map-viewport'), scene = page.locator('.ah-map-scene')
  await expect(page.locator('.ah-map-controls')).toHaveCount(0)
  const box = await viewport.boundingBox(), x = 20, y = 20
  const geometry = () => scene.evaluate(el => { const m = new DOMMatrix(getComputedStyle(el).transform); return { scale:m.a, x:m.e, y:m.f } })
  const before = await geometry()
  await page.mouse.move(box.x+x, box.y+y)
  await page.mouse.wheel(0,-120)
  await expect.poll(async () => (await geometry()).scale).toBeGreaterThan(before.scale)
  const after = await geometry()
  // Computed transform matrices round to six significant digits.
  expect((x-before.x)/before.scale).toBeCloseTo((x-after.x)/after.scale, 2)
  expect((y-before.y)/before.scale).toBeCloseTo((y-after.y)/after.scale, 2)
  await page.locator('.ah-map-node').first().hover()
  await page.mouse.wheel(0,120)
  await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))))
  expect((await geometry()).scale).toBe(after.scale)
  await page.mouse.move(box.x+x, box.y+y)
  await page.mouse.wheel(0,120)
  await expect.poll(async () => (await geometry()).scale).toBeCloseTo(before.scale, 3)
  await viewport.press('+')
  await viewport.dblclick({ position: { x, y } })
  await expect.poll(async () => (await geometry()).scale).toBeCloseTo(before.scale, 3)
  expect(f.submitted).toHaveLength(0)
})

test('地点附着诡计显示卡图，支持查看详情并随效果解除移除', async ({ page }) => {
  await page.setViewportSize({width:1440,height:1000})
  const f=await fixture(page)
  const map=page.locator('.ah-map-node[data-location-id="study"]')
  await f.update(st=>{
    const loc=st.locations.find(loc=>loc.id==='study')
    loc.fog=1;loc.fogCode='obscuringFog';loc.shroudMod=2
    loc.locked=true;loc.lockedDoorCode='lockedDoor'
    loc.barricade={ownerSeat:0}
    // Alias and printed code must not duplicate the same attached card.
    loc.attachments=['01168']
  })
  await expect(map.locator('.ah-map-attachment')).toHaveCount(3)
  await expect(map.locator('[data-map-info="attached"]')).toHaveText('3')
  for(const code of ['01168','01174','01038']){
    const marker=map.locator('.ah-map-attachment').filter({has:page.locator(`[data-art-code="${code}"]`)})
    await expect(marker.locator('img')).toBeVisible()
    await marker.click()
    const dialog=page.getByRole('dialog',{name:'卡牌详情'})
    await expect(dialog).toBeVisible()
    await expect(dialog).toContainText(code)
    await page.getByRole('button',{name:'关闭卡牌详情'}).click()
  }
  await map.locator('[data-map-info="attached"]').click()
  await expect(page.locator('.ah-location-attachments button')).toHaveCount(3)
  await page.getByRole('button',{name:'关闭卡牌详情'}).click()
  expect(f.submitted).toHaveLength(0)
  await page.mouse.move(1200,400)
  mkdirSync(output,{recursive:true})
  await page.screenshot({path:output+'location-attachments.png',animations:'disabled'})
  await f.update(st=>{
    const loc=st.locations.find(loc=>loc.id==='study')
    loc.fog=0;loc.shroudMod=0;loc.locked=false;loc.attachments=[]
    delete loc.fogCode;delete loc.lockedDoorCode;delete loc.barricade
  })
  await expect(map.locator('.ah-map-attachment')).toHaveCount(0)
  await expect(map.locator('[data-map-info="attached"]')).toHaveCount(0)
})

test('地图肖像、怪物、资源与场景卡可查看；交战区遵循归属且接受合法目标', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 })
  const f = await fixture(page, { players: 2 })
  const enemy = (id, extra) => ({ id, code:'01160', originalCode:'01160', name:'食尸鬼 '+id, location:'study', health:3, damageTaken:1, fight:2, evade:2, ...extra })
  await f.update(st => {
    st.investigators[0].location = 'study'
    st.enemies = [enemy('engaged',{engagedSeat:0}),enemy('teammate',{engagedSeat:1}),enemy('massive',{massive:true}),enemy('roaming',{}),enemy('remote',{massive:true,location:'hallway'})]
    const loc = st.locations.find(loc => loc.id==='study'); loc.clues=3; loc.doom=1; loc.resources=2
    st.storyAssets=[{id:'story',code:'01117',location:'study'}]
    st.legalMoves.push({action:'engage',enemyId:'roaming',label:'交战'})
  })
  const zone=page.getByRole('region',{name:'交战区',exact:true})
  await expect(zone).toHaveAttribute('data-engaged-count','2', {timeout:10000})
  await expect(zone.locator('[data-interaction="enemy:teammate"]')).toHaveCount(0)
  await expect(zone.locator('.ah-enemy')).toHaveCount(2)
  const map=page.locator('.ah-map-node[data-location-id="study"]')
  await expect(map.locator('.ah-map-investigator img').first()).toBeVisible()
  await map.locator('.ah-map-investigator').first().click()
  await expect(page.getByRole('dialog',{name:'卡牌详情'})).toBeVisible()
  await page.getByRole('button',{name:'关闭卡牌详情'}).click()
  for(const selector of ['[data-interaction="enemy:engaged"]','[data-map-info="clues"]','[data-map-info="doom"]','[data-map-info="resources"]','[data-map-info="story"]']) {
    await map.locator(selector).click()
    await expect(page.getByRole('dialog',{name:'卡牌详情'})).toBeVisible()
    await page.getByRole('button',{name:'关闭卡牌详情'}).click()
  }
  expect(f.submitted).toHaveLength(0)
  await expect(page.locator('.ah-table')).not.toHaveClass(/ah-presenting/)
  // 可交战敌人：左键点击直接弹出交战等行动按钮，不再先打开详情。
  await map.locator('[data-interaction="enemy:roaming"]').click()
  await expect(page.getByRole('dialog',{name:'卡牌详情'})).toHaveCount(0)
  await expect(page.locator('.ah-card-action-popover')).toBeVisible()
  await expect(page.getByRole('button',{name:'交战',exact:true})).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.locator('.ah-card-action-popover')).toHaveCount(0)
  // 右键仍可查看该敌人的详情。
  await map.locator('[data-interaction="enemy:roaming"]').click({button:'right'})
  await expect(page.getByRole('dialog',{name:'卡牌详情'})).toBeVisible()
  await page.getByRole('button',{name:'关闭卡牌详情'}).click()
  // 移动端同样以点击弹出交战按钮（窄屏地图可能被裁切，直接派发点击以验证交互）。
  await page.setViewportSize({width:390,height:844})
  await page.locator('.ah-map-viewport').press('0')
  await expect(map.locator('[data-interaction="enemy:roaming"]')).toHaveAttribute('aria-label', /可交战/)
  await map.locator('[data-interaction="enemy:roaming"]').dispatchEvent('click')
  await expect(page.getByRole('button',{name:'交战',exact:true})).toBeInViewport()
  await page.keyboard.press('Escape')
  await page.setViewportSize({width:1920,height:1080})
  await page.locator('.ah-map-viewport').press('0')
  await expect(map).toBeVisible()
  await entity(page,'hand:0:1').click()
  const play=entity(page,'zone:play'), bounds=await play.boundingBox()
  expect(bounds.height/bounds.width).toBeCloseTo(1.4,1)
  await expect(play.locator('.ah-table-art')).toHaveAttribute('data-art-code','01088')
  await map.locator('[data-map-info="clues"]').click()
  await expect(page.locator('.ah-location-detail [data-location-stat="clues"].is-focused strong')).toHaveText('3')
  await page.getByRole('button',{name:'关闭卡牌详情'}).click()
  expect(f.submitted).toHaveLength(0)
  await page.evaluate(async()=>Promise.all([...document.images].map(img=>img.decode().catch(()=>{}))))
  await page.screenshot({path:output+'table-surface-desktop.png',animations:'disabled'})
  await f.update(st=>{st.legalMoves=[{action:'ability',assetId:'gun',abilityIndex:0,targetId:'engaged',label:'使用手枪'}]})
  await entity(page,'asset:gun').dragTo(zone.locator('[data-interaction="enemy:engaged"]'))
  await expect.poll(()=>f.submitted.length).toBe(1)
  expect(f.submitted[0].move.targetId).toBe('engaged')
  await f.update(st=>{st.enemies=[]})
  await expect(zone).toHaveCount(0)
})
function choice(st, kind, ids) {
  st.pendingChoice = { id: `q-${kind}-${st.revision}`, kind, seat: 0, prompt: '操作对应卡牌或场上目标', options: ids.map(id => ({ id, label: id })) }
  st.legalMoves = st.pendingChoice.options.map(o => ({ action: 'choose', choiceId: st.pendingChoice.id, optionId: o.id, label: o.label }))
}

test('快速反应不再询问、卡面开关恢复与刷新记忆，关闭不打出卡牌',async({page})=>{
  const f=await fixture(page)
  await f.update(st=>{
    st.cards['01023']={...(st.cards['01023']||{}),code:'01023',name:'闪躲',hasReactionPrompt:true}
    st.investigators[0].hand=['01023'];st.legalMoves=[]
  })
  await expect(page.locator('.ah-table')).not.toHaveClass(/ah-presenting/)
  // 卡面开关只有一颗可开关的闪电图标（不再显示「反应开/反应关」文字）。
  const toggle=page.locator('.ah-hand-card [data-reaction-code="01023"]')
  await expect(toggle).toHaveAttribute('data-reaction-mode','ask')
  await expect(toggle).toHaveAttribute('role','switch')
  await expect(toggle).toHaveAttribute('aria-checked','true')
  await expect(toggle).toHaveText('')
  await expect(toggle.locator('.ah-icon')).toHaveCount(1)
  mkdirSync(output,{recursive:true})
  await page.screenshot({path:output+'reaction-lightning-card.png',animations:'disabled'})
  const reaction=async id=>f.update(st=>{
    st.pendingChoice={id,seat:0,kind:'reaction',source:{type:'window',when:'enemyAttack'},canSkip:true,prompt:'是否打出快速反应卡？',options:[{id:'skip',label:'不打出'},{id:'0',label:'闪躲'}]}
    st.legalMoves=st.pendingChoice.options.map(o=>({action:'choose',choiceId:id,optionId:o.id,label:o.label}))
  })
  await reaction('r1')
  await page.getByRole('button',{name:'本局不再询问'}).click()
  await expect.poll(()=>f.submitted.length).toBe(1)
  expect(f.submitted[0].move).toMatchObject({action:'choose',optionId:'skip'})
  await expect(toggle).toHaveAttribute('data-reaction-mode','skip')
  await expect(toggle).toHaveAttribute('aria-checked','false')
  await expect(toggle.locator('.ah-reaction-slash')).toHaveCount(1)
  await page.reload()
  await expect(toggle).toHaveAttribute('data-reaction-mode','skip')
  await expect(toggle).toHaveAttribute('aria-checked','false')
  await page.evaluate(()=>{
    window.autoPassPromptAdds=0
    window.autoPassPromptObserver=new MutationObserver(records=>{
      for(const record of records)for(const node of record.addedNodes)if(node.nodeType===Node.ELEMENT_NODE &&
        (node.matches?.('.ah-direct-prompt[data-choice-id="r2"]') || node.querySelector?.('.ah-direct-prompt[data-choice-id="r2"]'))) {
        window.autoPassPromptAdds++
      }
    })
    window.autoPassPromptObserver.observe(document.getElementById('app'),{childList:true,subtree:true})
  })
  await reaction('r2')
  await expect.poll(()=>f.submitted.length).toBe(2)
  expect(f.submitted[1].move).toMatchObject({action:'choose',choiceId:'r2',optionId:'skip'})
  await expect(page.locator('.ah-direct-prompt')).toHaveCount(0)
  expect(await page.evaluate(()=>{window.autoPassPromptObserver.disconnect();return window.autoPassPromptAdds})).toBe(0)
  await toggle.click()
  await expect(toggle).toHaveAttribute('data-reaction-mode','ask')
  await expect(toggle).toHaveAttribute('aria-checked','true')
  // 点开关只切反应状态：不选中手牌、不弹行动浮层、也不触发拖动。
  await expect(page.locator('.ah-carddetail-modal')).toHaveCount(0)
  await expect(page.locator('.ah-minicard.is-selected')).toHaveCount(0)
  await expect(page.locator('.ah-card-action-popover')).toHaveCount(0)
  expect(f.submitted.length).toBe(2)
  await reaction('r3')
  await expect(page.getByRole('button',{name:'本局不再询问'})).toBeVisible()
  await page.getByRole('button',{name:'不打出',exact:true}).click()
  await expect.poll(()=>f.submitted.length).toBe(3)
  await expect(toggle).toHaveAttribute('data-reaction-mode','ask')
  await expect(toggle).toHaveAttribute('aria-checked','true')
})

test('场上的体能训练保留快速反应开关，可关掉再打开',async({page})=>{
  const f=await fixture(page)
  // 01017 的天赋档位在 Phase 5 搬到条目层：卡定义必须仍带 hasReactionPrompt，
  // 否则「不再询问」之后没有入口恢复提示。
  expect(f.session.state.cards['01017'].hasReactionPrompt).toBe(true)
  await f.update(st=>{
    st.investigators[0].assets=[{id:'pt',code:'01017',exhausted:false}]
    st.investigators[0].threat=[{id:'cop',code:'01018'}]
    st.legalMoves=[]
  })
  const toggle=page.locator('.ah-table [data-reaction-code="01017"]').first()
  await expect(toggle).toBeVisible()
  await expect(toggle).toHaveAttribute('data-reaction-mode','ask')
  await expect(toggle).toHaveAttribute('role','switch')
  await expect(toggle).toHaveAttribute('aria-checked','true')
  await expect(toggle).toHaveText('')
  await toggle.click()
  await expect(toggle).toHaveAttribute('data-reaction-mode','skip')
  await expect(toggle).toHaveAttribute('aria-checked','false')
  await expect(toggle.locator('.ah-reaction-slash')).toHaveCount(1)
  // 点开关不能把这张资产卡打开成详情或选中。
  await expect(page.locator('.ah-carddetail-modal')).toHaveCount(0)
  await expect(page.locator('.ah-minicard.is-selected')).toHaveCount(0)
  // 威胁区的小卡走同一个组件：同样只有闪电、可开关。
  const threat=page.locator('.ah-threat-row [data-reaction-code="01018"]').first()
  await expect(threat).toBeVisible()
  await expect(threat).toHaveAttribute('data-reaction-mode','ask')
  await expect(threat).toHaveText('')
  await threat.click()
  await expect(threat).toHaveAttribute('data-reaction-mode','skip')
  await expect(threat.locator('.ah-reaction-slash')).toHaveCount(1)
  mkdirSync(output,{recursive:true})
  await page.screenshot({path:output+'reaction-lightning-asset.png',animations:'disabled'})
  await toggle.click()
  await expect(toggle).toHaveAttribute('data-reaction-mode','ask')
  await expect(toggle).toHaveAttribute('aria-checked','true')
})

test('卡牌详情里的反应开关同样只有可开关的闪电',async({page})=>{
  const f=await fixture(page)
  await f.update(st=>{
    st.cards['01023']={...(st.cards['01023']||{}),code:'01023',name:'闪躲',hasReactionPrompt:true}
    st.investigators[0].hand=['01023'];st.legalMoves=[]
  })
  await page.locator('.ah-hand-card[data-card-code="01023"]').first().click({button:'right'})
  const dialog=page.getByRole('dialog',{name:'卡牌详情'})
  await expect(dialog).toBeVisible()
  const toggle=dialog.locator('[data-reaction-mode][data-reaction-code="01023"]')
  await expect(toggle).toHaveCount(1)
  await expect(toggle).toHaveAttribute('data-reaction-mode','ask')
  await expect(toggle).toHaveText('')
  await expect(toggle.locator('.ah-icon')).toHaveCount(1)
  await toggle.click()
  await expect(toggle).toHaveAttribute('data-reaction-mode','skip')
  await expect(toggle.locator('.ah-reaction-slash')).toHaveCount(1)
  // 开关在详情里是同一个控件，点完详情仍然打开。
  await expect(dialog).toBeVisible()
  mkdirSync(output,{recursive:true})
  await page.screenshot({path:output+'reaction-lightning-detail.png',animations:'disabled'})
  await page.getByRole('button',{name:'关闭卡牌详情'}).click()
  await expect(dialog).toHaveCount(0)
})

test('伤害分配常驻显示并可选择巡警，不会落入更多行动或被零行动点阻止',async({page})=>{
  const f=await fixture(page,{players:2})
  await f.update(st=>{
    st.currentSeat=1;st.investigators[0].actionsLeft=0
    st.investigators[0].assets=[{id:'cop',code:'01018',damage:1,horror:1}]
    st.skillTest=null
    st.pendingChoice={id:'collateral',seat:0,kind:'assign-damage',source:'harm',prompt:'分配 1 点伤害（剩余 1）。',options:[{id:'self',label:'由调查员承受'},{id:'cop',label:'巡警'}]}
    st.legalMoves=st.pendingChoice.options.map(option=>({action:'choose',choiceId:'collateral',optionId:option.id,label:option.label}))
  })
  const prompt=page.getByRole('region',{name:'待决选择'})
  await expect(prompt).toContainText('分配 1 点伤害（剩余 1）')
  await expect(prompt.getByRole('button',{name:'由调查员承受',exact:true})).toBeVisible()
  await expect(prompt.getByRole('button',{name:'巡警',exact:true})).toBeEnabled()
  await expect(page.getByRole('button',{name:'更多行动',exact:true})).toHaveCount(0)
  await prompt.getByRole('button',{name:'巡警',exact:true}).click()
  await expect.poll(()=>f.submitted.length).toBe(1)
  expect(f.submitted[0].move).toMatchObject({action:'choose',choiceId:'collateral',optionId:'cop'})
  await expect(prompt).toHaveCount(0)
})

test('剧本地点行动直接显示在底部栏，点击地点后只显示对应操作',async({page})=>{
  const f=await fixture(page)
  let locationId
  await f.update(st=>{
    locationId=st.investigators[0].location
    st.legalMoves=[
      {action:'resource',label:'获得 1 资源'},
      {action:'scenarioAction',rule:'gamble',locationId,label:'支付 2 资源，在牌室赌博'},
    ]
  })
  await expect(page.getByRole('button',{name:'支付 2 资源，在牌室赌博',exact:true})).toBeVisible()
  await expect(page.getByRole('button',{name:'更多行动',exact:true})).toHaveCount(0)
  await entity(page,`location:${locationId}`).click()
  await expect(page.getByRole('button',{name:'支付 2 资源，在牌室赌博',exact:true})).toBeVisible()
  await expect(page.getByRole('button',{name:'获得 1 资源',exact:true})).toHaveCount(0)
  await page.getByRole('button',{name:'支付 2 资源，在牌室赌博',exact:true}).click()
  await expect.poll(()=>f.submitted.length).toBe(1)
  expect(f.submitted[0].move).toMatchObject({action:'scenarioAction',rule:'gamble',locationId})
})

test('投入区有独立求助按钮，开始行动只确认自己的席位',async({page})=>{
  const f=await fixture(page,{players:2})
  await f.update(st=>{
    choice(st,'commit',['2','help','done'])
    st.skillTest={seat:0,skill:'combat',value:4,difficulty:3,committed:[]}
    st.pendingChoice.options.find(o=>o.id==='help').label='求助'
    st.legalMoves.find(m=>m.optionId==='help').label='求助'
  })
  await expect(page.getByRole('button',{name:'开始检定',exact:true})).toBeVisible()
  await page.getByRole('button',{name:'求助',exact:true}).click()
  expect(f.submitted[0].move.optionId).toBe('help')
  await f.update(st=>{
    st.skillTest=null;choice(st,'turnOrder',['0'])
    st.pendingChoice.options[0].label='开始行动';st.legalMoves[0].label='开始行动'
  })
  await page.getByRole('button',{name:'开始行动',exact:true}).click()
  expect(f.submitted[1].move.optionId).toBe('0')
})

test('剧情技能选项自适应窗口并显示对应技能图标',async({page})=>{
  await page.setViewportSize({width:1024,height:768})
  const f=await fixture(page)
  await f.update(st=>{
    st.pendingChoice={id:'skill-route',kind:'story',seat:0,prompt:'选择取得钥匙的方式。',options:[
      {id:'combat',label:'由一位调查员检定combat（4）'},
      {id:'agility',label:'由一位调查员检定agility（4）'},
      {id:'intellect',label:'由一位调查员检定intellect（4）'},
      {id:'force',label:'强行夺走钥匙'},
    ]}
    st.legalMoves=st.pendingChoice.options.map(option=>({action:'choose',choiceId:'skill-route',optionId:option.id,label:option.label}))
  })
  const choices=page.locator('.ah-visual-choices')
  await expect(choices.locator('.ah-visual-option')).toHaveCount(4)
  await expect(choices.locator('[data-card-symbol="combat"]')).toHaveCount(1)
  await expect(choices.locator('[data-card-symbol="agility"]')).toHaveCount(1)
  await expect(choices.locator('[data-card-symbol="intellect"]')).toHaveCount(1)
  await expect(choices).not.toContainText(/combat|agility|intellect/i)
  const layout=await choices.evaluate(element=>{
    const box=element.getBoundingClientRect()
    return {left:box.left,right:box.right,viewport:innerWidth,overflow:element.scrollWidth-element.clientWidth}
  })
  expect(layout.left).toBeGreaterThanOrEqual(0)
  expect(layout.right).toBeLessThanOrEqual(layout.viewport)
  expect(layout.overflow).toBe(0)
  const iconPaths=await choices.locator('.ah-effect-option > .ah-icon path').evaluateAll(paths=>paths.slice(0,3).map(path=>path.getAttribute('d')))
  expect(new Set(iconPaths).size).toBe(3)
})

test('混乱标记选项显示真实标记图案与名称，不再把 emoji 当图标',async({page})=>{
  await page.setViewportSize({width:1440,height:960})
  const f=await fixture(page)
  await f.update(st=>{
    choice(st,'token',['skull','cultist','tablet','elderthing'])
    st.pendingChoice.prompt='逆反：选择本次检定要忽略的混乱符号。'
    for(const option of st.pendingChoice.options)option.label=st.tokenLabels[option.id]
    for(const move of st.legalMoves)move.label=st.tokenLabels[move.optionId]
  })
  const choices=page.locator('.ah-visual-choices'), offers=choices.locator('.ah-visual-option')
  await expect(offers).toHaveCount(4)
  await expect(offers.locator('img.ah-choice-token')).toHaveCount(4)
  await expect(offers.locator('.ah-icon')).toHaveCount(0)
  for(const [id,name,file] of [['skull','骷髅','ct-skull'],['cultist','异教徒','ct-cultist'],['tablet','石板','ct-tablet'],['elderthing','古神','ct-elderthing']]){
    const option=choices.locator(`.ah-visual-option[data-option-id="${id}"]`)
    await expect(option).toHaveAttribute('aria-label',name)
    await expect(option).toContainText(name)
    await expect(option.locator('img.ah-choice-token')).toHaveAttribute('src',new RegExp(file+'\\.png$'))
  }
  for(const emoji of ['💀','🕯️','🗿','👁️'])await expect(choices).not.toContainText(emoji)
  await expect.poll(()=>page.evaluate(()=>[...document.querySelectorAll('.ah-choice-token')].every(img=>img.complete&&img.naturalWidth>0))).toBe(true)
  mkdirSync(output,{recursive:true})
  await page.screenshot({path:output+'/token-choice-desktop.png',animations:'disabled'})
  // 移动端 390：面板不越出视口、不横向滚动，图案与名称仍完整。
  await page.setViewportSize({width:390,height:844})
  await expect(offers).toHaveCount(4)
  const layout=await choices.evaluate(element=>{const box=element.getBoundingClientRect();return {left:box.left,right:box.right,viewport:innerWidth,overflow:element.scrollWidth-element.clientWidth}})
  expect(layout.left).toBeGreaterThanOrEqual(0)
  expect(layout.right).toBeLessThanOrEqual(layout.viewport)
  expect(layout.overflow).toBe(0)
  await page.screenshot({path:output+'/token-choice-mobile.png',animations:'disabled'})
  await page.setViewportSize({width:1440,height:960})
  await choices.locator('.ah-visual-option[data-option-id="skull"]').click()
  await expect.poll(()=>f.submitted.length).toBe(1)
  expect(f.submitted[0].move.optionId).toBe('skull')
})

test('常驻槽位：错槽不提交、拖动装备与事件、点击替代拖动', async ({ page }) => {
  const f = await fixture(page)
  await expect(page.locator('.ah-equip-slot')).toHaveCount(9)
  await page.dragAndDrop('[data-interaction="hand:0:1"]','[data-interaction="slot:hand"][data-slot-index="1"]')
  expect(f.submitted).toHaveLength(0)
  await expect(page.getByText('此处不能使用这张牌，已放回原位。')).toBeVisible()
  await page.dragAndDrop('[data-interaction="hand:0:0"]','[data-interaction="slot:hand"][data-slot-index="1"]')
  await expect.poll(() => f.submitted.length).toBe(1)
  expect(f.submitted[0].move).toMatchObject({ action: 'play', cardId: '01087', revision: 0 })
  await f.update(st => { st.legalMoves = [{ action: 'play', cardId: '01088', label: '打出应急物品' }] })
  await entity(page,'hand:0:1').click()
  await expect(entity(page,'zone:play')).toHaveClass(/ah-drop-valid/)
  await entity(page,'zone:play').click()
  await expect.poll(() => f.submitted.length).toBe(2)
  expect(f.submitted[1].move.cardId).toBe('01088')
})

test('角色顺序、手牌换牌与弃牌、装备替换、伤害分配直接点选', async ({ page }) => {
  const f = await fixture(page,{ players: 2 })
  for (const [kind,id,key] of [['turnOrder','1','investigator:1'],['mulligan','3','hand:0:3'],['discard','3','hand:0:3'],['assetReplacement','gun','asset:gun'],['assign-damage','self','investigator:0'],['assign-horror','gun','asset:gun']]) {
    await f.update(st => choice(st,kind,[id]))
    await expect(entity(page,key)).toHaveClass(/ah-direct-choice/)
    await entity(page,key).click()
    await expect.poll(() => f.submitted.at(-1)?.move.optionId).toBe(id)
    expect(f.submitted.at(-1).move.choiceId).toContain(kind)
    await expect(page.locator('.ah-direct-prompt')).toHaveCount(0)
  }
  expect(f.submitted).toHaveLength(6)
})

test('检定投入拖放、装备指向敌人、角色拖向敌人和地点', async ({ page }) => {
  const f = await fixture(page)
  await f.update(st => { choice(st,'commit',['2','done']); st.skillTest = { skill: 'combat', value: 4, difficulty: 3, committed: [] } })
  await page.dragAndDrop('[data-interaction="hand:0:2"]','[data-interaction="zone:commit"]')
  await expect.poll(() => f.submitted.length).toBe(1)
  expect(f.submitted[0].move.optionId).toBe('2')
  await f.update(st => {
    st.skillTest = null; st.enemies = [{ id: 'enemy-1', code: '01160', originalCode: '01160', name: '食尸鬼', location: 'study', health: 2, damageTaken: 0, fight: 2, evade: 2 }]
    st.legalMoves = [{ action: 'ability', assetId: 'gun', abilityIndex: 0, targetId: 'enemy-1', label: '使用手枪' }]
  })
  await page.dragAndDrop('[data-interaction="asset:gun"]','[data-interaction="enemy:enemy-1"]')
  await expect.poll(() => f.submitted.length).toBe(2)
  expect(f.submitted[1].move).toMatchObject({ action: 'ability', assetId: 'gun', targetId: 'enemy-1' })
  await f.update(st => { st.legalMoves = [{ action: 'fight', enemyId: 'enemy-1', label: '攻击' }] })
  await entity(page,'investigator:0').dragTo(entity(page,'enemy:enemy-1'))
  await expect.poll(() => f.submitted.length).toBe(3)
  expect(f.submitted[2].move.action).toBe('fight')
  await f.update(st => { st.legalMoves = [{ action: 'move', locationId: 'study', label: '移动' }] })
  await entity(page,'investigator:0').dragTo(entity(page,'location:study'))
  await expect.poll(() => f.submitted.length).toBe(4)
  expect(f.submitted[3].move.action).toBe('move')
})

test('公开搜索卡面、触屏拖动、取消手势与五种尺寸', async ({ page }) => {
  const f = await fixture(page,{ players: 2 })
  await f.update(st => {
    choice(st,'search',['0','1','skip'])
    st.pendingChoice.options[0].cardCode = '01087'; st.pendingChoice.options[1].cardCode = '01088'
  })
  await expect(page.locator('.ah-visual-option.has-art')).toHaveCount(2)
  await page.locator('.ah-visual-option[data-option-id="1"]').click()
  expect(f.submitted[0].move.optionId).toBe('1')
  await f.update(st => { st.legalMoves = [{ action: 'play', cardId: '01087', label: '装备手电筒' }] })
  const source = entity(page,'hand:0:0'), target = entity(page,'slot:hand')
  const a = await source.boundingBox(), b = await target.boundingBox()
  await source.dispatchEvent('pointerdown',{ pointerId: 9, pointerType: 'touch', button: 0, clientX: a.x+20, clientY: a.y+20 })
  await page.locator('body').dispatchEvent('pointermove',{ pointerId: 9, pointerType: 'touch', clientX: b.x+20, clientY: b.y+20 })
  await expect(page.locator('.ah-card-ghost')).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.locator('.ah-card-ghost')).toHaveCount(0)
  expect(f.submitted).toHaveLength(1)
  await source.dispatchEvent('pointerdown',{ pointerId: 10, pointerType: 'touch', button: 0, clientX: a.x+20, clientY: a.y+20 })
  await page.locator('body').dispatchEvent('pointermove',{ pointerId: 10, pointerType: 'touch', clientX: b.x+20, clientY: b.y+20 })
  await page.locator('body').dispatchEvent('pointerup',{ pointerId: 10, pointerType: 'touch', clientX: b.x+20, clientY: b.y+20 })
  await expect.poll(() => f.submitted.length).toBe(2)
  mkdirSync(output,{ recursive:true })
  for (const size of [{ width:1920,height:1080 },{ width:1366,height:768 },{ width:960,height:800 },{ width:768,height:1024 },{ width:390,height:844 }]) {
    await page.setViewportSize(size)
    for (const region of ['地点地图','玩家区','上下文动作栏']) {
      const el=page.getByRole('region',{name:region}); await expect(el).toBeInViewport({ratio:1})
      expect((await el.boundingBox()).height).toBeGreaterThan(30)
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    await page.screenshot({path: output+`direct-cards-${size.width}.png`,animations:'disabled'})
  }
})

test('服务端拒绝与等待中不移动卡牌，不重复提交，AI 回答不可代选', async ({ page }) => {
  let release
  const gate = new Promise(resolve => release=resolve)
  const f = await fixture(page,{players:2,onMove:async(route,body,session)=>{
    await gate; session.state.revision++
    await route.fulfill({status:409,json:{ok:false,error:'状态版本已变化',session}})
  }})
  await entity(page,'hand:0:0').click(); await entity(page,'slot:hand').click()
  await expect.poll(()=>f.submitted.length).toBe(1)
  await expect(page.locator('.ah-hand-card')).toHaveCount(4)
  await entity(page,'slot:hand').click()
  expect(f.submitted).toHaveLength(1)
  release(); await expect(page.getByText('状态版本已变化')).toBeVisible()
  await expect(page.locator('.ah-hand-card')).toHaveCount(4)
  f.session.actingSeats=[1]
  await f.update(st=>{choice(st,'turnOrder',['0','1']);st.pendingChoice.seat=1})
  await entity(page,'investigator:0').click()
  expect(f.submitted).toHaveLength(1)
})

test('预知卡牌拖动排序与其他角色装备候选不丢失', async ({ page }) => {
  const f=await fixture(page,{players:2})
  await f.update(st=>{
    choice(st,'scry',['0','1'])
    st.pendingChoice.options[0].cardCodes=['01087','01088']; st.pendingChoice.options[1].cardCodes=['01088','01087']
  })
  await page.locator('[data-order-index="0"]').dragTo(page.locator('[data-order-index="1"]'))
  await page.getByRole('button',{name:'确认牌序'}).click()
  expect(f.submitted[0].move.optionId).toBe('1')
  await f.update(st=>{ st.investigators[1].assets=[{id:'ally-gun',code:'01016'}]; choice(st,'reload',['ally-gun']) })
  const offer=page.locator('.ah-visual-option[data-option-id="ally-gun"]')
  await expect(offer).toBeVisible(); await expect(offer.locator('.ah-table-art')).toHaveCount(1)
  await offer.click(); expect(f.submitted[1].move.optionId).toBe('ally-gun')
})

test('真实规则：拖动支援牌到槽位后才扣费、入场，右键仍可看详情', async ({page})=>{
  await page.route('**/api/start',route=>route.continue({postData:JSON.stringify({modId:'arkhamhorror',settings:{legacyAutoStart:true,playerCount:1,playerInvestigator:'01001',seed:'p4-acceptance'}})}))
  await page.goto('/index.html'); await page.locator('.bg-card').filter({hasText:'诡镇奇谈'}).click()
  let response=page.waitForResponse('**/api/start'); await page.getByRole('button',{name:'开始新游戏'}).click()
  let session=(await (await response).json()).session
  // 开场「故事导入 → 密谋揭示」先于换牌：先跳过故事幕，再逐项回答换牌。
  const skipScene=page.getByRole('button',{name:'跳过演出'})
  await expect(skipScene).toBeVisible({timeout:10000})
  await skipScene.click()
  for(let i=0;session.state.pendingChoice;i++) {
    expect(i).toBeLessThan(15)
    const m=session.state.legalMoves.find(m=>['done','skip'].includes(m.optionId))||session.state.legalMoves[0]
    response=page.waitForResponse('**/api/move')
    await page.locator(`[data-option-id="${m.optionId}"]:visible`).first().click()
    session=(await (await response).json()).session
  }
  const m=session.state.legalMoves.find(m=>m.action==='play'&&session.state.cards[m.cardId]?.type==='asset')
  expect(m).toBeTruthy()
  const card=page.locator(`.ah-hand-card[data-card-code="${m.cardId}"]`).first()
  await card.click({button:'right'}); await expect(page.getByRole('dialog',{name:'卡牌详情'})).toBeVisible()
  await page.getByRole('button',{name:'关闭卡牌详情'}).click()
  const before=session.state.investigators[0],def=session.state.cards[m.cardId]
  const slot=String(def.slots?.[0]||def.slot||'other').toLowerCase().replace(/\s/g,'').replace('handx2','hand')
  response=page.waitForResponse('**/api/move')
  await card.dragTo(page.locator(`.ah-equip-slot[data-slot="${slot}"]`).first())
  const result=await (await response).json(); expect(result.ok).toBe(true)
  const after=result.session.state.investigators[0]
  expect(after.hand).toHaveLength(before.hand.length-1)
  expect(after.assets.some(a=>a.code===m.cardId)).toBe(true)
  expect(after.resources).toBeLessThanOrEqual(before.resources)
  await expect(page.locator(`.ah-equipment-battlefield [data-card-code="${m.cardId}"]`)).toBeVisible()
})
test('从弃牌堆选牌显示真实候选卡面，不误选手牌，并在桌面与移动端可用', async ({ page }) => {
  const f = await fixture(page, { players: 1 })
  const setCardChoice = st => {
    st.investigators[0].discard = ['01088', '01016']
    st.investigators[0].hand = ['01087', '01088', '01025', '01087']
    st.pendingChoice = { id: `yorick-card-${st.revision}`, kind: 'card', seat: 0, source: 'yorickAsset',
      prompt: '选择弃牌堆中的一个支援，支付费用并打出。', canSkip: true, options: [
        { id: 'skip', label: '不打出支援' },
        { id: '1', cardCode: '01016', label: '.45自动手枪（4资源）' },
      ] }
    st.legalMoves = [{ action: 'choose', choiceId: st.pendingChoice.id, optionId: 'skip', label: '不打出支援' },
      { action: 'choose', choiceId: st.pendingChoice.id, optionId: '1', label: '.45自动手枪（4资源）' }]
  }
  const offer = page.locator('.ah-visual-choices .ah-visual-option[data-option-id="1"]')
  setCardChoice(f.session.state)
  await f.update(() => {})
  await expect(page.locator('.ah-direct-instruction')).toContainText('选择一张牌')
  await expect(page.locator('.ah-direct-instruction')).toContainText('选择弃牌堆中的一个支援')
  await expect(offer).toHaveClass(/has-art/)
  await expect(offer.locator('.ah-table-art')).toHaveAttribute('data-art-code', '01016')
  expect(await page.locator('.ah-hand-card[data-option-id]').count()).toBe(0)
  expect(await page.locator('.ah-hand-card.ah-direct-choice').count()).toBe(0)
  mkdirSync(output, { recursive: true })
  await page.setViewportSize({ width: 1440, height: 1000 })
  await page.screenshot({ path: output + '/discard-pile-1440.png', animations: 'disabled' })
  await offer.click()
  await expect.poll(() => f.submitted.length).toBe(1)
  expect(f.submitted[0].move).toMatchObject({ action: 'choose', optionId: '1' })

  setCardChoice(f.session.state)
  await f.update(() => {})
  await page.setViewportSize({ width: 390, height: 844 })
  await expect(offer).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await page.screenshot({ path: output + '/discard-pile-390.png', animations: 'disabled' })
  await offer.click()
  await expect.poll(() => f.submitted.length).toBe(2)
  expect(f.submitted[1].move).toMatchObject({ action: 'choose', optionId: '1' })
})
test('主动拖入怪物交战，猎物并列时角色选项常显且支持拖向队友',async({page})=>{
  await page.setViewportSize({width:1440,height:1000})
  const f=await fixture(page,{players:3})
  await f.update(st=>{
    st.enemies=[{id:'pull',code:'01160',name:'食尸鬼爪牙',health:2,damageTaken:0,fight:2,evade:2,location:st.investigators[0].location,engagedSeat:null,exhausted:true}]
    st.legalMoves=[{action:'engage',enemyId:'pull',label:'与食尸鬼爪牙交战'}]
  })
  const enemy=page.locator('.ah-map-node [data-interaction="enemy:pull"]')
  await expect(enemy).toHaveClass(/ah-card-ready/)
  await enemy.hover()
  const source=await enemy.boundingBox()
  await page.screenshot({path:output+'engage-before-drag.png'})
  await page.mouse.move(source.x+source.width/2,source.y+source.height/2);await page.mouse.down()
  await page.mouse.move(source.x+20,source.y+60,{steps:6})
  const zone=page.locator('.ah-engage-drop')
  await expect(zone).toBeVisible();await expect(zone).toHaveClass(/ah-drop-valid/)
  await page.screenshot({path:output+'engage-drop-target.png'})
  const target=await zone.boundingBox()
  await page.mouse.move(target.x+target.width/2,target.y+target.height/2,{steps:8});await page.mouse.up()
  await expect.poll(()=>f.submitted.length).toBe(1)
  expect(f.submitted[0].move).toMatchObject({action:'engage',enemyId:'pull'})
  await expect(zone).toBeHidden()
  const prey=st=>{
    st.pendingChoice={id:'prey-pull',kind:'prey',seat:0,source:{type:'enemy',id:'pull',code:'01160'},prompt:'选择食尸鬼爪牙的猎物',options:st.investigators.map(inv=>({id:String(inv.seat),label:inv.name}))}
    st.legalMoves=st.pendingChoice.options.map(o=>({action:'choose',choiceId:'prey-pull',optionId:o.id,label:o.label}))
  }
  await f.update(prey)
  const offers=page.locator('.ah-visual-choices .ah-visual-option')
  await expect(offers).toHaveCount(3)
  for(let i=0;i<3;i++)await expect(offers.nth(i)).toBeVisible()
  await page.screenshot({path:output+'prey-choice-targets.png'})
  await offers.nth(1).click()
  await expect.poll(()=>f.submitted.length).toBe(2)
  expect(f.submitted[1].move.optionId).toBe('1')
  await f.update(prey)
  await enemy.hover()
  const start=await enemy.boundingBox(), end=await offers.nth(2).boundingBox()
  await page.mouse.move(start.x+start.width/2,start.y+start.height/2);await page.mouse.down()
  await page.mouse.move(end.x+end.width/2,end.y+end.height/2,{steps:12});await page.mouse.up()
  await expect.poll(()=>f.submitted.length).toBe(3)
  expect(f.submitted[2].move).toMatchObject({action:'choose',choiceId:'prey-pull',optionId:'2'})
})
