import test from 'node:test'
import assert from 'node:assert/strict'
import { choicePresentation, entityMoves, targetMoves, investigatorHoldsCard } from '../web/card-interactions.js'
import { createGameState, legalMoves, validateMove, applyMove } from '../src/engine/engine.js'
import { viewState } from '../src/integration/observation.js'
import { laterBehavior } from '../content/campaigns/theDunwichLegacy/later-behaviors.js'

test('card bindings distinguish duplicate hand positions, candidate indices, and other investigators', () => {
  const st = { investigators: [{ seat: 0, hand: ['a','a'], assets: [] },{ seat: 1, hand: [], assets: [{ id:'ally-asset',code:'b' }] }],
    cards:{ a:{code:'a',name:'同名牌'},b:{code:'b',name:'候选牌'} }, pendingChoice:{id:'q',kind:'discard',seat:0,options:[{id:'1',label:'同名牌'}]},
    legalMoves:[{action:'choose',choiceId:'q',optionId:'1'}] }
  assert.equal(choicePresentation(st)[0].key,'hand:0:1')
  assert.equal(entityMoves(st,'hand:0:0').length,0)
  st.pendingChoice.kind='search'; st.pendingChoice.options[0].cardCode='b'
  assert.deepEqual(choicePresentation(st)[0].cards,[st.cards.b])
  assert.equal(choicePresentation(st)[0].key,null)
  st.pendingChoice.kind='reload'; st.legalMoves[0].optionId='ally-asset'
  assert.equal(choicePresentation(st)[0].key,'asset:ally-asset')
  st.pendingChoice.kind='playerWindow'; st.pendingChoice.options=[{id:'ally-asset:0:e1',assetId:'ally-asset',targetId:'e1'}]
  st.legalMoves[0].optionId='ally-asset:0:e1'
  assert.equal(targetMoves(st,'asset:ally-asset','enemy:e1').length,1)
  assert.equal(targetMoves(st,'asset:ally-asset','enemy:e2').length,0)
})

test('card choices bind candidate art by cardCode and never to hand positions', () => {
  const st = { investigators: [{ seat: 0, hand: ['a', 'b'], discard: ['x', 'y'], assets: [] }],
    cards: { a: { code: 'a', name: '手牌 A' }, b: { code: 'b', name: '手牌 B' },
      x: { code: 'x', name: '弃牌 X' }, y: { code: 'y', name: '弃牌 Y' } },
    pendingChoice: { id: 'q', kind: 'card', seat: 0, canSkip: true, options: [
      { id: 'skip', label: '不选择' }, { id: '0', cardCode: 'x', label: '弃牌 X' }, { id: '1', cardCode: 'y', label: '弃牌 Y' }] },
    legalMoves: [{ action: 'choose', choiceId: 'q', optionId: 'skip' }, { action: 'choose', choiceId: 'q', optionId: '0' },
      { action: 'choose', choiceId: 'q', optionId: '1' }] }
  const picked = choicePresentation(st).find(item => item.move.optionId === '1')
  assert.equal(picked.key, null)
  assert.equal(picked.code, 'y')
  assert.deepEqual(picked.cards.map(card => card.code), ['y'])
  assert.equal(entityMoves(st, 'hand:0:0').length, 0)
  assert.deepEqual(choicePresentation(st).map(item => item.move.optionId), ['skip', '0', '1'])
})

test('drop targets obey legal actions and slot requirements; skills never become play actions', () => {
  const st={currentSeat:0,investigators:[{seat:0,hand:['gun','event','skill']}],cards:{gun:{type:'asset',slots:['hand x2']},event:{type:'event'},skill:{type:'skill'}},
    legalMoves:[{action:'play',cardId:'gun'},{action:'play',cardId:'event'},{action:'move',locationId:'hall'}]}
  assert.equal(targetMoves(st,'hand:0:0','slot:hand').length,1)
  assert.equal(targetMoves(st,'hand:0:0','slot:ally').length,0)
  assert.equal(targetMoves(st,'hand:0:1','slot:hand').length,0)
  assert.equal(targetMoves(st,'hand:0:1','zone:play').length,1)
  assert.equal(targetMoves(st,'hand:0:2','zone:play').length,0)
  assert.equal(targetMoves(st,'investigator:0','location:hall').length,1)
  assert.equal(targetMoves(st,'investigator:1','location:hall').length,0)
})

