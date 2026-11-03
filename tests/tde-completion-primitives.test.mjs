import test from 'node:test'
import assert from 'node:assert/strict'
import { fixture, asset, enemy, move, settle } from './core-fixture.mjs'
import * as engine from '../src/engine/engine.js'
import { resolveTransaction } from '../src/engine/resolution.js'
import { placeSwarmCards, swarmCardsOf } from '../src/engine/swarm.js'
import { viewState } from '../src/integration/observation.js'
import { validateDeckRules } from '../web/deck-rules.js'
import { ALL_CARDS } from '../src/cards/cards-data.js'
import { behavior as dreamBehavior } from '../content/campaigns/theDreamEaters/scenarios/beyondTheGatesOfSleep/behavior.js'
import { DREAMS } from '../content/campaigns/theDreamEaters/scenarios/beyondTheGatesOfSleep/definition.js'
import { repairRuntimeCardModels } from '../src/engine/save-migration.js'

function run(state, execute, choose = () => null) {
  resolveTransaction(state, 0, { action: 'completionProbe' }, execute)
  for (let count = 0; state.pendingChoice; count++) {
    assert.ok(count < 200, 'choice transaction converges')
    const q = state.pendingChoice
    const id = choose(q) ?? q.options.find(o => ['done','skip','self'].includes(o.id))?.id ?? q.options[0].id
    assert.ok(q.options.some(o => o.id === id), `${q.kind}: ${id}`)
    resolveTransaction(state, q.seat, { action: 'choose', choiceId: q.id, optionId: id }, execute)
  }
}

function withApi(state, resolve) {
  return engine.executeDescriptor(state, { inv: state.investigators[0], source: { code: '01088', id: 'probe' },
    descriptor: { code: '01088', id: 'completionProbe', kind: 'forced', label: 'probe',
      cost: { action: false }, trigger: [], limit: null, resolve: ctx => resolve(ctx.api, ctx) }, events: [], silent: true })
}

test('TDE completion: saved global cards and agenda-side cards restore once without losing rotation or identity',()=>{
  const s=fixture()
  s.scenario.id='weaverOfTheCosmos'
  s.scenarioFlags={atlachCenter:{assembled:true,enemySide:false},atlachRotation:135,agendaAside:['06194']}
  repairRuntimeCardModels(s,[])
  const center=s.enemies.find(enemy=>enemy.code==='06346')
  assert.ok(center?.global)
  assert.equal(center.rotation,135)
  assert.equal(s.agendaAside[0].code,'06194')
  const before=JSON.stringify(s)
  repairRuntimeCardModels(s,[])
  assert.equal(JSON.stringify(s),before)
})

test('TDE completion: cancelled damage never lands on the infested Corrupted Orderly',()=>{
  const s=fixture()
  s.scenario.id='wakingNightmare'
  const target=enemy(s,{code:'06082',originalCode:'06082',health:10})
  s.infestedLocations=[target.location]
  engine.damageEnemy(s,target,1,0,[])
  assert.equal(target.damageTaken,0)
  engine.damageEnemy(s,target,3,0,[])
  assert.equal(target.damageTaken,2)
})

test('TDE completion: Eye of Truth captures a replayed physical treachery and supplies icons to its next test',()=>{
  const s=fixture(),inv=s.investigators[0]
  inv.hand=['06325'];s.encounterDiscard=['rottingRemains'];inv.willpower=0
  run(s,current=>engine.replayEncounterRevelation(current,current.investigators[0],[],'rottingRemains'),q=>
    q.kind==='commit'?q.options.find(option=>option.label.includes('真理之眼'))?.id:null)
  const captured=s.victoryDisplay.find(card=>card.code==='01163')
  assert.ok(captured)
  assert.equal(captured.attachments[0].code,'06325')
  assert.equal(s.encounterDiscard.includes('rottingRemains'),false)
  assert.equal(s.investigators[0].discard.includes('06325'),false)
  const horror=s.investigators[0].horror
  s.encounterDeck=['rottingRemains']
  run(s,current=>engine.drawEncounter(current,current.investigators[0],[]))
  assert.equal(s.investigators[0].horror,horror,'同名显现自动获得四个万能图标')
})

