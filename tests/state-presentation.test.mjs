import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createGameState, enemyAttack, performTest, getStat, getMaxSanity, enemyHealth, enemyFightValue, enemyEvadeValue, describeState } from '../src/engine/engine.js'
import { markLimitUsed, registeredEntry } from '../src/engine/ability.js'
import { resolveTransaction } from '../src/engine/resolution.js'
import { viewState, viewEvents } from '../src/integration/observation.js'
import { aiDecisionContext } from '../src/ai/ai-context.js'
import { captureTableState, locationEntryErrors } from '../src/integration/presentation-state.js'
import { fixture, enemy as makeEnemy, move } from './core-fixture.mjs'
import { timelineEntries, timelineCardIndex, timelineCardParts } from '../web/table-timeline.js'
import { objectiveText } from '../web/card-text.js'
import {
  cardAttachmentReferences, cardMarkerData, cardCounterMarkerData,
  NAMED_COUNTER_DISPLAY, USE_TOKEN_DISPLAY, LABEL_MARKER_DISPLAY, INTERNAL_LABEL_MARKERS, TABLE_ICON_NAMES,
} from '../web/table-components.js'
import { CARD_COUNTER_IDS } from '../src/engine/card-counters.js'
import zhDict from '../web/locales/zh-CN.js'
import enDict from '../web/locales/en.js'
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