test('weapon with one enemy exposes an explicit legal target and resolves through the normal test', () => {  const st=createGameState({playerInvestigator:'01001',seed:'direct-target'},[{seat:0,name:'玩家'}])
  for(let i=0;st.pendingChoice;i++) {
    assert.ok(i<20)
    const choice=st.pendingChoice,option=choice.options.find(o=>['done','skip'].includes(o.id))||choice.options[0]
    applyMove(st,choice.seat,{action:'choose',choiceId:choice.id,optionId:option.id})
  }
  st.investigators[0].assets.push({id:'ui-gun',code:'01016',uses:4,exhausted:false})
  st.enemies=[{id:'ui-enemy',code:'ghoulMinion',name:'食尸鬼',location:st.investigators[0].location,health:6,damageTaken:0,fight:2,evade:2,damage:1,horror:0,engagedSeat:0}]
  st.investigators[0].engaged=['ui-enemy'];st.chaosBag=['0']
  const move=legalMoves(st).find(m=>m.action==='ability'&&m.assetId==='ui-gun')
  assert.equal(move.targetId,'ui-enemy');assert.equal(validateMove(st,0,move),null)
  applyMove(st,0,move)
  assert.equal(st.pendingChoice.kind,'commit')
  for(let i=0;st.pendingChoice;i++) {
    assert.ok(i<20)
    const q=st.pendingChoice,option=q.options.find(o=>['done','skip','self'].includes(o.id))||q.options[0]
    applyMove(st,q.seat,{action:'choose',choiceId:q.id,optionId:option.id})
  }
  assert.equal(st.investigators[0].assets.find(a=>a.id==='ui-gun').uses,3)
  assert.equal(st.enemies.find(e=>e.id==='ui-enemy').damageTaken,2)
})

test('hunch deck revealed card binds choice options back to the table hunch row (05002)', () => {  // 2026-10-27 修复 05002：乔·戴蒙德的直觉牌库揭示牌「如同手牌」——反应窗口的快速事件用
  // option id 'hunch'，收尾玩家窗口用 'fast-card:hunch:<卡号>'；两者都要能映射回直觉区那张牌。
  const st = { investigators: [{ seat: 0, hand: [], assets: [], beneath: [] }],
    hunch: [{ seat: 0, deck: 5, revealed: '01022' }],
    cards: { '01022': { code: '01022', name: '证据！' } },
    pendingChoice: { id: 'q', kind: 'reaction', seat: 0, canSkip: true, options: [
      { id: 'skip', label: '不打出' }, { id: 'hunch', cardCode: '01022', label: '证据！（直觉牌库）' }] },
    legalMoves: [{ action: 'choose', choiceId: 'q', optionId: 'skip' },
      { action: 'choose', choiceId: 'q', optionId: 'hunch' }] }
  const hunchItem = choicePresentation(st).find(item => item.move.optionId === 'hunch')
  assert.equal(hunchItem.key, 'hunch:01022')
  assert.equal(hunchItem.code, '01022')
  assert.equal(entityMoves(st, 'hunch:01022').length, 1, '点直觉区那张牌 = 回答反应窗口')
  // 已揭示的卡号对不上时不绑定，避免把别的牌映射到直觉区。
  st.hunch[0].revealed = '01037'
  assert.equal(choicePresentation(st).find(item => item.move.optionId === 'hunch').key, null)

  const st2 = { investigators: [{ seat: 0, hand: [], assets: [] }],
    hunch: [{ seat: 0, deck: 3, revealed: '01037' }],
    cards: { '01037': { code: '01037', name: '专业的直觉' } },
    pendingChoice: { id: 'w', kind: 'playerWindow', seat: 0, canSkip: true, options: [
      { id: 'skip', label: '让过' }, { id: 'fast-card:hunch:01037', label: '⚡ 快速打出「专业的直觉」（直觉牌库）' }] },
    legalMoves: [{ action: 'choose', choiceId: 'w', optionId: 'skip' },
      { action: 'choose', choiceId: 'w', optionId: 'fast-card:hunch:01037' }] }
  const fast = choicePresentation(st2).find(item => item.move.optionId === 'fast-card:hunch:01037')
  assert.equal(fast.key, 'hunch:01037')
  assert.equal(entityMoves(st2, 'hunch:01037').length, 1, '点直觉区那张牌 = 回答收尾窗口')
})