test('TDE completion: old swarm placeholders migrate to physical cards, preserve ownership and remain stable after JSON', () => {
  const s=fixture(), host=enemy(s,{swarmCards:[{id:'swarm1',code:'dissonantVoices',defeated:false}]})
  s.investigators[0].deck=['01020','01088'];s.encounterDeck=['ancientEvils']
  const changes=[]
  repairRuntimeCardModels(s,changes)
  assert.equal(s.enemies.find(e=>e.hostId===host.id).underlyingCard,'01088')
  assert.deepEqual(s.investigators[0].deck,['01020'])
  assert.deepEqual(s.encounterDeck,['dissonantVoices','ancientEvils'])
  assert.ok(changes.length)
  const restored=JSON.parse(JSON.stringify(s)), before=JSON.stringify(restored)
  repairRuntimeCardModels(restored,[])
  assert.equal(JSON.stringify(restored),before)
})

test('TDE completion: upgraded Diaries share one personal bonded pool while investigators keep separate pools', () => {
  const s=fixture('01001',2)
  s.bondedSets={'06236':{seat:0,cards:['06113'],retrieved:false},'06237':{seat:0,cards:['06113'],retrieved:false},
    '06238':{seat:1,cards:['06113'],retrieved:false}}
  repairRuntimeCardModels(s,[])
  assert.deepEqual(s.bondedSets['06112'].cards,['06113'])
  assert.deepEqual(s.bondedSets['06112@1'].cards,['06113'])
  run(s,current=>withApi(current,api=>api.bonded.retrieve(0,'06237',{handCount:1})))
  assert.ok(s.investigators[0].hand.includes('06113'))
  assert.deepEqual(s.bondedSets['06112@1'].cards,['06113'])
})

test('TDE completion: global center card rotates, cannot be damaged and flips as the same enemy instance', () => {
  const s=fixture(), api=engine.scenarioRuntime(s,[])
  s.scenario.enemies['ghoulMinion']={...s.scenario.enemies.ghoulMinion}
  const center=api.putGlobalEnemy('ghoulMinion'), id=center.id
  api.rotateGlobalEnemy(center,90)
  engine.damageEnemy(s,center,99,0,[])
  assert.equal(center.damageTaken,0)
  assert.equal(engine.enemyCanBeDefeated(s,center),false)
  assert.equal(center.rotation,90)
  api.placeGlobalEnemyAt(center,s.investigators[0].location)
  assert.equal(center.id,id)
  assert.equal(center.global,false)
  assert.equal(center.face,'front')
})

test('TDE completion: Pitch Spider attacks choose damage or horror through the normal attack pipeline', () => {
  for (const selected of ['damage','horror']) {
    const s=fixture();s.scenario.id='pointOfNoReturn'
    enemy(s,{code:'06273',originalCode:'06273',damage:2,horror:2})
    run(s,current=>engine.enemyAttack(current,current.enemies[0],current.investigators[0],[]),q=>
      q.source==='06273' && q.options.some(option=>option.id===selected) ? selected : null)
    assert.equal(s.investigators[0].damage,selected==='damage'?2:0)
    assert.equal(s.investigators[0].horror,selected==='horror'?2:0)
  }
})

test('TDE completion: Dhole tunnel connections affect the whole hunter route and leave the investigator graph unchanged', () => {
  const s=fixture();s.scenario.id='pointOfNoReturn'
  s.locations=['a','b','c','d','e'].map((id,index)=>({id,revealed:true,clues:0,connections:[...new Set([index>0?'abcde'[index-1]:null,index<4?'abcde'[index+1]:null].filter(Boolean))],
    attachments:['a','d'].includes(id)?[{code:'06272',id:'tunnel-'+id}]:[]}))
  s.investigators[0].location='e'
  const dhole=enemy(s,{code:'06271',originalCode:'06271',location:'a',hunter:true,engagedSeat:null})
  assert.equal(engine.distanceToInvestigator(s,'a',[s.investigators[0]]),4)
  assert.equal(engine.distanceToInvestigator(s,'a',[s.investigators[0]],dhole),2)
  run(s,current=>{const next=engine.hunterStep(current,current.enemies[0]);engine.relocateEnemy(current,current.enemies[0],next,[])})
  assert.equal(s.enemies[0].location,'d')
})

test('TDE completion: class dreams search by faction and actually play the chosen asset for its normal resource cost', () => {
  const s=fixture(), inv=s.investigators[0]
  s.scenario.dreams=DREAMS
  inv.deck=['01020','01088']; inv.resources=5; inv.klass='guardian'
  const actions=inv.actionsLeft
  run(s,current=>dreamBehavior.preScenarioSetup(current,[],engine.scenarioRuntime(current,[])),q=>
    q.source==='06039-dreams'?'guardian':q.kind==='search'?q.options.find(o=>o.cardCode==='01020')?.id:null)
  assert.ok(s.investigators[0].assets.some(a=>a.code==='01020'))
  assert.equal(s.investigators[0].resources,2)
  assert.equal(s.investigators[0].actionsLeft,actions)
  assert.equal(s.investigators[0].hand.includes('01020'),false)
})