test('演出快照保留本人「下方」牌，其他座位只拿到公开张数', () => {
  const s=createGameState({playerInvestigator:'01001',seed:'beneath-snapshot'},[{seat:0},{seat:1}])
  s.investigators[0].beneath=['01016','01087']
  s.investigators[1].beneath=['01025']
  const snapshot=captureTableState(s,getStat,getMaxSanity)
  // 演出中间态（客户端 table-presentation.js applyStep）直接用 tableState 重绘：
  // 本人视角必须仍带 beneath，否则「下方」栏会在演出播放期间整排消失再出现。
  assert.deepEqual(snapshot.investigators[0].beneath,['01016','01087'])
  assert.equal(snapshot.investigators[0].beneathCount,2)
  assert.deepEqual(snapshot.investigators[1].beneath,['01025'])
  assert.equal(snapshot.investigators[1].beneathCount,1)
  const projected=viewEvents([{seq:1,type:'presentation',kind:'checkpoint',tableState:snapshot}],0)[0].tableState
  assert.deepEqual(projected.investigators[0].beneath,['01016','01087'],'本人能看到下方牌卡号')
  assert.deepEqual(projected.investigators[1].beneath,[],'别人的下方牌卡号不公开')
  assert.equal(projected.investigators[1].beneathCount,1,'公开张数照常投影')
  const spectator=viewEvents([{seq:1,type:'presentation',kind:'checkpoint',tableState:snapshot}],null)[0].tableState
  assert.deepEqual(spectator.investigators[0].beneath,[])
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

test('玩家卡地点附属「捷径」在观察投影里派生行动通道标记', () => {
  // 捷径（03232）的 shortcutMove 不带附属 id，牌桌靠投影派生的 markerAction 把
  // 「左键弹出可去地点」挂回地图上那张附属卡；标记只做展示，可用性仍由 legalMoves 决定。
  const s=createGameState({seed:'shortcut-marker-action'},[{seat:0}])
  const location=s.investigators[0].location
  s.playerLocationAttachments=[{code:'03232',location,ownerSeat:0,exhausted:false}]
  const live=viewState(s,0).locations.find(loc=>loc.id===location).attachments
  assert.equal(live[0].markerAction,'shortcutMove')
  const snapshot=captureTableState(s,getStat,getMaxSanity).locations.find(loc=>loc.id===location).attachments
  assert.equal(snapshot[0].markerAction,'shortcutMove','演出快照重绘地图时也要保留同一标记')
  // 其他玩家卡地点附属没有主动行动通道，不派生标记（避免点它们时误弹捷径选项）。
  s.playerLocationAttachments=[{code:'03038',location,ownerSeat:0,exhausted:false}]
  assert.equal(viewState(s,0).locations.find(loc=>loc.id===location).attachments[0].markerAction,undefined)
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

test('卡上计数展示契约：具名计数器/多类型使用标记/脚本标签都渲染成标记行，未登记项兜底可见', () => {
  // 09015 达雷尔开局带 09016 柯达相机：证据记在 `card.markers.evidence`（引擎 card-counters.js 的
  // 具名计数器），不是 doom/damage/uses 这些数字字段。过去 web 只渲染后者，玩家在牌桌和详情里
  // 都看不到卡上放了多少证据（TSK full-scan D2 high：09015/09016 证据计数器不可见）。
  const s = createGameState({ playerInvestigator: '09015', seed: 'card-counter-markers' }, [{ seat: 0 }])
  s.pendingChoice = null
  const inv = s.investigators[0]
  const kodak = inv.assets.find(asset => asset.code === '09016')
  kodak.markers = { evidence: 2 }
  inv.assets.push({ id: 'bounty-contracts', code: '06010', exhausted: false, markers: { bounty: 4 } })
  inv.assets.push({ id: 'binders-jar', code: '09089', exhausted: false, markers: { hollow: 1 } })
  const marked = makeEnemy(s, { code: 'ghoulMinion', name: '带证据的敌人', markers: { evidence: 1 } })
  // 10722 着彩枯疫的「光辉」走 useTokens；10732 毒花的「疯长」走脚本标签数组。
  inv.threat = [{ id: 'chroma-blight', code: '01163', exhausted: false, useTokens: { brilliance: 3 } }]
  const bloom = makeEnemy(s, { code: 'ghoulMinion', name: '长满疯长的敌人', markers: ['overgrowth', 'overgrowth'] })
  s.locations[0].markers = ['brazier']

  const live = viewState(s, 0)
  const liveKodak = live.investigators[0].assets.find(asset => asset.id === kodak.id)
  const liveMarked = live.enemies.find(item => item.id === marked.id)
  const liveBloom = live.enemies.find(item => item.id === bloom.id)
  // 投影原样带出实例计数：展示层读的就是权威状态里的同一份数据，不另派生第二份。
  assert.deepEqual(liveKodak.markers, { evidence: 2 })
  assert.deepEqual(liveMarked.markers, { evidence: 1 })
  assert.deepEqual(live.investigators[0].threat[0].useTokens, { brilliance: 3 })
  assert.deepEqual(liveBloom.markers, ['overgrowth', 'overgrowth'])
  // 牌桌小卡、卡牌详情、地点详情共用同一份标记行：图标 + 数字 + 本地化标签。
  assert.deepEqual(cardMarkerData(liveKodak), [['evidence', 'eye', '证据', 2]])
  assert.deepEqual(cardMarkerData(liveMarked, { enemy: true }), [['evidence', 'eye', '证据', 1]])
  assert.deepEqual(cardMarkerData(live.investigators[0].threat[0]), [['token-brilliance', 'eye', '光辉', 3]])
  assert.deepEqual(cardMarkerData(liveBloom, { enemy: true }), [['marker-overgrowth', 'leaf', '疯长', 2]])
  assert.deepEqual(cardMarkerData({ code: '06010', markers: { bounty: 4 } }), [['bounty', 'star', '赏金', 4]])
  assert.deepEqual(cardMarkerData({ code: '09089', markers: { hollow: 1 } }), [['hollow', 'lock', '下方', 1]])
  assert.deepEqual(cardMarkerData({ code: '01169', markers: ['brazier'] }), [['marker-brazier', 'star', '火盆', 1]])
  // 地点详情与牌桌共用 cardCounterMarkerData，地点上的脚本标签计数同样可见。
  assert.deepEqual(cardCounterMarkerData({ markers: ['brazier'] }), [['marker-brazier', 'star', '火盆', 1]])
  // 纯记账标签（flipMarker 的 doomToClue:N）不重复渲染：毁灭/线索数值本身已显示。
  assert.deepEqual(cardMarkerData({ markers: ['doomToClue:1'] }), [])
  // fail-visible：未登记的 id 按原样兜底显示，绝不静默消失（登记表漏项由下面的契约用例点名）。
  assert.deepEqual(cardMarkerData({ markers: ['mysteryMeat'] }), [['marker-mysteryMeat', 'star', 'mysteryMeat', 1]])
  assert.deepEqual(cardMarkerData({ useTokens: { occult: 2 } }), [['token-occult', 'star', 'occult', 2]])
  // 多种载体并存时按「具名计数器 → 使用标记 → 标签计数」登记顺序输出，渲染顺序稳定。
  assert.deepEqual(cardMarkerData({ markers: { bounty: 2, evidence: 1 }, useTokens: { secret: 1 } }),
    [['evidence', 'eye', '证据', 1], ['bounty', 'star', '赏金', 2], ['token-secret', 'arcane', '秘密', 1]])
  // 演出快照（applyStep 期间重绘牌桌）与实时观察同口径，否则演出播放时计数会闪没。
  const snapshot = captureTableState(s, getStat, getMaxSanity)
  assert.deepEqual(snapshot.investigators[0].assets.find(asset => asset.id === kodak.id).markers, { evidence: 2 })
  assert.deepEqual(snapshot.enemies.find(item => item.id === marked.id).markers, { evidence: 1 })
  assert.deepEqual(snapshot.investigators[0].threat[0].useTokens, { brilliance: 3 })
  assert.deepEqual(snapshot.enemies.find(item => item.id === bloom.id).markers, ['overgrowth', 'overgrowth'])
})

// ---- 展示契约门禁：引擎原语 / 内容写入点新增计数形态时，必须同轮补上展示登记 ----

const stripSourceComments = source => source
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .split('\n')
  .map(line => line.replace(/\/\/.*$/, ''))
  .join('\n')

function walkSourceFiles(dir, acc = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) walkSourceFiles(full, acc)
    else if (entry.name.endsWith('.js')) acc.push(full)
  }
  return acc
}

// 同文件顶层 `const NAME = 'literal'` 的映射：覆盖 `const MARKER = 'overgrowth'` 这类写入点。
function sourceStringConstants(source) {
  const constants = new Map()
  for (const match of source.matchAll(/(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(['"])([^'"\n]{1,80})\2/g)) {
    constants.set(match[1], match[3])
  }
  return constants
}

function resolveSourceLiteral(argument, constants) {
  const trimmed = String(argument || '').trim()
  const quoted = trimmed.match(/^(['"`])([^'"`\n]{1,80})\1$/)
  if (quoted) return quoted[2]
  const identifier = trimmed.match(/^[A-Za-z_$][\w$]*$/)
  if (identifier) return constants.get(trimmed) ?? null
  return null
}

// 从 `(` 起截出该调用的顶层参数（跳过字符串与嵌套括号），供扫描 api.addMarker/api.placeUse。
function readCallArguments(source, openIndex) {
  const args = []
  let depth = 0
  let current = ''
  let quote = null
  for (let index = openIndex; index < source.length; index++) {
    const char = source[index]
    if (quote) {
      current += char
      if (char === quote && source[index - 1] !== '\\') quote = null
      continue
    }
    if (char === "'" || char === '"' || char === '`') { quote = char; current += char; continue }
    if (char === '(') { depth++; if (depth === 1) continue } else if (char === ')') {
      depth--
      if (depth === 0) { args.push(current); return args }
    } else if (char === ',' && depth === 1) { args.push(current); current = ''; continue }
    current += char
  }
  return null
}

function scanCounterWriteSites() {
  const gameRoot = fileURLToPath(new URL('../', import.meta.url))
  const labels = new Map()
  const tokenTypes = new Map()
  const unresolved = []
  const record = (map, value, file) => { if (!map.has(value)) map.set(value, file) }
  const patterns = [
    // apiScenario.addMarker(目标, 标签)：每目标脚本标签计数（对象引用/api 前缀都算）。
    { kind: 'label', pattern: /api\??\.(?:scenario\??\.)?addMarker(?:\?\.)?\(/g, argIndex: 1 },
    // api.placeUse(卡, 类型, N)：多类型使用标记。
    { kind: 'token', pattern: /api\??\.placeUse(?:\?\.)?\(/g, argIndex: 1 },
    // api.mechanics.useTokens.move/spend(...)：引擎公开的多类型转移/合并支付入口。
    { kind: 'token', pattern: /api\??\.mechanics\??\.useTokens\??\.(?:move|spend)\(/g, argIndex: 2 },
  ]
  for (const file of [...walkSourceFiles(join(gameRoot, 'src/cards')), ...walkSourceFiles(join(gameRoot, 'content'))]) {
    const relativePath = relative(gameRoot, file).replace(/\\/g, '/')
    const source = stripSourceComments(readFileSync(file, 'utf8'))
    const constants = sourceStringConstants(source)
    for (const { kind, pattern, argIndex } of patterns) {
      for (const match of source.matchAll(pattern)) {
        const args = readCallArguments(source, match.index + match[0].length - 1)
        const value = args ? resolveSourceLiteral(args[argIndex], constants) : null
        if (value == null) {
          unresolved.push(`${relativePath}: ${match[0]}… 的第 ${argIndex + 1} 个参数无法静态解析`)
          continue
        }
        record(kind === 'label' ? labels : tokenTypes, value, relativePath)
      }
    }
  }
  return { labels, tokenTypes, unresolved }
}

test('展示契约：引擎具名计数器与所有登记项都有本地化文案和可渲染图标', () => {
  for (const id of CARD_COUNTER_IDS) {
    assert.ok(NAMED_COUNTER_DISPLAY[id], `引擎具名计数器 "${id}" 缺展示登记（web/table-components.js#NAMED_COUNTER_DISPLAY）`)
  }
  const registered = [
    ...Object.entries(NAMED_COUNTER_DISPLAY).map(([id, entry]) => [`具名计数器 ${id}`, entry]),
    ...Object.entries(USE_TOKEN_DISPLAY).map(([id, entry]) => [`使用标记 ${id}`, entry]),
    ...Object.entries(LABEL_MARKER_DISPLAY).map(([id, entry]) => [`脚本标签 ${id}`, entry]),
  ]
  for (const [label, entry] of registered) {
    assert.ok(TABLE_ICON_NAMES.includes(entry.icon), `${label} 的图标 "${entry.icon}" 不是 tableIcon 可渲染图标`)
    assert.equal(typeof entry.labelKey, 'string', `${label} 缺少 labelKey`)
    assert.ok(Object.hasOwn(zhDict, entry.labelKey), `${label} 缺 zh-CN 词条 ${entry.labelKey}`)
    assert.ok(Object.hasOwn(enDict, entry.labelKey), `${label} 缺 en 词条 ${entry.labelKey}`)
  }
})

test('展示契约：src/cards 与 content 写出的脚本标签/使用标记类型都已登记展示', () => {
  const { labels, tokenTypes, unresolved } = scanCounterWriteSites()
  assert.deepEqual(unresolved, [], '计数器写入点无法静态解析：请改用字面量或同文件 const，便于展示契约门禁复核')
  const isInternalLabel = label => INTERNAL_LABEL_MARKERS
    .some(prefix => label === prefix || label.startsWith(prefix + ':'))
  const unregisteredLabels = [...labels]
    .filter(([label]) => !Object.hasOwn(LABEL_MARKER_DISPLAY, label) && !isInternalLabel(label))
    .map(([label, file]) => `${label}（${file}）`)
  assert.deepEqual(unregisteredLabels, [],
    '内容写出的脚本标签缺展示登记：在 web/table-components.js#LABEL_MARKER_DISPLAY 补登记并加词典词条；'
    + '纯记账标签登记到 INTERNAL_LABEL_MARKERS')
  const unregisteredTokens = [...tokenTypes]
    .filter(([type]) => !Object.hasOwn(USE_TOKEN_DISPLAY, type))
    .map(([type, file]) => `${type}（${file}）`)
  assert.deepEqual(unregisteredTokens, [],
    '内容写出的多类型使用标记缺展示登记：在 web/table-components.js#USE_TOKEN_DISPLAY 补登记并加词典词条')
  // 回归锚：本轮修复的三张卡各自的计数写法必须仍被扫描到。
  assert.ok(labels.has('overgrowth'), '10732 毒花的「疯长」标签写入点未扫到')
  assert.ok(labels.has('stolenSoul'), '05239 看守人的「窃魂」标签写入点未扫到')
  assert.ok(tokenTypes.has('brilliance'), '10722 着彩枯疫的「光辉」使用标记写入点未扫到')
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

test('个人检定结算里的公开演出（如敌人攻击）不按 privateSeat 隐藏', () => {
  // 旧逻辑把「个人检定期间的所有 info」都标成 privateSeat=检定者；AI 座位没有界面，
  // 于是它在检定结算里触发的攻击/翻面/剧本演出，人类玩家完全看不到。演出提示是桌面公开事实。
  const s = createGameState({ playerInvestigator: '01001', seed: 'public-presentation' },
    [{ seat: 0, role: 'human' }, { seat: 1 }])
  s.pendingChoice = null
  s.continuation = null
  s.uiState = 'inScenario'
  const inv = s.investigators[0]
  const enemy = {
    id: 'enemy-public-cue', code: 'ghoulMinion', name: '测试敌人', location: inv.location,
    damage: 1, horror: 1, health: 5, damageTaken: 0, exhausted: false, traits: ['Monster'], engagedSeat: 0,
  }
  s.enemies = [enemy]
  inv.engaged = [enemy.id]
  s.skillTest = { seat: 0, helpRequested: false, committed: [], publicLog: [] }
  s.phase = 'mythos'
  const events = []
  enemyAttack(s, enemy, inv, events, '测试攻击')
  const attackCues = seat => viewEvents(events, seat)
    .filter(event => event.type === 'info' && event.presentation?.kind === 'attack')
  for (const seat of [0, 1, null]) {
    assert.equal(attackCues(seat).length, 1, `观察者 ${seat} 应看到攻击演出`)
    assert.equal(attackCues(seat)[0].privateSeat, undefined, '演出事件不能带 privateSeat')
  }
})

test('演出快照里的敌人派生数值与实时观察同口径（卡面修正不退回印刷值）', () => {
  // 客户端在演出播放期间用 tableState 重绘牌桌（table-presentation.js applyStep）；
  // 快照若只带印刷值，01175「交战且剩余神智 ≤4：+1 战斗/+1 躲避」这类卡面修正
  // 会在演出期间掉回 3/3，演完才跳回 4/4。快照必须和 viewState 同口径。
  const s = createGameState({ playerInvestigator: '01001', seed: 'presentation-enemy-modifiers' }, [{ seat: 0 }])
  const inv = s.investigators[0]
  inv.horror = inv.maxSanity - 4
  const byakhee = {
    id: 'byakhee-1', code: 'screechingByakhee', originalCode: '01175', name: '尖叫的拜亚基',
    location: inv.location, engagedSeat: 0, health: 4, damageTaken: 2, fight: 3, evade: 3,
    damage: 1, horror: 2, traits: ['Monster', 'Byakhee'], exhausted: false, victory: 1,
  }
  s.enemies.push(byakhee)
  inv.engaged.push(byakhee.id)
  const readouts = { enemyHealth, enemyFightValue, enemyEvadeValue }
  const live = viewState(s, 0).enemies.find(item => item.id === byakhee.id)
  const snapshot = () => captureTableState(s, getStat, getMaxSanity, readouts).enemies.find(item => item.id === byakhee.id)
  assert.equal(live.effectiveFight, 4, '剩余神智 4：实时观察应有 +1 战斗')
  assert.equal(snapshot().effectiveFight, live.effectiveFight)
  assert.equal(snapshot().effectiveEvade, live.effectiveEvade)
  assert.equal(snapshot().health, live.health, '生命值修正同样按引擎读点结算')
  assert.equal(snapshot().fight, 3, '印刷值仍然保留给卡面/差分显示')
  // 未注入读点的旧调用方保持原行为（不带派生字段，客户端退回印刷值）。
  const legacy = captureTableState(s, getStat, getMaxSanity).enemies.find(item => item.id === byakhee.id)
  assert.equal(legacy.effectiveFight, undefined)
  assert.equal(legacy.effectiveEvade, undefined)
  // 剩余神智 5：不应加成，快照与实时观察都是印刷值。
  inv.horror = inv.maxSanity - 5
  const resting = viewState(s, 0).enemies.find(item => item.id === byakhee.id)
  assert.equal(resting.effectiveFight, 3)
  assert.equal(snapshot().effectiveFight, resting.effectiveFight)
  assert.equal(snapshot().effectiveEvade, resting.effectiveEvade)
})

test('行动结束的检查点快照带上敌人有效战斗/躲避', () => {
  const s = fixture()
  const inv = s.investigators[0]
  inv.horror = inv.maxSanity - 4
  const byakhee = makeEnemy(s, {
    code: 'screechingByakhee', originalCode: '01175', name: '尖叫的拜亚基',
    fight: 3, evade: 3, health: 4, damageTaken: 0, damage: 1, horror: 2,
    traits: ['Monster', 'Byakhee'], victory: 1,
  })
  const events = move(s, { action: 'resource' })
  const checkpoint = events.find(event => event.type === 'presentation' && event.kind === 'checkpoint')
  assert.ok(checkpoint, '每条行动都应带检查点演出快照')
  const captured = checkpoint.tableState.enemies.find(item => item.id === byakhee.id)
  assert.equal(captured.effectiveFight, 4)
  assert.equal(captured.effectiveEvade, 4)
  assert.equal(captured.health, 4)
})

