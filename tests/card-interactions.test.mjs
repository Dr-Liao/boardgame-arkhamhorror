import test from 'node:test'
import assert from 'node:assert/strict'
import { choicePresentation, entityMoves, targetMoves, investigatorHoldsCard } from '../web/card-interactions.js'
import { createGameState, legalMoves, validateMove, applyMove, placeLocation } from '../src/engine/engine.js'
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

test('地点附属的主动能力按服务端各字段族挂回卡面（疯狂生长 / 地点附属能力 / 玩家卡附属）', async () => {
  // 2026-11-05：地点附属卡（疯狂生长等）的主动能力此前只认 Carcosa 的 locationId+attachmentIndex，
  // 失落时代换成 attachmentId、条目级 attachmentAbilities 用 entityId 之后，左键点地图上的附属卡
  // 只会打开卡牌详情，技能检定选项只能从底部动作栏点到。这里钉住四条通道都挂得回卡面。
  const { encounterRules } = await import('../content/campaigns/theForgottenAge/encounter-rules.js')
  const overgrowth = { id: 'overgrowth:1:hall', code: '04076', originalCode: '04076' }
  const state = {
    currentSeat: 0,
    investigators: [{ seat: 0, location: 'hall', hand: [], assets: [], threat: [], clues: 0 }],
    locations: [{ id: 'hall', revealed: true, attachments: [overgrowth, { id: 'attach:03091:1', code: '03091' }] }],
    enemies: [], storyAssets: [], acts: [], agendas: [], actIndex: 0, agendaIndex: 0,
  }
  // 真实内容链路：TFA 04076 的两个「检定战斗/智识(4)清除疯狂生长」由 encounterActions 下发，
  // 移动带的是 attachmentId（不是 locationId+attachmentIndex）。
  const real = encounterRules.encounterActions(state, state.investigators[0])
  assert.deepEqual(real.map(move => move.skill), ['combat', 'intellect'])
  const bound = entityMoves({ ...state, legalMoves: real }, 'attachment:hall:0')
  assert.deepEqual(bound.map(move => move.label), ['♻️ 检定战斗(4)清除疯狂生长', '♻️ 检定智识(4)清除疯狂生长'])
  // 同一地点上另一张没有行动的下标不串门。
  assert.equal(entityMoves({ ...state, legalMoves: real }, 'attachment:hall:1').length, 0)

  // 其余字段族：entityAbility（attachmentAbilities / 谈判）、assetId（玩家卡地点附属能力）。
  const mixed = { ...state, legalMoves: [
    { action: 'entityAbility', entityType: 'locationAttachment', entityId: 'overgrowth:1:hall', abilityIndex: 0, label: '石障' },
    { action: 'ability', assetId: 'overgrowth:1:hall', abilityIndex: 1, label: '玩家卡附属能力' },
    { action: 'entityAbility', entityType: 'locationAttachment', entityId: 'attach:03091:1', abilityIndex: 0, label: '别人的能力' },
  ] }
  assert.deepEqual(entityMoves(mixed, 'attachment:hall:0').map(move => move.action), ['entityAbility', 'ability'])
  assert.deepEqual(entityMoves(mixed, 'attachment:hall:1').map(move => move.label), ['别人的能力'])

  // 玩家卡地点附属「捷径」：shortcutMove 不带附属 id，由观察投影派生的 markerAction 挂回；
  // 没有 markerAction 的附属不能被当成捷径入口。
  const shortcut = { currentSeat: 0, investigators: [{ seat: 0, location: 'hall', hand: [], assets: [] }],
    legalMoves: [{ action: 'shortcutMove', locationId: 'lobby', label: '🏃 捷径：移动到「大厅」' }],
    locations: [{ id: 'hall', attachments: [{ code: '03232', location: 'hall', ownerSeat: 0, exhausted: false, markerAction: 'shortcutMove' }] }] }
  assert.equal(entityMoves(shortcut, 'attachment:hall:0').length, 1)
  delete shortcut.locations[0].attachments[0].markerAction
  assert.equal(entityMoves(shortcut, 'attachment:hall:0').length, 0)
})

