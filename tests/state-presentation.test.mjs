import test from 'node:test'
import assert from 'node:assert/strict'
import { createGameState, performTest, getStat, getMaxSanity, describeState } from '../src/engine/engine.js'
import { markLimitUsed, registeredEntry } from '../src/engine/ability.js'
import { resolveTransaction } from '../src/engine/resolution.js'
import { viewState, viewEvents } from '../src/integration/observation.js'
import { aiDecisionContext } from '../src/ai/ai-context.js'
import { captureTableState, locationEntryErrors } from '../src/integration/presentation-state.js'
import { timelineEntries, timelineCardIndex, timelineCardParts } from '../web/table-timeline.js'
import { objectiveText } from '../web/card-text.js'
import { cardAttachmentReferences } from '../web/table-components.js'
import { contentRegistry } from '../content/registered.js'

test('地图禁入提示与烈焰屏障规则一致，演出快照保留当时状态', () => {
  const s = createGameState({ seed: 'map-barrier' }, [{ seat: 0 }])
  const scenario = contentRegistry.getScenarioData('theGathering')
  s.locations = ['hallway', 'attic', 'cellar', 'parlor'].map(id => ({ ...scenario.locations[id], revealed: true }))
  s.actIndex = 1
  s.investigators[0].location = 'hallway'
  s.investigators[0].actionsLeft = 0
  s.legalMoves = []
  const blocked = viewState(s, 0).locationEntryErrors
  assert.deepEqual(Object.keys(blocked), ['parlor'], '行动耗尽不影响其他房间的可进入状态')
  assert.match(blocked.parlor, /屏障/)
  assert.deepEqual(viewState(s, null).locationEntryErrors, blocked, '旁观视角也能看到禁入箭头')
  const snapshot = captureTableState(s, getStat, getMaxSanity)
  s.actIndex = 2
  assert.deepEqual(viewState(s, 0).locationEntryErrors, {})
  assert.deepEqual(captureTableState(s, getStat, getMaxSanity).locationEntryErrors, {})
  assert.deepEqual(viewEvents([{ tableState: snapshot }], 0)[0].tableState.locationEntryErrors, blocked)
})

test('邪秽誓约禁入提示按当前座位调查员的线索计算', () => {
  const s = createGameState({ seed: 'unspeakable-oath-entry' }, [{ seat: 0 }])
  s.scenario = { id: 'theUnspeakableOath' }
  s.locations = [{ id: 'patientCell', revealed: false, enterClueCost: 1, connections: [] }]
  s.currentSeat = 0
  s.investigators[0].clues = 0
  assert.match(locationEntryErrors(s).patientCell, /需要花费 1 个线索/)
  s.investigators[0].clues = 1
  assert.deepEqual(locationEntryErrors(s), {})
})

test('时间线按完整名称链接地点、卡牌与遭遇，保留原文且事件编号优先区分同名卡',()=>{
  const session={state:{cards:{a:{code:'a',name:'巡警'},b:{code:'b',name:'巡警'},c:{code:'c',name:'手电筒'},t:{code:'t',name:'腐烂的尸体'},
    l:{code:'l',name:'地窖',type:'location'},long:{code:'long',name:'罗兰的手电筒'},en:{code:'en',name:'Knife'}},
    investigators:[{hand:['c'],assets:[{id:'upgraded-cop',code:'b'}]}],locations:[{id:'cellar',code:'l',name:'地窖',revealed:false}],enemies:[]}}
  const index=timelineCardIndex(session),text='进入「地窖」，打出手电筒，抽到腐烂的尸体。罗兰的手电筒仍在。'
  const parts=timelineCardParts(text,index)
  assert.equal(parts.map(p=>p.text).join(''),text)
  assert.deepEqual(parts.filter(p=>p.card).map(p=>p.card.code),['l','c','t','long'])
  assert.equal(parts.find(p=>p.card?.code==='l').card.revealed,false)
  assert.equal(timelineCardParts('巡警受伤',index)[0].card.code,'b')
  assert.equal(timelineCardParts('打出巡警',index,{presentation:{code:'a'}}).find(p=>p.card).card.code,'a')
  assert.equal(timelineCardParts('Knife Knifed',index).filter(p=>p.card).length,1)
  assert.equal(timelineCardParts('<img src=x onerror=alert(1)>手电筒',index)[0].text,'<img src=x onerror=alert(1)>')
  session.state.investigators=[]
  assert.equal(timelineCardParts('巡警',timelineCardIndex(session))[0].card,undefined,'无确切出处的同名卡不跳到错误等级')
})

