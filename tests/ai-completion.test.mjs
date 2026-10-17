import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import http from 'node:http'
import arkham from '../index.js'
import { createGameState, applyMove, decisionSeat, actionPreview, performTest } from '../src/engine/engine.js'
import { aiDecisionContext } from '../src/ai/ai-context.js'
import { resolveTransaction } from '../src/engine/resolution.js'
import { buildDeck } from '../src/deck/deckbuilding.js'
import { INVESTIGATORS } from '../src/cards/cards-data.js'
import { availablePurchases, replacementOptions, stagePurchase, upgradeRecord, finishUpgradeDraft } from '../src/campaign/campaign.js'
import { commitAgentPlan, plansForObserver, normalizePlan } from '../src/ai/agent-plans.js'
import { buildUserPrompt, buildChatUserPrompt, buildChatSystemPrompt } from '../../../lib/agent/prompt.js'
import { createAgent } from '../../../lib/agent/orchestrator.js'
import { createServer } from '../../../lib/server.js'
import { snapshotPath } from '../../../lib/sessions.js'

function settle(s) {
  for(let i=0;s.pendingChoice;i++) {
    assert.ok(i<100)
    const c=s.pendingChoice,o=c.options.find(o=>['done','skip','self'].includes(o.id))||c.options[0]
    applyMove(s,c.seat,{action:'choose',choiceId:c.id,optionId:o.id})
  }
}
function fixture(count=1) { const s=createGameState({playerInvestigator:'01001',seed:'ai-tests'},Array.from({length:count},(_,seat)=>({seat})));settle(s);return s }
const context=s=>JSON.parse(aiDecisionContext(s,decisionSeat(s)).split('\n')[2])

test('AI sees clue deficit and round-end payment location instead of guessing from the barrier story', () => {
  const state = fixture(2)
  state.actIndex = 1
  state.currentSeat = 1
  state.locations = ['hallway', 'cellar', 'attic', 'parlor'].map(id => ({
    ...structuredClone(state.scenario.locations[id]), id, revealed: true,
    clues: id === 'cellar' ? 4 : 0, maxClues: id === 'cellar' || id === 'attic' ? 4 : 0,
  }))
  Object.assign(state.investigators[0], {defeated: true, location: 'cellar', clues: 0})
  Object.assign(state.investigators[1], {location: 'hallway', clues: 4, actionsLeft: 3})
  state.clues = 4
  const before = JSON.stringify(state)
  const data = context(state)
  assert.equal(data.actObjective.requiredClues, 6, 'defeated seats still count toward the objective')
  assert.equal(data.actObjective.availableTeamClues, 4)
  assert.equal(data.actObjective.cluesStillToCollect, 2)
  assert.equal(data.actObjective.locationId, 'hallway')
  assert.equal(data.actObjective.timing, 'roundEnd')
  assert.equal(data.actObjective.readyForPayment, false)
  assert.equal(data.locations.find(loc => loc.id === 'cellar').clues, 4)
  assert.equal(data.locations.find(loc => loc.id === 'parlor').clues, 0)
  assert.equal(data.team[1].locationId, 'hallway')
  const moves = arkham.legalMoves(state)
  assert.match(moves.find(m => m.action === 'move' && m.locationId === 'cellar').label, /线索 4/)
  assert.ok(!moves.some(m => m.action === 'move' && m.locationId === 'parlor'), 'the barrier blocks even an incorrectly revealed Parlor in an old save')
  assert.ok(!moves.some(m => m.action === 'advanceAct'))
  const session = {state, players: [{seat: 0, name: '玩家'}, {seat: 1, name: '队友'}], events: [], notes: []}
  for (const prompt of [buildUserPrompt(arkham, session, 1), buildChatUserPrompt(arkham, session, 1, '去哪里？', 'table')]) {
    assert.ok(prompt.includes('需要 6 个线索'))
    assert.ok(prompt.includes('还需收集 2'))
    assert.ok(prompt.includes('仅在回合结束时触发支付选择'))
    assert.ok(!prompt.includes('revealParlor'), 'do not expose the unrevealed act reverse')
  }
  assert.equal(JSON.stringify(state), before)
  state.investigators[1].clues = 6
  assert.equal(context(state).actObjective.readyForPayment, true)
  assert.ok(!arkham.legalMoves(state).some(m => m.action === 'advanceAct'), 'round-end act cannot be paid early')
  state.investigators[1].location = 'parlor'
  const away = context(state).actObjective
  assert.equal(away.cluesStillToCollect, 0)
  assert.equal(away.cluesMissingAtLocation, 6)
  assert.equal(away.readyForPayment, false)
  state.actIndex = 0
  assert.equal(context(state).actObjective.timing, 'actionWindow')
  assert.ok(arkham.legalMoves(state).some(m => m.action === 'advanceAct'))
})

