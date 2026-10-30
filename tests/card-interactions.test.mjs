import test from 'node:test'
import assert from 'node:assert/strict'
import { choicePresentation, entityMoves, targetMoves, investigatorHoldsCard } from '../web/card-interactions.js'
import { createGameState, legalMoves, validateMove, applyMove } from '../src/engine/engine.js'

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