test('个人检定不打开盟友免费窗口，也不进入盟友观察与模型上下文；求助后可见', () => {
  const s=createGameState({playerInvestigator:'01001',seed:'private-test'},[{seat:0},{seat:1}])
  s.pendingChoice=null; s.continuation=null
  s.investigators[0].assets=[]; s.investigators[0].hand=['01090']
  s.investigators[0].phaseStatBonus={skill:'intellect',amount:1}
  const ally=s.investigators[1]; ally.assets=[{id:'knowledge',code:'01058',uses:4,exhausted:false}]; ally.resources=5; ally.hand=['01090']; ally.location=s.investigators[0].location
  const execute=draft=>performTest(draft,0,'intellect',3)
  resolveTransaction(s,0,{action:'test'},execute)
  assert.equal(s.pendingChoice.kind,'commit'); assert.equal(s.pendingChoice.seat,0)
  assert.equal(s.skillTest.printedValue,s.investigators[0].intellect)
  assert.equal(s.skillTest.value,s.investigators[0].intellect+1)
  assert.equal(viewState(s,1).skillTest,null); assert.equal(viewState(s,1).pendingChoice,null)
  assert.ok(!aiDecisionContext(s,1).includes('"test":'))
  assert.ok(!describeState(s,1).includes('待决选择：'))
  const overflow=structuredClone(s); overflow.log=Array(120).fill('不应向盟友公布的个人投入')
  assert.ok(!JSON.stringify(viewState(overflow,1).log).includes('不应向盟友'))
  assert.ok(!describeState(overflow,1).includes('不应向盟友'))
  const alone=structuredClone(s)
  resolveTransaction(alone,0,{action:'choose',choiceId:alone.pendingChoice.id,optionId:'done'},execute)
  assert.equal(alone.pendingChoice,null,'盟友不能在个人检定后抢入免费能力窗口')
  resolveTransaction(s,0,{action:'choose',choiceId:s.pendingChoice.id,optionId:'help'},execute)
  assert.equal(s.pendingChoice.seat,1); assert.equal(s.skillTest.helpRequested,true)
  assert.ok(viewState(s,1).skillTest); assert.ok(aiDecisionContext(s,1).includes('"test":'))
})

test('个人检定投入的牌对其他座位公开，检定内的其余日志仍只给执行者', () => {
  // 规则书：投入的牌正面朝上摆在检定旁，全桌可见。过去整场个人检定都按 privateSeat 隐藏，
  // 队友（尤其 AI 队友）投了哪张牌在时间线里完全看不见。
  const s=createGameState({playerInvestigator:'01001',seed:'public-commit'},[{seat:0},{seat:1}])
  s.pendingChoice=null; s.continuation=null
  const actor=s.investigators[1]
  actor.hand=['01090']; actor.testBonus=1
  const execute=draft=>performTest(draft,1,'intellect',2)
  const events=[...resolveTransaction(s,1,{action:'test'},execute)]
  assert.equal(s.pendingChoice.kind,'commit')
  const option=s.pendingChoice.options.find(item=>item.label.startsWith('投入'))
  assert.ok(option,JSON.stringify(s.pendingChoice.options))
  events.push(...resolveTransaction(s,1,{action:'choose',choiceId:s.pendingChoice.id,optionId:option.id},execute))
  const lines=seat=>viewEvents(structuredClone(events),seat).filter(event=>typeof event.text==='string').map(event=>event.text)
  assert.ok(lines(0).some(text=>text.includes('投入「洞察力」')),'其他座位的时间线应看到投入的牌：'+JSON.stringify(lines(0)))
  assert.ok(lines(1).some(text=>text.includes('投入「洞察力」')))
  assert.ok(!lines(0).some(text=>text.includes('检定加成')),'检定内部的其余日志仍然只给执行者')
  assert.equal(viewState(s,0).skillTest,null,'投入的牌公开，但检定的选择面板仍只给执行者')
})

test('演出快照不泄露牌堆顺序与其他人的手牌，时间线保留游戏记录并排除聊天', () => {
  const s=createGameState({seed:'presentation-safety'},[{seat:0},{seat:1}])
  s.investigators[0].assets.push({id:'courage-0-1',code:'xcourage',underlyingCode:'01024',name:'胆量',cost:0,sanity:2,courage:true})
  const snapshot=captureTableState(s,getStat,getMaxSanity)
  const event={seq:1,type:'presentation',kind:'checkpoint',tableState:snapshot}
  const projected=viewEvents([event],0)[0].tableState
  assert.deepEqual(projected.investigators[1].hand,[])
  assert.deepEqual(projected.investigators[0].hand,s.investigators[0].hand)
  assert.deepEqual(projected.investigators[0].deck,[])
  const courage=viewState(s,0).investigators[0].assets.find(card=>card.code==='xcourage')
  assert.deepEqual(courage,{id:'courage-0-1',code:'xcourage',name:'胆量',cost:0,sanity:2,courage:true})
  assert.ok(!JSON.stringify(projected).includes('"underlyingCode"'))
  for(const key of ['rngState','continuation','encounterDeck','cultistDeck','pendingChoice'])assert.ok(!(key in projected))
  const events=[{seq:1,type:'info',text:'敌军攻击',presentation:{phase:'enemy'}},{seq:2,type:'chat',text:'台词'}, {seq:3,type:'speech',text:'另一句台词'}, {seq:4,type:'info',text:'队友调查'},event]
  assert.deepEqual(timelineEntries({state:s,events}).map(e=>e.text),['敌军攻击','队友调查'])
  assert.deepEqual(viewEvents([{type:'info',text:'个人投入',privateSeat:0}],1),[])
})