function participationSession() {
  const state = fixture(2)
  state.currentSeat = 1
  // Deliberately remove the defeat event from the recent window and preserve stale plans.
  state.log = Array.from({length: 20}, () => '新的回合记录')
  state.investigators[0].hand = ['PRIVATE_HAND_SENTINEL']
  state.investigators[0].deck = ['PRIVATE_DECK_SENTINEL']
  return { modId: arkham.id, sessionId: 'participation-test', state,
    players: [{seat: 0, role: 'human', name: '林舟'}, {seat: 1, role: 'ai', name: '柚子'}],
    events: [{seq: 0, type: 'chat', seat: 1, to: null, text: '林舟继续调查，我来战斗。'}],
    notes: [{id: 'n1', scope: 'team', text: '林舟负责调查'}] }
}

test('AI chat and action prompts retain explicit participation and player identity without recent defeat logs', () => {
  for (const [status, flags, label] of [
    ['defeated', {defeated: true, defeatCause: 'damage'}, '已被击败（本关出局）'],
    ['defeated', {defeated: true, defeatCause: 'horror'}, '已被击败（本关出局）'],
    ['resigned', {resigned: true}, '已撤退（本关离场）'],
    ['killed', {}, '已永久死亡'],
    ['insane', {}, '已永久疯狂'],
  ]) {
    const session = participationSession(), inv = session.state.investigators[0]
    Object.assign(inv, flags)
    if (['killed', 'insane'].includes(status)) session.state.campaign.investigators[0].status = status
    const before = JSON.stringify(session)
    for (const prompt of [buildChatUserPrompt(arkham, session, 1, '我该做什么？', 'table'), buildUserPrompt(arkham, session, 1)]) {
      assert.ok(prompt.includes(`座位 0：林舟，真人玩家；调查员：${inv.name}`))
      assert.ok(!prompt.includes('老师'), 'generic context must not impose a persona-specific address')
      assert.ok(prompt.includes(`座位 0／${inv.name}：${label}`))
      assert.ok(prompt.includes('不要给该调查员分配任务'))
      assert.ok(!prompt.includes('PRIVATE_HAND_SENTINEL') && !prompt.includes('PRIVATE_DECK_SENTINEL'))
    }
    const data = context(session.state)
    assert.equal(data.team[0].status, status)
    assert.equal(data.team[0].canParticipateInScenario, false)
    assert.equal(data.team[1].canParticipateInScenario, true)
    assert.equal(JSON.stringify(session), before)
  }
  const session = participationSession()
  session.state.investigators[0].defeated = true
  assert.equal(context(session.state).team[0].canParticipateInScenario, false)
  // A new scenario resets engine flags: the old status must not stick in AI memory.
  session.state.investigators[0].defeated = false
  assert.equal(context(session.state).team[0].canParticipateInScenario, true)
  session.state.uiState = 'interlude'
  assert.equal(context(session.state).team[0].canParticipateInScenario, false)
  assert.ok(arkham.describeState(session.state, 1).includes('当前不在进行中的关卡内'))
  const hub = arkham.createState({}, session.players)
  hub.campaign.investigators[0] = {...session.state.campaign.investigators[0], status: 'killed'}
  const hubPrompt = buildChatUserPrompt(arkham, {...session, state: hub}, 1, '下一关怎么办？', 'table')
  assert.ok(hubPrompt.includes('【战役局外】'))
  assert.ok(hubPrompt.includes(`座位 0／${hub.investigators[0].name}：已永久死亡`))
})