test('TDE completion: the medic dream grants additional starting cards to its chosen investigator before starting hands are drawn', () => {
  const s=fixture('01001',2)
  s.scenario.dreams=DREAMS
  s.investigators[0].traits=['Medic']; s.investigators[0].klass='neutral'
  s.investigators[1].klass='neutral'
  run(s,current=>dreamBehavior.preScenarioSetup(current,[],engine.scenarioRuntime(current,[])),q=>
    q.source==='06039-dreams'?(q.seat===0?'medicOrAssistant':'neutral1'):q.kind==='investigator'?'1':null)
  assert.equal(s.investigators[1].openingHandBonus,1)
  assert.equal(s.investigators[1].resources,34)
  assert.deepEqual(s.investigators[1].hand,[])
})

test('TDE completion: swarms use physical investigator deck cards, expose independent legal targets and hide their backs', () => {
  const s=fixture(), inv=s.investigators[0]
  inv.deck=['01039','01088','01089']
  const host=enemy(s,{health:2,swarming:{kind:'fixed',value:2}})
  placeSwarmCards(s,host,2)
  assert.equal(s.enemies.length,3)
  assert.deepEqual(inv.deck,['01039'])
  assert.equal(engine.enemiesEngagedWith(s,inv).length,3)
  const targets=engine.legalMoves(s,0).filter(m=>m.action==='fight').map(m=>m.enemyId)
  assert.ok(s.enemies.every(e=>targets.includes(e.id)))
  const view=viewState(s,0)
  assert.ok(view.enemies.every(e=>!Object.hasOwn(e,'underlyingCard')))
  assert.ok(view.enemies.find(e=>e.id===host.id).swarmCards.every(c=>!Object.hasOwn(c,'code')))
})

test('TDE completion: a swarm attacks separately and moves, evades and readies as one group', () => {
  const s=fixture(), host=enemy(s,{health:2,damage:1})
  placeSwarmCards(s,host,2)
  run(s,current=>engine.enemyPhase(current))
  assert.equal(s.investigators[0].damage,3)
  assert.ok(s.enemies.every(e=>e.exhausted))
  s.locations.push({id:'other',name:'other',revealed:true,clues:0,shroud:1,connections:[]})
  run(s,current=>{
    const h=current.enemies.find(e=>!e.hostId)
    engine.scenarioRuntime(current,[]).readyEnemy(h)
    engine.relocateEnemy(current,h,'other',[])
    engine.autoEvadeEnemy(current,current.enemies.find(e=>e.hostId),[])
  })
  assert.ok(s.enemies.every(e=>e.location==='other'&&e.exhausted&&e.engagedSeat==null))
  assert.deepEqual(s.investigators[0].engaged,[])
})

test('TDE completion: excess damage is optional, swarm cards return to their owner and only the host grants victory', () => {
  const s=fixture(), host=enemy(s,{health:1,victory:2})
  s.investigators[0].deck=['01039','01088','01089']
  placeSwarmCards(s,host,2)
  const copies=s.enemies.filter(e=>e.hostId)
  assert.equal(engine.enemyCanBeDefeated(s,host),false)
  run(s,current=>engine.damageEnemy(current,current.enemies.find(e=>e.id===copies[0].id),3,0,[]),
    q=>q.kind==='enemy'?q.options.find(o=>o.id!=='skip')?.id:null)
  assert.equal(s.enemies.length,0)
  assert.equal(s.victoryDisplay.filter(c=>c.id===host.id).length,1)
  assert.ok(s.victoryDisplay.every(c=>!copies.some(e=>e.id===c.id)))
  assert.deepEqual(s.investigators[0].deck,['01088','01089','01039'])
  assert.ok(!s.encounterDiscard.includes('01088')&&!s.encounterDiscard.includes('01089'))
})

test('TDE completion: Deeper Slumber checks after a whole draw batch and dynamic duplicate hand limits stay correct', () => {
  const s=fixture(), inv=s.investigators[0]
  inv.hand=Array(5).fill('01039'); inv.deck=Array(6).fill('01088')
  inv.threat=[{id:'slumber',code:'06095'}]
  run(s,current=>engine.drawCards(current,current.investigators[0],3,[]))
  assert.equal(s.investigators[0].hand.length,5)
  s.investigators[0].hand=Array(5).fill('01039')
  asset(s,'06159')
  assert.equal(engine.getHandSize(s,s.investigators[0]),9,'five equal names add four redundant cards to the limit')
})