test('时间线补上剧情事件的卡面正文，已写进日志的段落不重复', () => {
  const events = [
    { seq: 1, type: 'info', text: '翻开场景「被困于此」的背面。',
      presentation: { kind: 'story', title: '场景推进', text: '你发现了地板上的暗门。' } },
    { seq: 2, type: 'info', text: '📜 场景推进：2a「灼热屏障」—— 一堵灼热的屏障。',
      presentation: { kind: 'story', title: '新的场景', text: '一堵灼热的屏障。' } },
    { seq: 3, type: 'info', text: '一段已经写全的导入。',
      presentation: { kind: 'story', title: '故事导入', text: '一段已经写全的导入。' } },
  ]
  assert.deepEqual(timelineEntries({ state: {}, events }).map(entry => entry.text), [
    '翻开场景「被困于此」的背面。 你发现了地板上的暗门。',
    '📜 场景推进：2a「灼热屏障」—— 一堵灼热的屏障。',
    '一段已经写全的导入。',
  ])
})

test('玩家附着到地点的卡与剧情卡进入实时观察和演出快照', () => {
  const s=createGameState({seed:'public-player-attachments'},[{seat:0}])
  const location=s.investigators[0].location
  s.playerLocationAttachments=[{code:'03038',location,ownerSeat:0,exhausted:false}]
  s.storyAssets=[{id:'story-damage',code:'01117',location,damage:2,doom:1}]
  const live=viewState(s,0)
  assert.deepEqual(live.locations.find(loc=>loc.id===location).attachments,[s.playerLocationAttachments[0]])
  assert.deepEqual(live.storyAssets,s.storyAssets)
  const snapshot=captureTableState(s,getStat,getMaxSanity)
  assert.deepEqual(snapshot.locations.find(loc=>loc.id===location).attachments,[s.playerLocationAttachments[0]])
  assert.deepEqual(snapshot.storyAssets,s.storyAssets)
})

test('实时观察公开胜利区与仍放在一边的卡牌，但不公开其他剧本区域', () => {
  const s=createGameState({seed:'public-scenario-zones'},[{seat:0}])
  const initial=viewState(s,0)
  assert.deepEqual(initial.setAsideCards.map(card=>card.code),['01112','01113','01114','01115','01116','01117'])
  const scenario=contentRegistry.getScenarioData('theGathering')
  s.locations.push({...scenario.locations.hallway,revealed:true})
  s.victoryDisplay=[{id:'victory-priest',code:'ghoulPriest',originalCode:'01116',victory:2}]
  const changed=viewState(s,0)
  assert.deepEqual(changed.setAsideCards.map(card=>card.code),['01113','01114','01115','01117'])
  assert.deepEqual(changed.victoryDisplay,s.victoryDisplay)
  assert.ok(!('scenarioZones' in changed))
  s.scenarioZones.setAside=['01117','01117']
  assert.deepEqual(viewState(s,0).setAsideCards,[{code:'01117',count:2}], '有剧本追踪区时以实时数量为准')
})

test('队友个人检定造成的伤害分配向受影响者显示，但仍不打开检定的选择面板', () => {
  const s=createGameState({seed:'private-collateral'},[{seat:0},{seat:1},{seat:2}])
  s.skillTest={seat:1,skill:'combat',stage:'ST.7',helpRequested:false,committed:[{seat:1,code:'01046'}],publicLog:[]}
  for(const kind of ['assign-damage','assign-horror']) {
    s.pendingChoice={id:'harm',seat:0,kind,source:'harm',prompt:'分配 1 点伤害（剩余 1）。',options:[{id:'self',label:'由调查员承受'},{id:'cop',label:'巡警'}]}
    s.legalMoves=s.pendingChoice.options.map(option=>({action:'choose',choiceId:'harm',optionId:option.id}))
    const view=viewState(s,0)
    assert.deepEqual(view.pendingChoice,s.pendingChoice)
    assert.deepEqual(view.legalMoves,s.legalMoves)
    assert.equal(view.skillTest,null)
    assert.match(describeState(s,0),/待决选择：分配/)
    const bystander=viewState(s,2)
    assert.equal(bystander.pendingChoice,null)
    assert.equal(bystander.skillTest,null)
    assert.deepEqual(bystander.legalMoves,[])
  }
})