test('AI chat sends defeat awareness and identity to the model while preserving post-defeat discussion', {timeout: 10000}, async () => {
  const session = participationSession()
  Object.assign(session.state.investigators[0], {defeated: true, defeatCause: 'damage'})
  const original = JSON.stringify(session)
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'arkham-chat-participation-'))
  const oldHome = process.env.DSH_HOME
  process.env.DSH_HOME = home
  const requests = []
  const model = http.createServer((req, res) => {
    let body = ''
    req.on('data', chunk => { body += chunk })
    req.on('end', () => {
      requests.push(JSON.parse(body))
      res.setHeader('content-type', 'application/json')
      res.end(JSON.stringify({choices: [{message: {content: JSON.stringify({reply: '老师已退出本关，接下来由我调查。', memory: {add: [], update: [], remove: []}})}}]}))
    })
  })
  try {
    await listen(model)
    const agent = createAgent({modById: () => arkham, getAi: () => ({persona: '称呼玩家为老师。'}),
      getConfig: () => ({apiKey: 'stub-key', baseUrl: `http://127.0.0.1:${model.address().port}`, model: 'stub', maxRetries: 1, timeoutMs: 3000})})
    const result = await agent.agentChat(session, 1, '我倒下了，现在怎么办？', 'table')
    assert.equal(result.error, undefined)
    assert.ok(result.reply)
    assert.equal(requests.length, 1)
    const [system, user] = requests[0].messages
    assert.ok(system.content.includes('玩家继续发言不代表调查员恢复行动'))
    assert.ok(system.content.includes('不得要求其调查、战斗、移动'))
    assert.ok(system.content.includes('称呼玩家为老师。'), 'the selected persona still controls its address')
    assert.ok(user.content.includes('座位 0：林舟，真人玩家'))
    assert.ok(!user.content.includes('老师'))
    assert.ok(user.content.includes('已被击败（本关出局），因伤害被击败'))
    assert.ok(user.content.includes('旧讨论、备忘和计划不能覆盖当前参与状态'))
    assert.equal(JSON.stringify(session), original, 'chat must not revive or advance any investigator')
    assert.ok(buildChatSystemPrompt(arkham, {}, session, 1).includes('被击败不等于永久死亡'))
  } finally {
    await close(model)
    if (oldHome === undefined) delete process.env.DSH_HOME
    else process.env.DSH_HOME = oldHome
    fs.rmSync(home, {recursive: true, force: true})
  }
})

test('AI context: implemented cards, costs, attack risk, private hands and order-safe deck counts',()=>{
  const s=fixture(2);s.currentSeat=0
  const inv=s.investigators[0];inv.hand=['01016','01090'];inv.resources=8
  s.investigators[1].hand=['PRIVATE_HAND_SENTINEL'];s.investigators[1].deck=['PRIVATE_DECK_SENTINEL']
  inv.engaged=['enemy'];s.enemies=[{id:'enemy',name:'测试敌人',location:inv.location,engagedSeat:0,damage:2,horror:1}]
  const before=JSON.stringify(s), data=context(s), text=arkham.describeState(s,0)
  assert.ok(data.cards.find(c=>c.code==='01016').implemented)
  assert.equal(actionPreview(s,0,{action:'play',cardId:'01016'}).resources,4)
  assert.equal(actionPreview(s,0,{action:'resource'}).opportunityAttacks[0].damage,2)
  assert.equal(actionPreview(s,0,{action:'fight',enemyId:'enemy'}).opportunityAttacks.length,0)
  s.enemies[0].parleyCost=3
  assert.equal(actionPreview(s,0,{action:'parley',enemyId:'enemy'}).resources,3)
  delete s.enemies[0].parleyCost
  assert.ok(!text.includes('PRIVATE_HAND_SENTINEL')&&!text.includes('PRIVATE_DECK_SENTINEL'))
  assert.equal(JSON.stringify(s),before)
  const original=aiDecisionContext(s,0);s.investigators[0].deck.reverse()
  assert.equal(aiDecisionContext(s,0),original)
  assert.ok(!original.includes('rngState')&&!original.includes('continuation'))
})

test('AI turn boundaries distinguish the next round even for the same solo seat',()=>{
  const s=fixture(), key=arkham.agentTurnKey(s,0)
  s.round++
  assert.notEqual(arkham.agentTurnKey(s,0),key)
})

test('AI action chat has a deterministic fallback without exposing private choices',()=>{
  const before={investigators:[{seat:1,name:'黛西'}],pendingChoice:{kind:'search',options:[{id:'SECRET_CARD'}]}}
  assert.equal(arkham.agentActionMessage({before,seat:1,move:{action:'choose',optionId:'SECRET_CARD',label:'秘密卡牌'}}),'黛西：已完成搜索。')
  assert.equal(arkham.agentActionMessage({before,seat:1,move:{action:'resource'}}),'黛西：已完成获得资源。')
})

test('AI skill test context exposes current value, difficulty, commit icons and projected value',()=>{
  const s=fixture();s.investigators[0].hand=['01090'];s.investigators[0].assets=[]
  resolveTransaction(s,0,{action:'context-test'},draft=>performTest(draft,0,'intellect',4,{skillBonus:2}))
  assert.equal(s.pendingChoice.kind,'commit')
  const d=context(s)
  assert.equal(d.test.value,5);assert.equal(d.test.difficulty,4)
  assert.equal(d.commitOptions[0].icons,2);assert.equal(d.commitOptions[0].valueAfter,7)
})