test('食梦者把附属 id 嵌在剧本规则名里的摆脱行动，左键也能挂回卡面', () => {
  // 06103 恶心蛛网在食梦者的两处行动里没有独立 attachmentId 字段：
  // 共享遭遇规则用 rule = `locationAttachment:<id>`，章节行为用 `discardSickeningWebs:<id>`。
  // entityMoves 按 id 后缀兼容这两种规则名（id 唯一，不猜卡号）。
  const st = {
    currentSeat: 0,
    investigators: [{ seat: 0, location: 'theGreatWeb1', hand: [], assets: [] }],
    locations: [{ id: 'theGreatWeb1', attachments: [{ id: 'webs:1', code: '06103' }, { id: 'webs:2', code: '06103' }] }],
    legalMoves: [
      { action: 'scenarioAction', rule: 'locationAttachment:webs:1', actions: 1, label: '[行动] 摆脱「恶心蛛网」' },
      { action: 'scenarioAction', rule: 'discardSickeningWebs:webs:2', actions: 1, label: '检定战斗/敏捷(3)：弃掉「恶心蛛网」' },
    ],
  }
  assert.deepEqual(entityMoves(st, 'attachment:theGreatWeb1:0').map(move => move.rule), ['locationAttachment:webs:1'])
  assert.deepEqual(entityMoves(st, 'attachment:theGreatWeb1:1').map(move => move.rule), ['discardSickeningWebs:webs:2'])
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

test('收尾玩家窗口的快速卡候选挂回手牌实体，点牌即打出（2026-11-06）', () => {
  // 玩家窗口的快速卡选项 id 是 fast-card:<卡号>（卢克的如同位于变体追加 :asif:<地点>，
  // 牌桌来源追加 :<fastSourceId>），选项本身不带 cardCode。界面必须把它们挂回手牌位：
  // 卡面高亮 + 左键直接打出，而不是在牌桌中央浮出选项面板。
  const st = {
    investigators: [{ seat: 0, hand: ['02022', '01036'], assets: [] }],
    cards: { '02022': { code: '02022', name: '捷径' }, '01036': { code: '01036', name: '心胜于物' } },
    pendingChoice: { id: 'w', kind: 'playerWindow', seat: 0, canSkip: true, prompt: '检定开始、投入前：可以使用免费触发能力，或让过。',
      options: [
        { id: 'skip', label: '让过' },
        { id: 'fast-card:02022', label: '⚡ 快速打出「捷径」（2 资源）' },
        { id: 'fast-card:02022:asif:river', label: '⚡ 快速打出「捷径」（如同位于「河流峡谷」）（2 资源）', cardCode: '02022' },
        { id: 'fast-card:01036:asset-1', label: '⚡ 快速打出「心胜于物」（1 资源）', cardCode: '01036' },
      ] },
    legalMoves: ['skip', 'fast-card:02022', 'fast-card:02022:asif:river', 'fast-card:01036:asset-1'].map(optionId =>
      ({ action: 'choose', choiceId: 'w', optionId })),
  }
  const items = choicePresentation(st)
  const byId = id => items.find(item => item.move.optionId === id)
  assert.equal(byId('fast-card:02022').key, 'hand:0:0', '普通快速卡挂回手牌位')
  assert.equal(byId('fast-card:02022:asif:river').key, 'hand:0:0', '如同位于变体与普通打法是同一张手牌')
  assert.equal(byId('fast-card:01036:asset-1').key, 'hand:0:1', '带 fastSourceId 的变体同样按卡号挂回')
  // 点一次手牌 = 提交这张牌的所有可选打法（多份变体由动作浮层选具体打法）。
  assert.deepEqual(entityMoves(st, 'hand:0:0').map(move => move.optionId).sort(),
    ['fast-card:02022', 'fast-card:02022:asif:river'].sort())
  assert.deepEqual(entityMoves(st, 'hand:0:1').map(move => move.optionId), ['fast-card:01036:asset-1'])
  // 卡号不在手牌里（例如视图未下发该手牌）时不挂任何实体，保留旧的选项面板兜底。
  const missing = { ...st, investigators: [{ seat: 0, hand: ['01036'], assets: [] }] }
  assert.equal(choicePresentation(missing).find(item => item.move.optionId === 'fast-card:02022').key, null)
  // 只挂 hand: 实体；视觉选项面板据此不再显示这些候选（renderPendingChoice 过滤 hand: key）。
  assert.equal(items.filter(item => item.key?.startsWith('hand:')).length, 3)
  // 同名副本共用一份引擎候选：绑定键只落在第一张副本上，但第二张副本按卡号也能点（高亮 + 提交同一份）。
  const duplicate = { ...st, investigators: [{ seat: 0, hand: ['02022', '02022'], assets: [] }],
    legalMoves: st.legalMoves.filter(move => move.optionId !== 'fast-card:01036:asset-1'),
    pendingChoice: { ...st.pendingChoice, options: st.pendingChoice.options.filter(option => option.id !== 'fast-card:01036:asset-1') } }
  assert.equal(choicePresentation(duplicate).find(item => item.move.optionId === 'fast-card:02022').key, 'hand:0:0')
  assert.deepEqual(entityMoves(duplicate, 'hand:0:1').map(move => move.optionId).sort(),
    ['fast-card:02022', 'fast-card:02022:asif:river'].sort(), '第二张同名副本也能点（含变体）')
  // 其它选择类型不享受这个按卡号兜底（避免把别的窗口的手牌选项误挂成快速卡）。
  const otherChoice = { ...duplicate, pendingChoice: { ...duplicate.pendingChoice, kind: 'reaction' } }
  assert.deepEqual(entityMoves(otherChoice, 'hand:0:1'), [])
})

test('卢克·罗宾逊的真实玩家窗口：快速事件候选全部挂回同一张手牌', async () => {
  // 实机形状（2026-11-05 修复「选项 id 重复」后）：Luke 的普通打法与每个如同位于变体是独立的
  // option id，但都打同一张手牌。界面要能把这些候选都收拢到那张手牌上。
  const { fixture } = await import('./core-fixture.mjs')
  const { ALL_CARDS } = await import('../src/cards/cards-data.js')
  const state = fixture('01001')
  const inv = state.investigators[0]
  const luke = ALL_CARDS['06004']
  Object.assign(inv, { code: '06004', name: luke.nameZh, nameEn: luke.name, klass: luke.klass,
    willpower: luke.willpower, intellect: luke.intellect, combat: luke.combat, agility: luke.agility,
    health: luke.health, sanity: luke.sanity, maxHealth: luke.health, maxSanity: luke.sanity,
    beneath: [], assets: [], threat: [], damage: 0, horror: 0 })
  placeLocation(state, 'hallway', [])
  const here = state.locations.find(location => location.id === inv.location)
  here.connections = ['hallway']
  inv.hand = ['02022']
  inv.resources = 10
  inv.actionsLeft = 3
  applyMove(state, 0, { action: 'draw' })
  assert.equal(state.pendingChoice?.kind, 'playerWindow', '抽牌后的收尾玩家窗口')
  const fastIds = state.pendingChoice.options.map(option => option.id).filter(id => id.startsWith('fast-card:'))
  assert.ok(fastIds.length >= 2, `普通打法 + 如同位于变体都应出现：${fastIds.join('、')}`)
  const view = viewState(state, 0)
  const bound = choicePresentation(view).filter(item => String(item.move.optionId).startsWith('fast-card:'))
  assert.deepEqual(bound.map(item => item.key), fastIds.map(() => 'hand:0:0'), '全部候选挂回同一张手牌')
  assert.deepEqual(entityMoves(view, 'hand:0:0').map(move => move.optionId).sort(), [...fastIds].sort())
  // 点牌提交的仍是合法动作：普通打法可以直接结算，窗口随之推进。
  const normal = entityMoves(view, 'hand:0:0').find(move => move.optionId === 'fast-card:02022')
  assert.equal(validateMove(state, 0, normal), null)
  applyMove(state, 0, normal)
  assert.equal(state.investigators[0].hand.includes('02022'), false, '点手牌真的打出了那张快速事件')
})
