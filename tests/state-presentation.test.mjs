import test from 'node:test'
import assert from 'node:assert/strict'
import { createGameState, performTest, getStat, getMaxSanity, describeState } from '../src/engine/engine.js'
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

test('队友个人检定造成的伤害分配向受影响者显示，仍不暴露检定与投入', () => {
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