test('AI plans survive JSON, remain private, expire intent on round/scenario, and reset for replacement',()=>{
  const session={state:fixture(2),players:[{seat:0},{seat:1}],events:[],notes:[],modId:arkham.id}
  commitAgentPlan(session,1,{role:'investigate',objective:'PRIVATE_OBJECTIVE',intent:'PRIVATE_INTENT',upgrade:'PRIVATE_UPGRADE'})
  const restored=JSON.parse(JSON.stringify(session))
  assert.deepEqual(plansForObserver(restored,1),plansForObserver(session,1))
  assert.ok(!JSON.stringify(plansForObserver(restored,0)).includes('PRIVATE'))
  const own=buildUserPrompt(arkham,restored,1)
  assert.ok(own.includes('PRIVATE_UPGRADE'))
  assert.match(own.split('\n').at(-1), /"plan"/)
  restored.state.round++
  assert.equal(plansForObserver(restored,1).own.needsReview,true)
  assert.equal(plansForObserver(restored,1).own.intent,undefined)
  assert.equal(plansForObserver(restored,1).own.upgrade,'PRIVATE_UPGRADE')
  restored.state.investigators[1].campaignId='replacement'
  assert.equal(plansForObserver(restored,1).own,null)
  const pre=structuredClone(session.state);session.state.round++
  commitAgentPlan(session,1,{intent:'OLD_ROUND'},pre)
  assert.equal(plansForObserver(session,1).own.intent,undefined)
  assert.equal(normalizePlan({role:'admin',intent:'x'.repeat(1000),secret:'hidden'}).intent.length,160)
})

test('AI upgrades allow multiple purchases, draft restore, confirmation and cancellation',()=>{
  const s=fixture(),cp=s.campaign;cp.phase='interlude';cp.investigators[0].xp=10
  const original=structuredClone(cp.investigators[0])
  for(let i=0;i<2;i++) {
    const r=upgradeRecord(cp.investigators[0]),added=availablePurchases(r).find(c=>!r.deck.includes(c))
    assert.ok(added);const option=replacementOptions(r,added)[0]
    stagePurchase(cp,0,added,option.code)
  }
  assert.equal(cp.investigators[0].upgradeDraft.changes.length,2)
  assert.equal(cp.investigators[0].xp,10)
  const restored=JSON.parse(JSON.stringify(cp)),expected=structuredClone(upgradeRecord(restored.investigators[0]))
  finishUpgradeDraft(restored,0,true);assert.deepEqual(restored.investigators[0],expected)
  finishUpgradeDraft(cp,0,false);assert.deepEqual(cp.investigators[0],original)
})

const listen=server=>new Promise(resolve=>server.listen(0,'127.0.0.1',resolve))
const close=server=>new Promise(resolve=>{server.closeAllConnections();server.close(resolve)})