test('卡面快速反应开关覆盖「如同手牌」通道里的卡（2026-10-28）', () => {
  // 直觉区揭示那张 / 下方 / 背包 / 原定计划 / 宿主附属里的牌，也要能在卡面开/关快速反应；
  // 否则反应窗口里只能「本窗口全部关闭」，无法按卡记忆偏好。
  const base = { seat: 0, code: '05002', hand: [], assets: [], threat: [], beneath: [] }
  const st = { hunch: [{ seat: 0, deck: 5, revealed: '01022' }] }
  assert.equal(investigatorHoldsCard(base, st, '01022'), true, '直觉区揭示那张')
  assert.equal(investigatorHoldsCard({ ...base, beneath: ['01037'] }, st, '01037'), true, '银暮匕首下方')
  assert.equal(investigatorHoldsCard({
    ...base, assets: [{ id: 'bag', code: '04037', attachedCards: ['01036'] }],
  }, st, '01036'), true, '背包附属')
  assert.equal(investigatorHoldsCard({
    ...base, assets: [{ id: 'plan', code: '03264', attached: ['01037'] }],
  }, st, '01037'), true, '原定计划附属')
  assert.equal(investigatorHoldsCard({
    ...base, assets: [{ id: 'host', code: '05279', attachments: [{ id: 'a1', code: '05032' }] }],
  }, st, '05032'), true, '宿主附属事件')
  assert.equal(investigatorHoldsCard({ ...base, hand: ['01036'] }, st, '01036'), true, '手牌')
  assert.equal(investigatorHoldsCard(base, st, '01036'), false, '不在任何可操作区域')
  // 别的座位揭示的直觉牌不会把开关挂到本机角色上。
  assert.equal(investigatorHoldsCard(base, { hunch: [{ seat: 1, deck: 3, revealed: '01037' }] }, '01037'), false)
})

test('location choices carry the option cardCode as card art and keep no table key', () => {
  // 敦威治·迷失时空「弃掉遭遇牌库顶 3 张，选择其中一个地点」：内容层随选项下发 cardCode，
  // 界面据此挂出候选卡面，但不设置 key（选项下标不是牌桌实体，不能拿去点桌）。
  const st = {
    investigators: [{ seat: 0, hand: [], assets: [] }],
    cards: { '02326': { code: '02326', name: '无尽之桥', nameZh: '无尽之桥' } },
    pendingChoice: { id: 'q', kind: 'location', seat: 0, options: [
      { id: '0', label: '无尽之桥', cardCode: '02326' }] },
    legalMoves: [{ action: 'choose', choiceId: 'q', optionId: '0' }],
  }
  const item = choicePresentation(st)[0]
  assert.equal(item.code, '02326')
  assert.deepEqual(item.cards.map(card => card.code), ['02326'])
  assert.deepEqual(item.cards, [st.cards['02326']])
  assert.equal(item.key, null)
})

test('location choices fall back to a unique card name and never guess on duplicates', () => {
  const st = {
    investigators: [{ seat: 0, hand: [], assets: [] }],
    cards: {
      '02325': { code: '02325', name: '菱柱瀑布', nameZh: '菱柱瀑布' },
      '02326': { code: '02326', name: '无尽之桥', nameZh: '无尽之桥' },
    },
    pendingChoice: { id: 'q', kind: 'location', seat: 0, options: [
      { id: '0', label: '无尽之桥' }, { id: '1', label: '菱柱瀑布' }] },
    legalMoves: [{ action: 'choose', choiceId: 'q', optionId: '0' },
      { action: 'choose', choiceId: 'q', optionId: '1' }],
  }
  const [bridge, cascade] = choicePresentation(st)
  assert.equal(bridge.code, '02326')
  assert.deepEqual(bridge.cards.map(card => card.code), ['02326'])
  assert.equal(cascade.code, '02325')
  assert.deepEqual(cascade.cards.map(card => card.code), ['02325'])
  assert.equal(bridge.key, null)
  assert.equal(cascade.key, null)
  // 同名不同卡号的第二张卡出现后，卡名不再唯一 → 不挂卡（重名不猜）；唯一卡名不受影响。
  st.cards['02327'] = { code: '02327', name: '菱柱瀑布', nameZh: '菱柱瀑布' }
  assert.deepEqual(choicePresentation(st)[1].cards, [])
  assert.equal(choicePresentation(st)[0].code, '02326')
  // label 不是任何卡名（如「不选择」）→ 不挂卡。
  st.pendingChoice.options[1].label = '不选择'
  assert.deepEqual(choicePresentation(st)[1].cards, [])
})