test('幕目标结构转换为中文条件', () => {
  assert.match(objectiveText({type:'clues',perInvestigator:2}),/2 × 调查员人数.*线索/)
  assert.match(objectiveText({type:'defeatEnemy',enemy:'ghoulPriest'}),/食尸鬼祭司/)
  assert.equal(objectiveText(null),'')
})

test('追猎恐魔的暗影之子由剧本标记派生为可查看的附属卡', () => {
  assert.deepEqual(cardAttachmentReferences({ shadowSpawned: true, shadowResources: 2 }),
    [{ code: '02142', originalCode: '02142', resources: 2 }])
  assert.equal(cardAttachmentReferences({ shadowSpawned: true, shadowResources: 2,
    attachments: [{ code: '02142', originalCode: '02142', resources: 2 }] }).length, 1)
  assert.deepEqual(cardAttachmentReferences({ shadowSpawned: false }), [])
})

test('旧存档的卡牌展示表会补上米奇·布朗的受限盟友槽字段', () => {
  const s = createGameState({ playerInvestigator: '04001', seed: 'mickey-observation' }, [{ seat: 0 }])
  s.pendingChoice = null
  s.investigators[0].assets = [{ id: 'mickey', code: '04006', exhausted: false }]
  // 模拟旧存档：cards 快照里没有新加的展示字段。
  delete s.cards['04006'].allySlotsForNonUnique
  const view = viewState(s, 0)
  assert.equal(view.cards['04006'].allySlotsForNonUnique, 2)
  // P3.2 A1′：viewState 只读权威 state（见 view-shared-state.test.mjs 门禁），
  // 旧存档的展示字段自愈只进本视图的 cards 副本，不回写 state.cards。
  assert.equal(s.cards['04006'].allySlotsForNonUnique, undefined, 'A1′：视图自愈不写回权威 state')
})

test('能力上限进入观察投影：用掉后标已用，换回合/换场后按作用域恢复', () => {
  const s = createGameState({ seed: 'ability-usage' }, [{ seat: 0 }, { seat: 1 }])
  s.pendingChoice = null
  const inv = s.investigators[0]
  const turnCard = { id: 'arcane-insight', code: '03266', uses: 3, exhausted: false }
  const gameCard = { id: 'once-a-game', code: '04276', exhausted: false }
  inv.assets = [turnCard, gameCard]
  const turnAbility = registeredEntry('03266').abilities[0]
  const gameAbility = registeredEntry('04276').abilities[1]
  assert.equal(turnAbility.limit.scope, 'perTurn')
  assert.equal(gameAbility.limit.scope, 'perGame')

  const before = viewState(s, 0).abilityUsage
  assert.deepEqual(before[0].map(card => card.code), ['03266', '04276'])
  assert.ok(before[0].every(card => card.abilities.every(ability => ability.used === false)))
  assert.equal(before[0][0].abilities[0].limitText, '每回合 1 次')
  assert.equal(before[0][1].abilities[0].limitText, '每场游戏 1 次')
  markLimitUsed(s, inv, turnAbility, null, null, turnCard)
  markLimitUsed(s, inv, gameAbility, null, null, gameCard)
  const used = viewState(s, 0).abilityUsage[0]
  assert.equal(used[0].used, true)
  assert.equal(used[0].abilities[0].used, true)
  assert.equal(used[1].abilities[0].used, true)
  // 上限账本是公开的（场上支援所有人可见），旁观座位看到同一份。
  assert.deepEqual(viewState(s, 1).abilityUsage[0], used)
  assert.match(describeState(s, 0), /【已经用完的能力】/)
  assert.match(describeState(s, 0), /「奥术洞察」奥术洞察降低帷幕（每回合 1 次）：已用/)
  assert.match(describeState(s, 0), /「古旧锈剑」蓄力斩（加入意志，伤害 \+3）（每场游戏 1 次）：已用/)

  // 结构化决策资料也只给「有上限的支援」补 abilities，AI 不必自己推断可用性。
  assert.match(aiDecisionContext(s, 0), /"label":"奥术洞察降低帷幕","limit":"每回合 1 次","used":true/)

  // perTurn 的账按 turnSerial 匹配：下个回合同一条能力恢复可用；perGame 仍然是用过的。
  s.turnSerial = (s.turnSerial || 0) + 1
  s.currentSeat = 0
  const nextTurn = viewState(s, 0).abilityUsage[0]
  assert.equal(nextTurn[0].abilities[0].used, false)
  assert.equal(nextTurn[1].abilities[0].used, true)
})