test('AI HTTP: model selects and builds, retries invalid deck, persists plans, masks private rationale', {timeout:30000},async()=>{
  const keys=['DSH_HOME','AI_API_KEY','AI_BASE_URL','AI_MAX_RETRIES','AI_TIMEOUT_MS']
  const old=Object.fromEntries(keys.map(k=>[k,process.env[k]]))
  const home=fs.mkdtempSync(path.join(os.tmpdir(),'arkham-ai-complete-'))
  process.env.DSH_HOME=home;process.env.AI_API_KEY='local-stub';process.env.AI_MAX_RETRIES='2';process.env.AI_TIMEOUT_MS='3000'
  const deck=buildDeck(INVESTIGATORS['01002'],{seed:'authored-test'}).playerCards
  const queue=[{action:'hubSelectInvestigator',code:'01002'},{action:'hubSetDeck',codes:['01016']},
    {action:'hubSetDeck',codes:deck},{action:'hubDoneSeat'}]
  const prompts=[];let hall
  const model=http.createServer((req,res)=>{let body='';req.on('data',b=>body+=b);req.on('end',()=>{
    prompts.push(JSON.parse(body));const move=queue.shift()
    res.setHeader('content-type','application/json');res.end(JSON.stringify({choices:[{message:{content:JSON.stringify({move,speech:'我来调查。',plan:{role:'investigate',objective:'PRIVATE_GOAL',intent:'PRIVATE_INTENT',upgrade:'PRIVATE_UPGRADE'}})}}]}))
  })})
  try {
    await listen(model);process.env.AI_BASE_URL=`http://127.0.0.1:${model.address().port}`
    hall=createServer({mods:[arkham],persist:true});await hall.ready;await listen(hall)
    const base=`http://127.0.0.1:${hall.address().port}`
    const post=async(url,body)=>{const r=await fetch(base+url,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)});const d=await r.json();assert.equal(r.status,200,d.error);return d}
    let s=(await post('/api/start',{modId:arkham.id,settings:{playerCount:2,aiRoutineSpeechFrequency:100}})).session
    for(const move of [{action:'hubGoSetup'},{action:'hubSelectInvestigator',code:'01001'},{action:'hubAutoDeck'},{action:'hubDoneSeat'}]) {
      s=(await post('/api/move',{sessionId:s.sessionId,revision:s.state.revision,move})).session
    }
    assert.equal(queue.length,0);assert.equal(prompts.length,4)
    const messages = s.events.filter(e => e.type === 'chat' && e.origin === 'action')
    assert.equal(messages.length, 3, 'only three committed moves publish messages; rejected deck publishes none')
    assert.ok(messages.every(e => e.seat === 1 && e.to === null && e.text === '我来调查。' && e.replyRequested === false))
    assert.equal(new Set(messages.map(e => e.revision)).size, 3)
    assert.ok(prompts[2].messages.some(m=>m.content.includes('不合法')))
    assert.ok(prompts[1].messages.some(m=>m.content.includes('buildPool')))
    const saved=JSON.parse(fs.readFileSync(snapshotPath(s.sessionId),'utf8')).session
    assert.equal(saved.state.investigators[1].code,'01002')
    assert.equal(saved.state.investigators[1].autoBuilt,false)
    assert.equal(saved.agentPlans[1].upgrade,'PRIVATE_UPGRADE')
    assert.ok(!JSON.stringify(s).includes('PRIVATE_UPGRADE'))
    assert.deepEqual(s.agentPlans.team,[{seat:1,role:'investigate'}])
    const loaded=(await post('/api/session/load',{sessionId:s.sessionId})).session
    assert.deepEqual(loaded.events.filter(e => e.origin === 'action'), messages)
    assert.deepEqual(loaded.agentPlans,s.agentPlans)
    assert.equal(saved.events.filter(e=>e.type==='agentDecision'&&e.fallback).length,0)
    assert.equal(loaded.state.hubReady,true)
    assert.equal(loaded.state.hubSeatDone[1],true)
    assert.equal(loaded.state.currentSeat,0,'全队就绪后把开始关卡交给玩家确认')
    assert.equal(loaded.state.uiState,'scenarioSetup')
    assert.equal(loaded.state.campaign.investigators[1].deck,undefined)
    assert.ok(loaded.state.campaign.investigators[1].deckSize>0)
    const entered=(await post('/api/move',{sessionId:loaded.sessionId,revision:loaded.state.revision,move:{action:'hubBeginScenario'}})).session
    assert.equal(entered.state.uiState,'inScenario')
    assert.equal(entered.state.pendingChoice.kind,'mulligan')
    assert.equal(prompts.length,4,'等待玩家换牌，不额外调用队友模型')
  } finally {
    if(hall)await close(hall);await close(model)
    for(const key of keys)old[key]===undefined?delete process.env[key]:process.env[key]=old[key]
    fs.rmSync(home,{recursive:true,force:true})
  }
})

test('AI fallback remains available without allowing model to silently delegate deckbuilding',async()=>{
  const state=arkham.createState({},[{seat:0},{seat:1}])
  applyMove(state,0,{action:'hubGoSetup'});applyMove(state,0,{action:'hubSelectInvestigator',code:'01001'})
  applyMove(state,0,{action:'hubAutoDeck'});applyMove(state,0,{action:'hubDoneSeat'})
  const session={modId:arkham.id,sessionId:'no-key-ai-test',state,players:[{seat:0,role:'human'},{seat:1,role:'ai'}],events:[]}
  const agent=createAgent({modById:()=>arkham,getAi:()=>({}),getConfig:()=>({apiKey:''})})
  let result=await agent.agentPlay(session,1);assert.equal(result.fallback,true)
  assert.equal(result.move.action,'hubSelectInvestigator');applyMove(state,1,result.move)
  result=await agent.agentPlay(session,1);assert.equal(result.move.action,'hubAutoDeck')
  assert.ok(arkham.validateAgentMove(state,1,result.move))
  assert.equal(arkham.validateMove(state,1,result.move),null)
})