test('TDE completion: empty-use conditions resolve for an unrelated effect and spell charge spending can be restored', () => {
  const s=fixture(), amulet=asset(s,'06022',{uses:2})
  s.setAside=['06021','06021','06021']
  run(s,current=>withApi(current,api=>api.setAssetUses(current.investigators[0].assets.find(a=>a.id===amulet.id),0)))
  assert.ok(!s.investigators[0].assets.some(a=>a.code==='06022'))
  assert.equal(s.investigators[0].deck.filter(code=>code==='06021').length,3)
  const spell=asset(s,'01060',{uses:2,usesType:'charges'}), twila=asset(s,'06244')
  run(s,current=>withApi(current,api=>api.spendUses(current.investigators[0].assets.find(a=>a.id===spell.id),1)),
    q=>q.kind==='reaction'?q.options.find(o=>String(o.id).includes('06244'))?.id:null)
  assert.equal(s.investigators[0].assets.find(a=>a.id===spell.id).uses,2)
  assert.equal(s.investigators[0].assets.find(a=>a.id===twila.id).exhausted,true)
})

test('TDE completion: Black Cat replaces printed token effects without changing the revealed token', () => {
  for (const token of ['tablet','elderthing','eldersign']) {
    const s=fixture(), cat=asset(s,'06285',{damage:1,horror:1})
    s.chaosBag=[token]
    run(s,current=>engine.performTest(current,0,'intellect',0), q=>q.kind==='reaction'?q.options.find(o=>String(o.id).includes('06285'))?.id:null)
    const actual=s.investigators[0].assets.find(a=>a.id===cat.id)
    assert.ok(actual)
    assert.equal(actual.damage,token==='eldersign'?0:token==='tablet'?2:1)
    assert.equal(actual.horror,token==='eldersign'?0:token==='elderthing'?2:1)
    assert.deepEqual(s.lastTestResult.drawn,[token])
    assert.equal(s.lastTestResult.value,s.investigators[0].intellect+(token==='eldersign'?5:-1))
  }
})

test('TDE completion: Haste grants one matching action without using the ordinary action pool', () => {
  const s=fixture(), inv=s.investigators[0], haste=asset(s,'06239')
  inv.actionsLeft=4
  const before=inv.resources
  move(s,{action:'resource'});settle(s)
  move(s,{action:'resource'});settle(s,q=>q.kind==='reaction'?q.options.find(o=>String(o.id).includes('06239'))?.id:null)
  assert.equal(s.investigators[0].resources,before+3)
  assert.equal(s.investigators[0].actionsLeft,2)
  assert.equal(s.investigators[0].assets.find(a=>a.id===haste.id).exhausted,true)
})

test('TDE completion: a failed alternate play cost preserves the card, resources and actions, and bans its name this round', () => {
  const s=fixture(), inv=s.investigators[0]
  asset(s,'06329');inv.hand=['01060'];inv.resources=0;inv.actionsLeft=3
  s.chaosBag=['autofail']
  assert.equal(engine.validateMove(s,0,{action:'play',cardId:'01060'}),null)
  move(s,{action:'play',cardId:'01060'})
  settle(s,q=>q.kind==='reaction'?q.options.find(o=>String(o.id).includes('06329'))?.id:null)
  assert.deepEqual(s.investigators[0].hand,['01060'])
  assert.equal(s.investigators[0].resources,0)
  assert.equal(s.investigators[0].actionsLeft,3)
  assert.ok(engine.validateMove(s,0,{action:'play',cardId:'01060'}))
  s.round++
  s.investigators[0].resources=5
  assert.equal(engine.validateMove(s,0,{action:'play',cardId:'01060'}),null)
})

test('TDE completion: Essence of the Dream replaces hand discard and a shuffle with its own bonded set', () => {
  const s=fixture(), inv=s.investigators[0]
  inv.hand=['06113']
  run(s,current=>withApi(current,api=>api.discardFromHand(0,'06113')))
  assert.ok(!s.investigators[0].discard.includes('06113'))
  assert.equal(Object.values(s.bondedSets).flatMap(set=>set.cards).filter(code=>code==='06113').length,1)
  s.investigators[0].hand=['06113']
  run(s,current=>withApi(current,api=>{api.moveCard({seat:0,code:'06113',from:'hand',to:'deckTop'});api.shuffleDeck(0)}))
  assert.ok(!s.investigators[0].deck.includes('06113'))
  assert.equal(Object.values(s.bondedSets).flatMap(set=>set.cards).filter(code=>code==='06113').length,2)
})