test('卡尔克萨尖柱的调查挂在附属卡上，地点上的放大镜也能点到它', () => {
  const st = {
    currentSeat: 0,
    investigators: [{ seat: 0, location: 'hall', hand: [], assets: [] }],
    legalMoves: [
      { action: 'encounterAction', actionKind: 'investigate', rule: 'clearSpiresOfCarcosa', locationId: 'hall', attachmentIndex: 0, label: '调查卡尔克萨尖柱' },
    ],
  }
  const onAttachment = entityMoves(st, 'attachment:hall:0')
  assert.equal(onAttachment.length, 1)
  assert.equal(onAttachment[0].actionKind, 'investigate')
  assert.equal(entityMoves(st, 'attachment:hall:1').length, 0)
  assert.equal(entityMoves(st, 'location:hall').some(move => move.rule === 'clearSpiresOfCarcosa'), true)
})

test('迷失时空地点搜索：内容层必须随选项下发 cardCode（界面整卡展示的输入契约）', () => {
  // 实机里 view.cards 不含 encounterDiscard 里的地点卡，界面整卡完全依赖内容层下发 cardCode。
  // 这里直接跑 later-behaviors 的 performAction（drawLocation 打桩），守住内容层不丢 cardCode。
  const behavior = laterBehavior('lostInTimeAndSpace')
  const state = {
    acts: [{ code: '02317', originalCode: '02317' }], actIndex: 0,
    encounterDeck: ['02326', '02325', '01001'], encounterDiscard: [],
  }
  let options = null
  const api = { choose: request => { options = request.options; return '0' } }
  const drawLocation = behavior.drawLocation
  behavior.drawLocation = () => null
  try {
    behavior.performAction(state, { seat: 0, name: '玩家' }, { rule: 'searchEncounterLocations' }, api)
  } finally {
    behavior.drawLocation = drawLocation
  }
  assert.ok(options?.length === 2, '两个遭遇地点应触发一次地点选择')
  assert.deepEqual(options.map(option => option.cardCode), ['02325', '02326'], '选项必须带 cardCode 供牌桌画整卡')
  assert.equal(options[0].label, '菱柱瀑布')
  assert.equal(options[1].label, '无尽之桥')
})

test('迷失时空实机口径：观察投影保留选项 cardCode，视图 cards 缺遭遇地点卡面时仍挂出整卡', () => {
  // 复现真实链路：内容层 later-behaviors 的 searchEncounterLocations 选项只带 cardCode；
  // 观察投影的 view.cards 是 embeddedCardDefs（不扫 encounterDiscard），没有 02325/02326 卡面。
  // 若以后删掉内容层 cardCode，这条用例会变红（浏览器用例按同一口径验收）。
  const st = createGameState({ playerInvestigator: '01001', seed: 'review-probe' }, [{ seat: 0, name: '玩家' }])
  st.pendingChoice = {
    id: 'li-ts-location-search', kind: 'location', seat: 0, source: '02319',
    prompt: '选择一个被弃掉的地点，结算其显现能力。',
    options: [{ id: '0', label: '无尽之桥', cardCode: '02326' }, { id: '1', label: '菱柱瀑布', cardCode: '02325' }],
  }
  st.legalMoves = [{ action: 'choose', choiceId: 'li-ts-location-search', optionId: '0' },
    { action: 'choose', choiceId: 'li-ts-location-search', optionId: '1' }]
  const view = viewState(st, 0)
  assert.deepEqual(view.pendingChoice.options.map(option => option.cardCode), ['02326', '02325'], '观察投影必须放行应答者的选项 cardCode')
  assert.equal(view.cards?.['02326'], undefined, '投影视图本来就不含这些遭遇地点卡面')
  assert.equal(view.cards?.['02325'], undefined)
  const items = choicePresentation({ ...view, legalMoves: view.legalMoves })
  assert.deepEqual(items.map(item => [item.label, item.code, item.key]), [
    ['无尽之桥', '02326', null], ['菱柱瀑布', '02325', null]])
  // 视图没有卡定义时用选项 label 兜底成最小卡面数据，提交动作保持不变。
  assert.deepEqual(items[0].cards, [{ name: '无尽之桥', code: '02326' }])
  assert.deepEqual(items.map(item => item.move.optionId), ['0', '1'])
})