test('TDE completion: Self-Centered blocks player benefits to others while harm and encounter effects remain legal', () => {
  const s=fixture('01001',2)
  s.investigators[0].threat=[{id:'selfish',code:'06035'}]
  s.investigators[1].damage=2;s.investigators[1].horror=2
  const hand=s.investigators[1].hand.length, resources=s.investigators[1].resources
  run(s,current=>withApi(current,api=>{
    api.drawCards(1,2);api.gainResources(1,3);api.healDamage(1,1);api.healHorror(1,1)
    api.damage(1,1);api.horror(1,1)
  }))
  assert.equal(s.investigators[1].hand.length,hand)
  assert.equal(s.investigators[1].resources,resources)
  assert.equal(s.investigators[1].damage,3)
  assert.equal(s.investigators[1].horror,3)
  run(s,current=>engine.scenarioRuntime(current,[]).drawCards(1,1))
  assert.equal(s.investigators[1].hand.length,hand+1)
})

test('TDE completion: Self-Sacrifice redirects the failed test effects while preserving its performer', () => {
  const s=fixture('01001',2)
  s.investigators[1].hand=['06157'];s.chaosBag=['autofail']
  run(s,current=>engine.performTest(current,0,'intellect',4,{resolve: result=>{
    if(!result.success) {
      engine.applyDamage(current,current.investigators[0],2,[])
      engine.scenarioRuntime(current,[]).loseResources(0,3)
    }
  }}), q=>q.kind==='commit' ? (q.seat===0?'help':q.options.some(o=>o.id==='0')?'0':'done') : null)
  assert.equal(s.investigators[0].damage,0)
  assert.equal(s.investigators[1].damage,2)
  assert.equal(s.investigators[0].resources,30)
  assert.equal(s.investigators[1].resources,27)
  assert.equal(s.lastTestResult.seat,0)
  assert.equal(s.investigators[1].hand.length,2)
})

test('TDE completion: Versatile increases deck size and grants exactly one additional level zero class card per copy', () => {
  const inv={code:'test',klass:'guardian',deckRequirements:{size:2},deckOptions:[{factions:['guardian','neutral'],level:{min:0,max:5}}]}
  const cards={'06167':ALL_CARDS['06167']}
  for(let i=0;i<12;i++) cards[`g${i}`]={code:`g${i}`,name:`g${i}`,type:'event',klass:'guardian',xp:0}
  cards.s={code:'s',name:'s',type:'event',klass:'seeker',xp:0}
  cards.r={code:'r',name:'r',type:'event',klass:'rogue',xp:0}
  const one=['06167',...Array.from({length:6},(_,i)=>`g${i}`),'s']
  assert.deepEqual(validateDeckRules(inv,one,cards).errors,[])
  assert.ok(validateDeckRules(inv,[...one.slice(0,-2),'s','r'],cards).errors.length)
  const two=['06167','06167',...Array.from({length:10},(_,i)=>`g${i}`),'s','r']
  assert.deepEqual(validateDeckRules(inv,two,cards).errors,[])
})

test('TDE completion: Abigail preserves the attached Tome instance and repeats its effect without repaying costs', () => {
  const s=fixture(), book=asset(s,'01031',{uses:3,damage:1}), abigail=asset(s,'06324')
  const before=JSON.parse(JSON.stringify(book))
  run(s,current=>engine.playerWindow(current,'test.beforeCommit',[],0),q=>q.kind==='playerWindow'
    ?q.options.find(o=>o.targetId===book.id)?.id:null)
  const attached=s.investigators[0].assets.find(a=>a.id===book.id)
  assert.equal(attached.attachedToAsset,abigail.id)
  assert.equal(attached.uses,before.uses);assert.equal(attached.damage,before.damage)
  const hand=s.investigators[0].hand.length, actions=s.investigators[0].actionsLeft
  move(s,{action:'ability',assetId:book.id,abilityIndex:0})
  settle(s,q=>q.kind==='reaction'?q.options.find(o=>String(o.id).includes('06324'))?.id:null)
  assert.equal(s.investigators[0].hand.length,hand+2)
  assert.equal(s.investigators[0].actionsLeft,actions-1)
  assert.ok(s.investigators[0].assets.find(a=>a.id===book.id).exhausted)
  assert.ok(s.investigators[0].assets.find(a=>a.id===abigail.id).exhausted)
})
