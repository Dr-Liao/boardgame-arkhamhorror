import { chapterFixture } from './tic-chapter-fixture.mjs'
// Main copies this source to Mod/tests and supplies its real chapter fixture.
// Contract: lateFixture(scenarioId, count=1, campaignOptions={}) returns a settled
// production game state, applying memoriesRecovered/records BEFORE real setup.
// Card registration/index building and execution belong exclusively to main.
import test from 'node:test'
import assert from 'node:assert/strict'
import { enemy, move, settle, asset } from './core-fixture.mjs'
import { drawEncounter, drawCards, enemyPhase, enemyHealth, performTest, revealLocation, legalMoves, validateMove, scenarioRuntime } from '../src/engine/engine.js'
import { resolveTransaction } from '../src/engine/resolution.js'
import { createMechanicsApi } from '../src/engine/api-mechanics.js'
import { keysAt } from '../src/engine/scenario-keys.js'
import { viewState } from '../src/integration/observation.js'
import { registerCardAbilities } from '../src/engine/ability.js'
import { ALL_CARDS } from '../src/cards/cards-data.js'

const json = value => JSON.parse(JSON.stringify(value))
function transaction(state, execute, select = () => null) {
  const run=draft=>{try{return execute(draft)}catch(error){if(error.constructor?.name!=='ScenarioEnded')throw error}}
  resolveTransaction(state, 0, { action: 'lateCardTest' }, run)
  for (let guard=0;state.pendingChoice;guard++) {
    assert.ok(guard<100, `choice loop ${state.pendingChoice.source}`)
    const choice=state.pendingChoice
    const id=select(choice,state)??['done','skip','self'].find(id=>choice.options.some(option=>option.id===id))??choice.options[0]?.id
    resolveTransaction(state,choice.seat,{action:'choose',choiceId:choice.id,optionId:id},run)
  }
}

// Main calls this only after Flashback12/13 handlers, atomic key/group costs,
// generic location-attachment abilities and exact next-upkeep dependencies close.
export function registerPendingLateTests(lateFixture) {
  test('TIC 07329: shroud counts keyed Sanctum locations once, key placement damages distant awake Ancient One and shared limit survives JSON',()=>{
    const s=lateFixture('intoTheMaelstrom',2);s.humanSeats=[0,1];s.enemies=[]
    for(const inv of s.investigators)inv.engaged=[]
    const lair=placePrinted(s,'07329');lair.revealed=true
    const sanctums=['07324','07325'].map(code=>placePrinted(s,code))
    s.scenarioFlags.mechanics.keys.blue={holder:`location:${sanctums[0].id}`,revealed:true}
    s.scenarioFlags.mechanics.keys.yellow={holder:`location:${sanctums[0].id}`,revealed:true}
    s.scenarioFlags.mechanics.keys.green={holder:`location:${sanctums[1].id}`,revealed:true}
    assert.equal(scenarioRuntime(s,[]).locationShroud(lair.id,0),4,'two locations have keys although there are three keys')
    s.investigators[0].location=lair.id;s.investigators[1].location=lair.id
    s.scenarioFlags.mechanics.keys.black={holder:'investigator:0',revealed:true}
    const gateway=locationOf(s,'07320');let sleeping,awake
    transaction(s,draft=>{const runtime=scenarioRuntime(draft,[]);sleeping=runtime.spawn('07330a',gateway.id);awake=runtime.spawn('07331b',gateway.id)})
    const command=legalMoves(s).find(command=>command.action==='entityAbility'&&command.entityId===lair.id)
    assert.ok(command);move(s,command);settle(s,choice=>{
      if(choice.source==='07329'){
        assert.equal(choice.options.some(option=>option.id===sleeping.id),false)
        return awake.id
      }
      return null
    })
    assert.equal(keysAt(s,`location:${lair.id}`).includes('black'),true)
    assert.equal(s.enemies.find(enemy=>enemy.id===awake.id).damageTaken,3)
    assert.equal(s.enemies.find(enemy=>enemy.id===sleeping.id).damageTaken,0)
    const restored=json(s);restored.currentSeat=1
    createMechanicsApi(restored).keys.transfer('black',`location:${lair.id}`,'investigator:1')
    assert.equal(legalMoves(restored).some(command=>command.action==='entityAbility'&&command.entityId===lair.id),false)
  })
  test('TIC 07329: sleeping-only and wrong-color key states do not consume cost or action',()=>{
    const s=lateFixture('intoTheMaelstrom');s.enemies=[];s.investigators[0].engaged=[]
    const lair=placePrinted(s,'07329');lair.revealed=true;s.investigators[0].location=lair.id
    const gateway=locationOf(s,'07320')
    transaction(s,draft=>scenarioRuntime(draft,[]).spawn('07330a',gateway.id))
    s.scenarioFlags.mechanics.keys.white={holder:'investigator:0',revealed:true}
    const before=s.investigators[0].actionsLeft
    const forged={action:'entityAbility',entityId:lair.id,abilityIndex:0}
    assert.ok(validateMove(s,0,forged));assert.equal(keysAt(s,'investigator:0').includes('white'),true)
    transaction(s,draft=>scenarioRuntime(draft,[]).spawn('07331b',gateway.id))
    createMechanicsApi(s).keys.transfer('white','investigator:0','setAside')
    s.scenarioFlags.mechanics.keys.blue={holder:'investigator:0',revealed:true}
    assert.ok(validateMove(s,0,forged));assert.equal(s.investigators[0].actionsLeft,before)
    assert.equal(keysAt(s,'investigator:0').includes('blue'),true)
  })
  for(const [code,color] of [['07324','blue'],['07325','green'],['07326','red'],['07327','yellow']]){
    test(`TIC ${code}: actual local team key+clue cost automatically evades distant Ancient Ones, permanently drains only source and limits whole group`,()=>{
      const s=lateFixture('intoTheMaelstrom',2);s.humanSeats=[0,1];s.enemies=[]
      for(const inv of s.investigators){inv.engaged=[];inv.clues=1}
      const sanctum=placePrinted(s,code);sanctum.revealed=true
      for(const inv of s.investigators)inv.location=sanctum.id
      s.scenarioFlags.mechanics.keys[color]={holder:'investigator:0',revealed:true}
      const water=createMechanicsApi(s).water;water.set(sanctum.id,2)
      const gateway=locationOf(s,'07320');assert.ok(gateway)
      let sleeping,awake
      transaction(s,draft=>{
        const runtime=scenarioRuntime(draft,[])
        sleeping=runtime.spawn('07330a',gateway.id);awake=runtime.spawn('07331b',gateway.id)
      })
      assert.ok(sleeping&&awake)
      const command=legalMoves(s).find(command=>command.action==='entityAbility'&&command.entityId===sanctum.id)
      assert.ok(command);move(s,command);settle(s)
      assert.equal(s.investigators.reduce((sum,inv)=>sum+inv.clues,0),0)
      assert.equal(keysAt(s,`location:${sanctum.id}`).includes(color),true)
      for(const id of [sleeping.id,awake.id]){
        const actual=s.enemies.find(enemy=>enemy.id===id);assert.equal(actual.exhausted,true);assert.equal(actual.engagedSeat,null)
      }
      assert.equal(water.level(sanctum.id),0)
      assert.equal(water.change(sanctum.id,1),false)
      assert.equal(water.level(sanctum.id),0)
      const restored=json(s);restored.currentSeat=1;restored.investigators[1].clues=2
      createMechanicsApi(restored).keys.transfer(color,`location:${sanctum.id}`,'investigator:1')
      assert.equal(legalMoves(restored).some(command=>command.action==='entityAbility'&&command.entityId===sanctum.id),false)
      assert.equal(createMechanicsApi(restored).water.canChange(sanctum.id,1),false)
      createMechanicsApi(restored).water.set(gateway.id,0)
      assert.notEqual(createMechanicsApi(restored).water.change(gateway.id,1),false,'other location remains floodable')
    })
    test(`TIC ${code}: remote clues and missing key cannot partially pay a crafted local group activation`,()=>{
      const s=lateFixture('intoTheMaelstrom',2);s.humanSeats=[0,1]
      const sanctum=placePrinted(s,code);sanctum.revealed=true
      s.investigators[0].location=sanctum.id;s.investigators[0].clues=1;s.investigators[1].clues=4
      s.scenarioFlags.mechanics.keys[color]={holder:'investigator:0',revealed:true}
      const before=json({clues:s.investigators.map(inv=>inv.clues),keys:s.scenarioFlags.mechanics.keys,actions:s.investigators[0].actionsLeft})
      const forged={action:'entityAbility',entityId:sanctum.id,abilityIndex:0}
      assert.equal(legalMoves(s).some(command=>command.action==='entityAbility'&&command.entityId===sanctum.id),false)
      assert.ok(validateMove(s,0,forged))
      assert.deepEqual({clues:s.investigators.map(inv=>inv.clues),keys:s.scenarioFlags.mechanics.keys,actions:s.investigators[0].actionsLeft},before)
      s.investigators[1].location=sanctum.id
      createMechanicsApi(s).keys.transfer(color,'investigator:0','setAside')
      assert.equal(legalMoves(s).some(command=>command.action==='entityAbility'&&command.entityId===sanctum.id),false)
      assert.ok(validateMove(s,0,forged))
      assert.deepEqual(s.investigators.map(inv=>inv.clues),before.clues)
    })
  }
  test('TIC 07299: real nearest eligible location attachment blocks movement only while ready, real success exhausts and actual upkeep readies',()=>{
    const s=lateFixture('theLairOfDagon');s.enemies=[];s.investigators[0].engaged=[]
    const locations=s.locations.slice(0,3);assert.equal(locations.length,3)
    for(const location of s.locations)location.connections=[]
    const map=createMechanicsApi(s).map;map.connect(locations[0].id,locations[1].id);map.connect(locations[1].id,locations[2].id)
    s.investigators[0].location=locations[0].id
    for(const location of locations)createMechanicsApi(s).water.set(location.id,0)
    draw(s,'07299')
    const first=s.locations.find(location=>location.id===locations[0].id).attachments.find(card=>card.code==='07299');assert.ok(first)
    assert.equal(first.exhausted,false)
    assert.equal(s.encounterDiscard.includes('07299'),false)
    assert.ok(validateMove(s,0,{action:'move',locationId:locations[1].id}))
    assert.equal(legalMoves(s).some(command=>command.action==='move'&&command.locationId===locations[1].id),false)
    s.chaosBag=['autofail']
    let action=legalMoves(s).find(command=>command.action==='entityAbility'&&command.entityId===first.id)
    assert.ok(action);move(s,action);settle(s,choice=>choice.options.some(option=>option.id==='agility')?'agility':null)
    assert.equal(s.lastTestResult.difficulty,1)
    assert.equal(s.locations.find(location=>location.id===locations[0].id).attachments.find(card=>card.id===first.id).exhausted,false)
    s.investigators[0].agility=9;s.chaosBag=['0']
    action=legalMoves(s).find(command=>command.action==='entityAbility'&&command.entityId===first.id)
    assert.ok(action);move(s,action);settle(s,choice=>choice.options.some(option=>option.id==='agility')?'agility':null)
    assert.equal(s.locations.find(location=>location.id===locations[0].id).attachments.find(card=>card.id===first.id).exhausted,true)
    assert.equal(validateMove(s,0,{action:'move',locationId:locations[1].id}),null)
    draw(s,'07299')
    assert.equal(s.locations.find(location=>location.id===locations[0].id).attachments.filter(card=>card.code==='07299').length,1,'ready status does not make a location eligible for another copy')
    assert.equal(s.locations.find(location=>location.id===locations[1].id).attachments.filter(card=>card.code==='07299').length,1,'next nearest eligible location receives second physical copy')
    const restored=json(s);move(restored,{action:'endTurn'});settle(restored)
    assert.equal(restored.locations.find(location=>location.id===locations[0].id).attachments.find(card=>card.id===first.id).exhausted,false,'actual upkeep readies physical attachment')
    assert.ok(validateMove(restored,0,{action:'move',locationId:locations[1].id}))
    assert.equal(restored.encounterDiscard.includes('07299'),false)
  })
  for(const [code,color,memory,number] of [
    ['07242','white','AConversationWithMrMoore',12],
    ['07248','purple','TheLifecycleOfADeepOne',13],
  ])test(`TIC ${code}: actual Flashback ${number} records memory, removes one permanent symbol, preserves key and group/game limit`,()=>{
    const s=lateFixture('aLightInTheFog',2);s.humanSeats=[0,1]
    const location=placePrinted(s,code);location.revealed=false
    if(code==='07248')createMechanicsApi(s).water.set(location.id,1)
    transaction(s,draft=>revealLocation(draft,location.id,[],1))
    if(code==='07248')assert.equal(createMechanicsApi(s).water.level(location.id),2,'printed increase on reveal, not set-to-partial')
    s.investigators[1].location=location.id;s.currentSeat=1
    assert.equal(legalMoves(s).some(command=>command.action==='entityAbility'&&command.entityId===location.id),false)
    createMechanicsApi(s).keys.transfer(color,'setAside','investigator:1',{reveal:true})
    s.chaosBag=['0','cultist','tablet','elderthing'];s.campaign.chaosBag=[...s.chaosBag]
    const lead=s.campaign.leadSeat??0,before=s.investigators[lead].clues
    const command=legalMoves(s).find(command=>command.action==='entityAbility'&&command.entityId===location.id)
    assert.ok(command);move(s,command);settle(s)
    assert.ok(s.campaign.records.memoriesRecovered.includes(memory))
    const symbols=bag=>bag.filter(face=>['cultist','tablet','elderthing'].includes(face)).length
    assert.equal(symbols(s.chaosBag),2);assert.equal(symbols(s.campaign.chaosBag),2)
    assert.equal(s.investigators[lead].clues,before+(number===12?2:0))
    assert.equal(keysAt(s,'investigator:1').includes(color),true,'flashback condition does not spend key')
    const restored=json(s);restored.currentSeat=0;restored.investigators[0].location=location.id
    createMechanicsApi(restored).keys.transfer(color,'investigator:1','investigator:0')
    assert.equal(legalMoves(restored).some(command=>command.action==='entityAbility'&&command.entityId===location.id),false)
  })
  test('TIC 07322: real remote non-Elite relocation, key placement and exactly one repeated-upkeep ready suppression',()=>{
    const s=lateFixture('intoTheMaelstrom');s.enemies=[];s.investigators[0].engaged=[]
    const vault=placePrinted(s,'07322');vault.revealed=true;s.investigators[0].location=vault.id
    s.scenarioFlags.mechanics.keys.purple={holder:'investigator:0',revealed:true}
    const remote=locationOf(s,'07320');assert.ok(remote)
    const target=enemy(s,{id:'non-elite',location:remote.id,engagedSeat:null}),elite=enemy(s,{id:'elite',location:remote.id,engagedSeat:null,elite:true})
    const command=legalMoves(s).find(command=>command.action==='entityAbility'&&command.entityId===vault.id)
    assert.ok(command);move(s,command)
    settle(s,choice=>{
      if(choice.source==='07322'){
        assert.equal(choice.options.some(option=>option.id===elite.id),false)
        return target.id
      }
      return null
    })
    assert.equal(keysAt(s,`location:${vault.id}`).includes('purple'),true)
    assert.equal(s.enemies.find(enemy=>enemy.id===target.id).location,vault.id)
    assert.equal(s.enemies.find(enemy=>enemy.id===target.id).exhausted,true)
    const watch=asset(s,'02305');let observedFirst=false
    move(s,{action:'endTurn'})
    settle(s,choice=>{
      if(choice.source===watch.id&&s.phase==='upkeep'&&choice.prompt.includes('重复')){
        assert.equal(s.enemies.find(enemy=>enemy.id===target.id).exhausted,true)
        observedFirst=true;return 'trigger'
      }
      return null
    })
    assert.equal(observedFirst,true)
    assert.equal(s.enemies.find(enemy=>enemy.id===target.id).exhausted,false,'second actual upkeep in same round must ready')
    assert.equal(s.removedFromGame.includes('02305'),true)
  })
}
function draw(state, code) {
  state.encounterDeck.push(code)
  transaction(state,draft=>drawEncounter(draft,draft.investigators[0],[]))
}
const locationOf=(state,code)=>state.locations.find(location=>(location.originalCode||location.code)===code)
function placePrinted(state,code){
  const existing=locationOf(state,code);if(existing)return existing
  const definition=Object.entries(state.scenario.locations).find(([,location])=>(location.originalCode||location.code)===code)
  assert.ok(definition,`chapter has no physical definition for ${code}`)
  scenarioRuntime(state,[]).place(definition[0])
  const result=locationOf(state,code);assert.ok(result);return result
}

export function registerLateTests(lateFixture) {
  for(const [code,lairCode] of [['07333','07328'],['07334','07329']]){
    test(`TIC ${code}: real encounter draw spawns at farther physical Lair/Gateway measured from drawer1, not lead0`,()=>{
      const s=lateFixture('intoTheMaelstrom',2);s.humanSeats=[0,1];s.enemies=[]
      for(const inv of s.investigators){inv.assets=[];inv.hand=[];inv.engaged=[]}
      const lair=placePrinted(s,lairCode),gateway=locationOf(s,'07320')
      const middle=s.locations.find(location=>![lair.id,gateway.id].includes(location.id));assert.ok(middle)
      for(const location of s.locations)location.connections=[]
      const map=createMechanicsApi(s).map;map.connect(gateway.id,middle.id);map.connect(middle.id,lair.id)
      s.investigators[0].location=lair.id;s.investigators[1].location=gateway.id;s.encounterDeck=[code]
      transaction(s,draft=>drawEncounter(draft,draft.investigators[1],[]))
      const brood=s.enemies.find(enemy=>(enemy.originalCode||enemy.code)===code);assert.ok(brood)
      assert.equal(brood.location,lair.id);assert.equal(brood.engagedSeat,0)
      assert.equal(s.encounterDiscard.includes(code),false)
      assert.equal(s.enemies.filter(enemy=>(enemy.originalCode||enemy.code)===code).length,1)
    })
    test(`TIC ${code}: actual drawer resolves tied farthest spawn after pending-choice JSON without duplicate physical enemy`,()=>{
      const s=lateFixture('intoTheMaelstrom',2);s.humanSeats=[0,1];s.enemies=[]
      for(const inv of s.investigators){inv.assets=[];inv.hand=[];inv.engaged=[]}
      const lair=placePrinted(s,lairCode),gateway=locationOf(s,'07320')
      const middle=s.locations.find(location=>![lair.id,gateway.id].includes(location.id));assert.ok(middle)
      for(const location of s.locations)location.connections=[]
      const map=createMechanicsApi(s).map;map.connect(gateway.id,middle.id);map.connect(middle.id,lair.id)
      s.investigators[0].location=gateway.id;s.investigators[1].location=middle.id;s.encounterDeck=[code]
      const run=draft=>drawEncounter(draft,draft.investigators[1],[])
      resolveTransaction(s,1,{action:'lateBroodDraw'},run)
      assert.ok(s.pendingChoice);assert.equal(s.pendingChoice.seat,1)
      assert.deepEqual(s.pendingChoice.options.map(option=>option.id).sort(),[lair.id,gateway.id].sort())
      const restored=json(s),choice=restored.pendingChoice
      resolveTransaction(restored,choice.seat,{action:'choose',choiceId:choice.id,optionId:lair.id},run)
      assert.equal(restored.pendingChoice,null)
      const brood=restored.enemies.find(enemy=>(enemy.originalCode||enemy.code)===code);assert.ok(brood)
      assert.equal(brood.location,lair.id)
      assert.equal(restored.enemies.filter(enemy=>(enemy.originalCode||enemy.code)===code).length,1)
      assert.equal(restored.encounterDeck.includes(code),false)
    })
  }
  test('TIC draw capability regression: actual Narcolepsy forbids basic draw but another investigator Dawson can still give a real card draw',()=>{
    const s=lateFixture('theLairOfDagon',2);s.humanSeats=[0,1];s.enemies=[]
    for(const inv of s.investigators){inv.assets=[];inv.engaged=[];inv.hand=[]}
    s.investigators[1].location=s.investigators[0].location;s.investigators[1].deck=['01088','06037']
    transaction(s,draft=>drawCards(draft,draft.investigators[1],1,[]))
    assert.ok(s.investigators[1].threat.some(card=>card.code==='06037'))
    s.currentSeat=1;assert.equal(legalMoves(s).some(command=>command.action==='draw'),false);s.currentSeat=0
    const dawson=asset(s,'07082'),attacker=enemy(s,{engagedSeat:1,damage:0,horror:0})
    transaction(s,draft=>scenarioRuntime(draft,[]).attack(draft.enemies.find(enemy=>enemy.id===attacker.id),draft.investigators[1]),choice=>
      choice.options.find(option=>option.cardCode==='07082'&&option.id.startsWith('desc:'))?.id??null)
    assert.deepEqual(s.investigators[1].hand,['01088'])
    assert.ok(s.investigators[1].threat.some(card=>card.code==='06037'),'zero-harm attack does not wake the sleeping investigator')
    assert.equal(s.investigators[0].assets.find(asset=>asset.id===dawson.id).exhausted,true)
  })
  test('TIC 07283: newly placed Cave gains real bidirectional Grand Entryway connection, while local team pays purple key and 3n clues',()=>{
    const s=lateFixture('theLairOfDagon',3);s.humanSeats=[0,1,2]
    const grand=placePrinted(s,'07283')
    transaction(s,draft=>revealLocation(draft,grand.id,[],0))
    const cave=placePrinted(s,'07291')
    assert.equal(s.locations.find(location=>location.id===grand.id).connections.includes(cave.id),true)
    assert.equal(s.locations.find(location=>location.id===cave.id).connections.includes(grand.id),true)
    s.investigators[0].location=grand.id;s.investigators[1].location=grand.id;s.investigators[2].location=cave.id
    s.investigators[0].clues=4;s.investigators[1].clues=5;s.investigators[2].clues=0
    s.scenarioFlags.mechanics.keys.purple={holder:'investigator:1',revealed:true}
    const command=legalMoves(s).find(command=>command.action==='entityAbility'&&command.entityId===grand.id&&command.abilityIndex===1)
    assert.ok(command);move(s,command);settle(s)
    assert.equal(s.investigators.reduce((sum,inv)=>sum+inv.clues,0),0)
    assert.equal(keysAt(s,'reference').includes('purple'),true)
    assert.ok(s.scenarioFlags.remembered.includes('UnlockedTheEntranceToTheCaves'))
    const restored=json(s);restored.currentSeat=2
    assert.equal(validateMove(restored,2,{action:'move',locationId:grand.id}),null,'actual movement uses the new Cave edge after JSON')
  })
  test('TIC 07283: actual resign descriptor resigns only acting investigator',()=>{
    const s=lateFixture('theLairOfDagon',2);s.humanSeats=[0,1]
    const grand=placePrinted(s,'07283');transaction(s,draft=>revealLocation(draft,grand.id,[],0));s.investigators[0].location=grand.id
    const command=legalMoves(s).find(command=>command.action==='entityAbility'&&command.entityId===grand.id&&command.abilityIndex===0)
    assert.ok(command);move(s,command);settle(s)
    assert.equal(s.investigators[0].resigned,true);assert.equal(s.investigators[1].resigned,false)
  })
  test('TIC 07324: actual failed investigation damages only performer; unrelated failure and successful investigation do not',()=>{
    const s=lateFixture('intoTheMaelstrom',2);s.humanSeats=[0,1];s.enemies=[]
    for(const inv of s.investigators){inv.assets=[];inv.engaged=[];inv.damage=0}
    const statues=placePrinted(s,'07324')
    transaction(s,draft=>revealLocation(draft,statues.id,[],1))
    s.currentSeat=1;s.investigators[1].location=statues.id;s.investigators[0].location=statues.id;s.chaosBag=['autofail']
    let command=legalMoves(s).find(command=>command.action==='investigate')
    assert.ok(command);move(s,command);settle(s)
    assert.equal(s.investigators[1].damage,1);assert.equal(s.investigators[0].damage,0)
    transaction(s,draft=>performTest(draft,1,'willpower',8,{resolve:()=>{}}))
    assert.equal(s.investigators[1].damage,1,'failure outside investigation does not trigger')
    s.investigators[1].intellect=9;s.chaosBag=['0']
    command=legalMoves(s).find(command=>command.action==='investigate');assert.ok(command);move(s,command);settle(s)
    assert.equal(s.investigators[1].damage,1)
    assert.equal(s.investigators[1].clues,1)
  })
  test('TIC 07325: actual enemy fight modifier applies only to local Deep One enemies at revealed Temple',()=>{
    const s=lateFixture('intoTheMaelstrom');s.enemies=[];s.investigators[0].engaged=[]
    const temple=placePrinted(s,'07325');temple.revealed=true
    const remote=locationOf(s,'07320'),local=enemy(s,{location:temple.id,engagedSeat:null,traits:['Deep One'],fight:3})
    const other=enemy(s,{location:temple.id,engagedSeat:null,traits:['Humanoid'],fight:3})
    const distant=enemy(s,{location:remote.id,engagedSeat:null,traits:['Deep One'],fight:3})
    assert.equal(scenarioRuntime(s,[]).enemyFight(local,0),5)
    assert.equal(scenarioRuntime(s,[]).enemyFight(other,0),3)
    assert.equal(scenarioRuntime(s,[]).enemyFight(distant,0),3)
    temple.revealed=false;assert.equal(scenarioRuntime(s,[]).enemyFight(local,0),3)
  })
  test('TIC 07326: actual remote flood increase harms each local investigator once; decreases, capped no-op and remote investigators do not',()=>{
    const s=lateFixture('intoTheMaelstrom',3);s.humanSeats=[0,1,2]
    const chamber=placePrinted(s,'07326');chamber.revealed=true
    const gateway=locationOf(s,'07320')
    for(const inv of s.investigators){inv.assets=[];inv.horror=0;inv.location=inv.seat===2?gateway.id:chamber.id}
    createMechanicsApi(s).water.set(gateway.id,0)
    transaction(s,draft=>{
      const water=scenarioRuntime(draft,[]).mechanics.water
      water.change(gateway.id,1);water.change(gateway.id,-1);water.change(gateway.id,1)
    })
    assert.deepEqual(s.investigators.map(inv=>inv.horror),[2,2,0],'two real increases within one action are distinct windows')
    transaction(s,draft=>scenarioRuntime(draft,[]).mechanics.water.change(gateway.id,-1))
    assert.deepEqual(s.investigators.map(inv=>inv.horror),[2,2,0])
    createMechanicsApi(s).water.set(gateway.id,2)
    transaction(s,draft=>scenarioRuntime(draft,[]).mechanics.water.change(gateway.id,1))
    assert.deepEqual(s.investigators.map(inv=>inv.horror),[2,2,0])
    assert.deepEqual(json(s).investigators.map(inv=>inv.horror),[2,2,0])
  })
  test('TIC 07286: real black-key action remembers global third-floor unlock, opens unrevealed Hall of Silence for teammate and survives JSON',()=>{
    const s=lateFixture('theLairOfDagon',2);s.humanSeats=[0,1]
    const corridor=placePrinted(s,'07286'),silence=placePrinted(s,'07289');corridor.revealed=true;silence.revealed=false
    const origin=s.investigators[0].location;createMechanicsApi(s).map.connect(origin,silence.id)
    s.currentSeat=0
    const enter={action:'move',locationId:silence.id};assert.ok(validateMove(s,0,enter))
    s.currentSeat=1;s.investigators[1].location=corridor.id
    s.scenarioFlags.remembered=['ExistingFact']
    s.scenarioFlags.mechanics.keys.black={holder:'investigator:1',revealed:true}
    const command=legalMoves(s).find(command=>command.action==='entityAbility'&&command.entityId===corridor.id)
    assert.ok(command);move(s,command);settle(s)
    assert.deepEqual(s.scenarioFlags.remembered,['ExistingFact','UnlockedTheThirdFloor'])
    assert.equal(keysAt(s,'reference').includes('black'),true)
    const restored=json(s);restored.currentSeat=0
    assert.equal(validateMove(restored,0,enter),null,'teammate also benefits from shared remembered fact')
    restored.currentSeat=1;createMechanicsApi(restored).keys.transfer('black','reference','investigator:1')
    assert.equal(legalMoves(restored).some(command=>command.action==='entityAbility'&&command.entityId===corridor.id),false,'remembered fact cannot be needlessly bought twice')
  })
  test('TIC 07290: actual revealer chooses only tied maximum-clue locations for green key',()=>{
    const s=lateFixture('theLairOfDagon',2);s.humanSeats=[0,1]
    const doorway=placePrinted(s,'07290');doorway.revealed=false
    for(const location of s.locations)location.clues=0
    const tied=s.locations.filter(location=>location.id!==doorway.id).slice(0,2);assert.equal(tied.length,2)
    for(const location of tied)location.clues=4
    transaction(s,draft=>revealLocation(draft,doorway.id,[],1),choice=>{
      if(choice.source!=='07290')return null
      assert.equal(choice.seat,1);assert.deepEqual(choice.options.map(option=>option.id).sort(),tied.map(location=>location.id).sort())
      return tied[1].id
    })
    assert.equal(keysAt(s,`location:${tied[1].id}`).includes('green'),true)
    assert.equal(keysAt(s,`location:${tied[0].id}`).includes('green'),false)
    assert.equal(keysAt(s,`location:${doorway.id}`).includes('green'),false)
  })
  test('TIC 07290: local teammate green key and distributed six-clue cost unlock final depths; remote key rejects whole crafted cost',()=>{
    const s=lateFixture('theLairOfDagon',2);s.humanSeats=[0,1]
    const doorway=placePrinted(s,'07290');doorway.revealed=true;s.investigators[0].location=doorway.id
    s.investigators[0].clues=6;s.investigators[1].clues=0
    s.scenarioFlags.mechanics.keys.green={holder:'investigator:1',revealed:true}
    const forged={action:'entityAbility',entityId:doorway.id,abilityIndex:0}
    assert.ok(validateMove(s,0,forged));assert.equal(s.investigators[0].clues,6)
    assert.equal(keysAt(s,'investigator:1').includes('green'),true)
    s.investigators[1].location=doorway.id;s.investigators[0].clues=5;s.investigators[1].clues=1
    const command=legalMoves(s).find(command=>command.action==='entityAbility'&&command.entityId===doorway.id)
    assert.ok(command);move(s,command);settle(s)
    assert.equal(s.investigators.reduce((sum,inv)=>sum+inv.clues,0),0)
    assert.equal(keysAt(s,'reference').includes('green'),true)
    assert.ok(s.scenarioFlags.remembered.includes('UnlockedTheFinalDepths'))
    assert.deepEqual(json(s).scenarioFlags.remembered,s.scenarioFlags.remembered)
  })
  test('TIC 07285: actual reveal increases water; actor spends red key once and controls physical cursed Statue from set-aside',()=>{
    const s=lateFixture('theLairOfDagon',2);s.humanSeats=[0,1]
    const hall=placePrinted(s,'07285');hall.revealed=false
    createMechanicsApi(s).water.set(hall.id,1)
    transaction(s,draft=>revealLocation(draft,hall.id,[],1))
    assert.equal(createMechanicsApi(s).water.level(hall.id),2)
    s.currentSeat=1;s.investigators[1].location=hall.id
    s.scenarioFlags.mechanics.keys.red={holder:'investigator:1',revealed:true}
    assert.ok(s.scenarioZones.setAside.includes('07300'))
    const before=s.investigators[1].actionsLeft
    const command=legalMoves(s).find(command=>command.action==='entityAbility'&&command.entityId===hall.id)
    assert.ok(command);move(s,command);settle(s)
    assert.equal(s.investigators[1].actionsLeft,before-1)
    assert.equal(keysAt(s,'reference').includes('red'),true)
    assert.equal(s.investigators[1].assets.filter(asset=>asset.code==='07300').length,1)
    assert.equal(s.investigators[0].assets.some(asset=>asset.code==='07300'),false)
    assert.equal(s.scenarioZones.setAside.includes('07300'),false)
    createMechanicsApi(s).keys.transfer('red','reference','investigator:1')
    assert.equal(legalMoves(s).some(command=>command.action==='entityAbility'&&command.entityId===hall.id),false,'no second physical Statue exists')
    assert.deepEqual(json(s).investigators[1].assets,s.investigators[1].assets)
  })
  test('TIC 07287: printed fast ability chooses three distinct effects, heals damage with no horror and pays exactly one chosen key',()=>{
    const s=lateFixture('theLairOfDagon');s.enemies=[];s.investigators[0].engaged=[]
    const hall=placePrinted(s,'07287');hall.revealed=true;s.investigators[0].location=hall.id
    s.investigators[0].damage=2;s.investigators[0].horror=0;s.investigators[0].deck=['01088','01090','01091']
    s.scenarioFlags.mechanics.keys.blue={holder:'investigator:0',revealed:true}
    const inv=s.investigators[0],before={actions:inv.actionsLeft,resources:inv.resources,hand:inv.hand.length}
    const command=legalMoves(s).find(command=>command.action==='entityAbility'&&command.entityId===hall.id)
    assert.ok(command);move(s,command)
    const selected=new Set()
    settle(s,choice=>{
      if(choice.source!=='07287')return null
      for(const prior of selected)assert.equal(choice.options.some(option=>option.id===prior),false)
      const id=['heal','draw','resources'].find(id=>!selected.has(id)&&choice.options.some(option=>option.id===id))
      assert.ok(id);selected.add(id);return id
    })
    assert.equal(s.investigators[0].actionsLeft,before.actions,'printed fast icon costs no action')
    assert.equal(s.investigators[0].damage,1);assert.equal(s.investigators[0].horror,0)
    assert.equal(s.investigators[0].hand.length,before.hand+2)
    assert.equal(s.investigators[0].resources,before.resources+3)
    assert.equal(keysAt(s,'reference').includes('blue'),true)
    assert.equal(createMechanicsApi(s).chaosTokens.count('bless'),0)
  })
  test('TIC 07287: bless pool cap and all-gain/draw restrictions leave only actual legal distinct effects',()=>{
    const s=lateFixture('theLairOfDagon');s.enemies=[];s.investigators[0].engaged=[]
    const hall=placePrinted(s,'07287');hall.revealed=true;s.investigators[0].location=hall.id
    s.scenarioFlags.mechanics.keys.yellow={holder:'investigator:0',revealed:true}
    s.investigators[0].damage=1
    transaction(s,draft=>scenarioRuntime(draft,[]).threat(0,'07257'))
    const tokens=createMechanicsApi(s).chaosTokens;tokens.add('bless',9)
    const before={resources:s.investigators[0].resources,hand:s.investigators[0].hand.length}
    const command=legalMoves(s).find(command=>command.action==='entityAbility'&&command.entityId===hall.id)
    assert.ok(command);move(s,command);settle(s,choice=>{
      if(choice.source==='07287'){
        assert.equal(choice.options.some(option=>['draw','resources'].includes(option.id)),false)
        return choice.options.some(option=>option.id==='bless')?'bless':null
      }
      return null
    })
    assert.equal(tokens.count('bless'),10);assert.equal(s.investigators[0].damage,0)
    assert.deepEqual({resources:s.investigators[0].resources,hand:s.investigators[0].hand.length},before)
    createMechanicsApi(s).keys.transfer('yellow','reference','investigator:0')
    assert.equal(legalMoves(s).some(command=>command.action==='entityAbility'&&command.entityId===hall.id),false,'all four effects unavailable cannot spend another key')
  })
  test('TIC 07319: each physical Dark Abyss takes one hidden set-aside key without leaking its color',()=>{
    const s=lateFixture('intoTheMaelstrom',2);s.humanSeats=[0,1]
    const abysses=s.locations.filter(location=>(location.originalCode||location.code)==='07319')
    assert.equal(abysses.length,2)
    const hidden=()=>Object.values(s.scenarioFlags.mechanics.keys).filter(key=>key.holder==='setAside'&&!key.revealed).length
    const before=hidden()
    for(const abyss of abysses){
      transaction(s,draft=>revealLocation(draft,abyss.id,[],0))
      assert.deepEqual(keysAt(s,`location:${abyss.id}`),['unrevealed'])
      for(const seat of [0,1]){
        const projected=viewState(s,seat).mechanics.keys.filter(key=>key.holder===`location:${abyss.id}`)
        assert.deepEqual(projected,[{holder:`location:${abyss.id}`,color:'unrevealed'}])
      }
    }
    assert.equal(hidden(),before-2)
    const restored=json(s)
    assert.deepEqual(restored.scenarioFlags.mechanics.keys,s.scenarioFlags.mechanics.keys)
    transaction(restored,draft=>revealLocation(draft,abysses[0].id,[],0))
    assert.equal(Object.values(restored.scenarioFlags.mechanics.keys).filter(key=>key.holder===`location:${abysses[0].id}`).length,1,'already revealed is not revealed again')
  })
  test('TIC 07319: actual last clue discovery floods only this physical Abyss and its connected locations, respecting locks',()=>{
    const s=lateFixture('intoTheMaelstrom',2)
    const abyss=s.locations.find(location=>(location.originalCode||location.code)==='07319');assert.ok(abyss)
    transaction(s,draft=>revealLocation(draft,abyss.id,[],0))
    const connections=[...abyss.connections];assert.ok(connections.length>=2)
    const water=createMechanicsApi(s).water
    water.set(abyss.id,0)
    for(const id of connections)water.set(id,0)
    const locked=connections[0];water.lock(locked)
    const untouched=s.locations.find(location=>location.id!==abyss.id&&!connections.includes(location.id));assert.ok(untouched)
    water.set(untouched.id,0)
    s.investigators[0].location=abyss.id
    assert.equal(s.locations.find(location=>location.id===abyss.id).clues,2)
    transaction(s,draft=>scenarioRuntime(draft,[]).discoverClue(0,1,abyss.id))
    assert.equal(water.level(abyss.id),0,'non-final clue must not trigger')
    transaction(s,draft=>scenarioRuntime(draft,[]).discoverClue(0,1,abyss.id))
    assert.equal(water.level(abyss.id),2)
    assert.equal(water.level(locked),0,'permanent unflood lock is authoritative')
    for(const id of connections.slice(1))assert.equal(water.level(id),1)
    assert.equal(water.level(untouched.id),0)
    assert.equal(s.investigators[0].clues,2)
    assert.deepEqual(json(s).scenarioFlags.mechanics,s.scenarioFlags.mechanics)
  })
  test('TIC 07279: real final agenda back defeats non-resigned investigators, adds exactly printed mental trauma and records awakening once',()=>{
    const s=lateFixture('theLairOfDagon',2);s.humanSeats=[0,1]
    transaction(s,draft=>scenarioRuntime(draft,[]).resign(1))
    const before=s.investigators.map(inv=>s.campaign.trauma[inv.seat].mental),results=s.campaign.scenarioResults.length
    s.agendaIndex=2
    transaction(s,draft=>scenarioRuntime(draft,[]).advanceAgenda())
    assert.equal(s.investigators[0].defeated,true);assert.equal(s.investigators[1].resigned,true)
    assert.equal(s.campaign.trauma[0].mental,before[0]+1)
    assert.equal(s.campaign.trauma[1].mental,before[1])
    assert.equal(s.campaign.records.DagonHasAwakened,true)
    assert.equal(s.campaign.scenarioResults.length,results+1)
    assert.equal(s.pendingChoice,null)
  })
  test('TIC 07244: real movement honors blue key only while basement is unrevealed',()=>{
    const s=lateFixture('aLightInTheFog'),upper=placePrinted(s,'07244'),from=s.investigators[0].location
    createMechanicsApi(s).map.connect(from,upper.id);upper.revealed=false
    const command={action:'move',locationId:upper.id}
    assert.notEqual(validateMove(s,0,command),null)
    s.scenarioFlags.mechanics.keys.blue={holder:'investigator:0',revealed:true}
    assert.equal(validateMove(s,0,command),null);move(s,command);settle(s)
    assert.equal(locationOf(s,'07244').revealed,true)
    createMechanicsApi(s).keys.transfer('blue','investigator:0','setAside')
    transaction(s,draft=>scenarioRuntime(draft,[]).moveInvestigator(0,from))
    assert.equal(validateMove(s,0,command),null,'revealed side no longer requires blue key')
  })
  test('TIC 07289: actual unrevealed lock reads shared remembered token, reveal places purple; local failure adds one curse',()=>{
    const s=lateFixture('theLairOfDagon'),hall=locationOf(s,'07289');assert.ok(hall);hall.revealed=false
    createMechanicsApi(s).map.connect(s.investigators[0].location,hall.id)
    const command={action:'move',locationId:hall.id};assert.notEqual(validateMove(s,0,command),null)
    scenarioRuntime(s,[]).setScenarioFlag('remembered',['UnlockedTheThirdFloor'])
    assert.equal(validateMove(s,0,command),null);move(s,command);settle(s)
    assert.equal(keysAt(s,`location:${hall.id}`).includes('purple'),true)
    s.chaosBag=['0'];s.investigators[0].intellect=0
    transaction(s,draft=>performTest(draft,0,'intellect',3,{resolve:()=>{}}))
    assert.equal(createMechanicsApi(s).chaosTokens.count('curse'),1)
    const remote=s.locations.find(location=>location.id!==hall.id);assert.ok(remote)
    s.investigators[0].location=remote.id;s.chaosBag=['0']
    transaction(s,draft=>performTest(draft,0,'intellect',3,{resolve:()=>{}}))
    assert.equal(createMechanicsApi(s).chaosTokens.count('curse'),0,'remote failed test adds no curse')
  })
  for(const token of ['0','autofail'])test(`TIC 07292b: actual ${token} failure readies Dagon and attacks only performer once, with real teammate commitment`,()=>{
    const s=lateFixture('theLairOfDagon',2);s.humanSeats=[0,1];s.enemies=[]
    for(const inv of s.investigators){inv.assets=[];inv.engaged=[];inv.damage=0;inv.horror=0}
    const from=s.investigators[0].location;s.investigators[1].location=from
    const dagon=scenarioRuntime(s,[]).spawn('07292b',from);assert.ok(dagon)
    assert.equal(enemyHealth(s,dagon),18,'6 printed health plus6 per investigator')
    scenarioRuntime(s,[]).exhaustEnemy(dagon)
    s.chaosBag=[token];s.investigators[0].intellect=0;s.investigators[1].hand=['01090']
    let asked=false
    transaction(s,draft=>performTest(draft,0,'intellect',9,{resolve:()=>{}}),choice=>{
      if(choice.kind==='commit'&&choice.seat===0&&!asked&&choice.options.some(option=>option.id==='help')){asked=true;return 'help'}
      if(choice.kind==='commit'&&choice.seat===1&&choice.options.some(option=>option.id==='0'))return '0'
      return null
    })
    assert.equal(asked,true);assert.equal(s.investigators[1].discard.includes('01090'),true)
    assert.equal(s.investigators[0].damage,2);assert.equal(s.investigators[0].horror,3)
    assert.equal(s.investigators[1].damage,0);assert.equal(s.investigators[1].horror,0)
    assert.equal(s.enemies.find(enemy=>enemy.id===dagon.id).exhausted,false)
  })
  test('TIC 07292b: success and remote failure do not ready or attack',()=>{
    const s=lateFixture('theLairOfDagon',2);const here=s.investigators[0].location
    const dagon=scenarioRuntime(s,[]).spawn('07292b',here);scenarioRuntime(s,[]).exhaustEnemy(dagon)
    s.investigators[0].intellect=9;s.chaosBag=['0']
    transaction(s,draft=>performTest(draft,0,'intellect',1,{resolve:()=>{}}))
    const remote=s.locations.find(location=>location.id!==here);assert.ok(remote);s.investigators[1].location=remote.id
    s.chaosBag=['autofail'];transaction(s,draft=>performTest(draft,1,'intellect',9,{resolve:()=>{}}))
    assert.equal(s.enemies.find(enemy=>enemy.id===dagon.id).exhausted,true)
    assert.equal(s.investigators[0].damage,0);assert.equal(s.investigators[1].damage,0)
  })
  for(const thirdFloorInPlay of [true,false])test(`TIC 07276: removes bag curses; jailbreak Suspect spawns exhausted at ${thirdFloorInPlay?'Third Floor':'Grand Entryway'} without blue key`,()=>{
    const s=lateFixture('theLairOfDagon');assert.equal(s.agendas[0].originalCode||s.agendas[0].code,'07276')
    // Isolate this agenda's card instructions after genuine chapter setup.
    // Setup integration for the circled Suspect is separately owned by main.
    createMechanicsApi(s).recordSets.add('memoriesRecovered','AJailbreak')
    s.scenarioZones.setAside.push('07078')
    const third=locationOf(s,'07289'),grand=locationOf(s,'07283');assert.ok(third&&grand)
    if(!thirdFloorInPlay)scenarioRuntime(s,[]).removeLocationFromGame(third.id)
    s.chaosBag=['0'];createMechanicsApi(s).chaosTokens.add('curse',4)
    const deck=[...s.encounterDeck]
    transaction(s,draft=>scenarioRuntime(draft,[]).advanceAgenda())
    assert.equal(createMechanicsApi(s).chaosTokens.count('curse'),2)
    const suspect=s.enemies.find(enemy=>(enemy.originalCode||enemy.code)==='07078')
    assert.ok(suspect);assert.equal(suspect.exhausted,true)
    assert.equal(suspect.location,thirdFloorInPlay?third.id:grand.id)
    assert.equal(suspect.engagedSeat,null)
    assert.equal(keysAt(s,`enemy:${suspect.id}`).includes('blue'),false)
    assert.equal(s.scenarioZones.setAside.includes('07078'),false)
    assert.deepEqual(s.encounterDeck,deck)
    assert.deepEqual(json(s).scenarioFlags.mechanics,s.scenarioFlags.mechanics)
  })
  test('TIC 07276: no jailbreak does not spawn a Suspect; zero curse supply does not create tokens',()=>{
    const s=lateFixture('theLairOfDagon');s.chaosBag=['0'];s.scenarioZones.setAside.push('07078')
    transaction(s,draft=>scenarioRuntime(draft,[]).advanceAgenda())
    assert.equal(s.enemies.some(enemy=>(enemy.originalCode||enemy.code)==='07078'),false)
    assert.equal(s.scenarioZones.setAside.includes('07078'),true)
    assert.equal(createMechanicsApi(s).chaosTokens.count('curse'),0)
  })
  test('TIC 07288: actor who actually reveals Hall of Rebirth draws the physical set-aside Apostle once',()=>{
    const s=lateFixture('theLairOfDagon',2);s.humanSeats=[0,1]
    const hall=locationOf(s,'07288');assert.ok(hall);hall.revealed=false;s.investigators[1].location=hall.id
    const deck=[...s.encounterDeck]
    assert.equal(s.scenarioZones.setAside.filter(code=>code==='07293').length,1)
    transaction(s,draft=>revealLocation(draft,hall.id,[],1))
    const apostles=s.enemies.filter(enemy=>(enemy.originalCode||enemy.code)==='07293')
    assert.equal(apostles.length,1);assert.equal(apostles[0].engagedSeat,1)
    assert.equal(s.scenarioZones.setAside.includes('07293'),false)
    assert.deepEqual(s.encounterDeck,deck,'draw chosen set-aside card, not arbitrary current top card')
    transaction(s,draft=>revealLocation(draft,hall.id,[],1))
    assert.equal(s.enemies.filter(enemy=>(enemy.originalCode||enemy.code)==='07293').length,1)
  })
  test('TIC 07312: real agenda back transfers reserved enemies and all discard into the encounter deck exactly once',()=>{
    const s=lateFixture('intoTheMaelstrom');s.agendaIndex=0
    assert.equal(s.scenarioZones.setAside.includes('07086'),true)
    assert.equal(s.scenarioZones.setAside.includes('07332'),true)
    s.encounterDeck=['07333'];s.encounterDiscard=['07335','07336']
    transaction(s,draft=>scenarioRuntime(draft,[]).advanceAgenda())
    assert.equal(s.agendaIndex,1);assert.deepEqual(s.encounterDiscard,[])
    assert.deepEqual([...s.encounterDeck].sort(),['07086','07332','07333','07335','07336'].sort())
    assert.equal(s.scenarioZones.setAside.includes('07086'),false)
    assert.equal(s.scenarioZones.setAside.includes('07332'),false)
    assert.equal(s.scenario.mechanics.water.air,true)
  })
  for(const water of [0,1])test(`TIC 07257: actual combat test at water ${water}; physical threat blocks all owner draw/gain until real enemy-phase end`,()=>{
    const s=lateFixture('aLightInTheFog',2);s.humanSeats=[0,1];s.investigators[0].assets=[]
    const mechanics=createMechanicsApi(s);mechanics.water.set(s.investigators[0].location,water)
    s.chaosBag=['autofail'];const damage=s.investigators[0].damage;draw(s,'07257')
    assert.equal(s.lastTestResult.difficulty,water?4:2)
    assert.equal(s.investigators[0].damage,damage+1)
    assert.equal(s.investigators[0].threat.filter(card=>card.code==='07257').length,1)
    assert.equal(s.encounterDiscard.includes('07257'),false)
    const hand=s.investigators[0].hand.length,resources=s.investigators[0].resources,other=s.investigators[1].resources
    transaction(s,draft=>{
      drawCards(draft,draft.investigators[0],2,[]);scenarioRuntime(draft,[]).gainResources(0,3)
      scenarioRuntime(draft,[]).gainResources(1,1)
    })
    assert.equal(s.investigators[0].hand.length,hand);assert.equal(s.investigators[0].resources,resources)
    assert.equal(s.investigators[1].resources,other+1)
    transaction(s,draft=>enemyPhase(draft))
    assert.equal(s.investigators[0].threat.some(card=>card.code==='07257'),false)
    assert.equal(s.encounterDiscard.filter(code=>code==='07257').length,1)
    transaction(s,draft=>{
      drawCards(draft,draft.investigators[0],1,[]);scenarioRuntime(draft,[]).gainResources(0,1)
    })
    assert.equal(s.investigators[0].hand.length,hand+1);assert.equal(s.investigators[0].resources,resources+1)
  })
  test('TIC 07257: success creates no threat or prohibition',()=>{
    const s=lateFixture('aLightInTheFog');s.chaosBag=['0'];s.investigators[0].combat=9
    const damage=s.investigators[0].damage;draw(s,'07257')
    assert.equal(s.investigators[0].damage,damage)
    assert.equal(s.investigators[0].threat.some(card=>card.code==='07257'),false)
    assert.equal(s.encounterDiscard.filter(code=>code==='07257').length,1)
  })
  registerCardAbilities([{code:'testTicLateImmuneHumanoid',scope:'enemy',modifiers:[{target:'cannot:beDamaged'}]}])
  for(const code of ['07300','07300b'])test(`TIC ${code}: real owned statue free ability filters Humanoid/damageable targets and pays exhaust/token cost`,()=>{
    const s=lateFixture('theLairOfDagon');s.investigators[0].assets=[];s.enemies=[];s.investigators[0].engaged=[]
    const statue=asset(s,code),human=enemy(s,{id:'human',traits:['Humanoid']}),monster=enemy(s,{id:'monster',traits:['Monster']})
    const immune=enemy(s,{id:'immune',code:'testTicLateImmuneHumanoid',traits:['Humanoid']})
    const commands=legalMoves(s).filter(command=>command.assetId===statue.id&&command.abilityIndex===0)
    assert.ok(commands.some(command=>command.targetId===human.id))
    assert.equal(commands.some(command=>[monster.id,immune.id].includes(command.targetId)),false)
    const actions=s.investigators[0].actionsLeft,curses=createMechanicsApi(s).chaosTokens.count('curse')
    const command=commands.find(command=>command.targetId===human.id);move(s,command);settle(s)
    assert.equal(s.enemies.find(enemy=>enemy.id===human.id).damageTaken,1)
    assert.equal(s.investigators[0].assets.find(asset=>asset.id===statue.id).exhausted,true)
    assert.equal(s.investigators[0].actionsLeft,actions)
    assert.equal(createMechanicsApi(s).chaosTokens.count('curse'),curses+(code==='07300'?2:0))
  })
  test('TIC 07300: exact two-curse additional cost preflight preserves exhaustion and target when physical supply short',()=>{
    const s=lateFixture('theLairOfDagon');s.investigators[0].assets=[]
    const statue=asset(s,'07300'),human=enemy(s,{traits:['Humanoid']})
    createMechanicsApi(s).chaosTokens.add('curse',9)
    assert.equal(legalMoves(s).some(command=>command.assetId===statue.id&&command.abilityIndex===0),false)
    assert.equal(statue.exhausted,false);assert.equal(human.damageTaken,0)
    assert.equal(createMechanicsApi(s).chaosTokens.count('curse'),9)
  })
  for(const blesses of [0,9,10])test(`TIC 07300b: removes two bag curses even with bless pool at ${blesses}, finite replacement and JSON`,()=>{
    const s=lateFixture('theLairOfDagon');s.investigators[0].assets=[];s.enemies=[]
    const statue=asset(s,'07300b'),tokens=createMechanicsApi(s).chaosTokens
    s.chaosBag=['0'];tokens.add('curse',2);tokens.add('bless',blesses)
    const command=legalMoves(s).find(command=>command.assetId===statue.id&&command.abilityIndex===1)
    assert.ok(command);move(s,command);settle(s)
    assert.equal(tokens.count('curse'),0);assert.equal(tokens.count('bless'),Math.min(10,blesses+2))
    assert.equal(s.investigators[0].assets.find(asset=>asset.id===statue.id).exhausted,true)
    assert.deepEqual(json(s).chaos,s.chaos)
  })
  test('TIC 07300b: only sealed curses cannot fund the bag-removal effect',()=>{
    const s=lateFixture('theLairOfDagon');s.investigators[0].assets=[];s.enemies=[]
    const statue=asset(s,'07300b'),tokens=createMechanicsApi(s).chaosTokens
    s.chaosBag=['0'];tokens.add('curse',2);tokens.seal('held-elsewhere','curse',2)
    assert.equal(legalMoves(s).some(command=>command.assetId===statue.id&&command.abilityIndex===1),false)
    assert.equal(statue.exhausted,false);assert.equal(tokens.count('curse'),2)
  })
  test('TIC 07294: real Hunter move engages lowest-willpower prey and adds two physically capped curses',()=>{
    const s=lateFixture('theLairOfDagon',2);s.humanSeats=[0,1]
    s.enemies=[];for(const inv of s.investigators)inv.engaged=[]
    const start=s.investigators[0].location,remote=locationOf(s,'07286');assert.ok(remote)
    s.investigators[1].location=start;s.investigators[0].willpower=5;s.investigators[1].willpower=1
    createMechanicsApi(s).map.connect(start,remote.id)
    let spawned
    transaction(s,draft=>{
      const runtime=scenarioRuntime(draft,[]);spawned=runtime.spawn('07294',remote.id)
      assert.equal(spawned.prey,'lowestWillpower')
      enemyPhase(draft)
    })
    const deepOne=s.enemies.find(enemy=>enemy.id===spawned.id);assert.equal(deepOne.engagedSeat,1)
    assert.equal(createMechanicsApi(s).chaosTokens.count('curse'),2)
    createMechanicsApi(s).chaosTokens.add('curse',7)
    transaction(s,draft=>scenarioRuntime(draft,[]).engage(draft.enemies.find(enemy=>enemy.id===deepOne.id),0))
    assert.equal(createMechanicsApi(s).chaosTokens.count('curse'),10)
  })
  test('TIC 07291: actual entry tests one of tied lowest modified skills and applies horror on failure',()=>{
    const s=lateFixture('theLairOfDagon');placePrinted(s,'07291')
    const lair=locationOf(s,'07291');assert.ok(lair);lair.revealed=true
    Object.assign(s.investigators[0],{willpower:5,intellect:5,combat:1,agility:1})
    createMechanicsApi(s).map.connect(s.investigators[0].location,lair.id);s.chaosBag=['autofail']
    const before=s.investigators[0].horror
    transaction(s,draft=>scenarioRuntime(draft,[]).moveInvestigator(0,lair.id),choice=>choice.options.some(option=>option.id==='agility')?'agility':null)
    assert.equal(s.lastTestResult.skill,'agility');assert.equal(s.lastTestResult.difficulty,3)
    assert.equal(s.investigators[0].horror,before+1)
  })
  for(const clues of [0,1,2])test(`TIC 07291: real action moves own clues (${clues} available), optional key only when another clue exists`,()=>{
    const s=lateFixture('theLairOfDagon');placePrinted(s,'07291')
    const lair=locationOf(s,'07291');assert.ok(lair);lair.revealed=true;s.investigators[0].location=lair.id
    s.investigators[0].clues=clues;s.investigators[0].willpower=9;s.chaosBag=['0'];s.actClues=0
    s.scenarioFlags.mechanics.keys.black={holder:'investigator:0',revealed:true}
    const command=legalMoves(s).find(command=>command.action==='entityAbility'&&command.entityId===lair.id)
    assert.ok(command);move(s,command)
    settle(s,choice=>choice.options.some(option=>option.id==='willpower')?'willpower':choice.options.some(option=>option.id==='black')?'black':null)
    assert.equal(s.actClues,clues);assert.equal(s.investigators[0].clues,0)
    assert.equal(keysAt(s,clues===2?'reference':'investigator:0').includes('black'),true)
  })
  test('TIC 07258: failed revelation creates one physical threat; real flooded entry hurts only owner; own turn end discards once',()=>{
    const s=lateFixture('aLightInTheFog',2);s.humanSeats=[0,1];s.chaosBag=['autofail']
    draw(s,'07258')
    assert.equal(s.investigators[0].threat.filter(card=>card.code==='07258').length,1)
    assert.equal(s.encounterDiscard.includes('07258'),false)
    const from=s.locations.find(loc=>loc.id===s.investigators[0].location),to=locationOf(s,'07243')
    createMechanicsApi(s).map.connect(from.id,to.id);createMechanicsApi(s).water.set(to.id,1)
    const before=s.investigators[0].horror
    transaction(s,draft=>scenarioRuntime(draft,[]).moveInvestigator(0,to.id))
    assert.equal(s.investigators[0].horror,before+1)
    const other=s.investigators[1].horror
    transaction(s,draft=>scenarioRuntime(draft,[]).moveInvestigator(1,to.id))
    assert.equal(s.investigators[1].horror,other)
    assert.equal(s.investigators[0].horror,before+1)
    transaction(s,draft=>scenarioRuntime(draft,[]).moveInvestigator(0,from.id))
    assert.equal(s.investigators[0].horror,before+1,'unflooded entry causes no horror')
    move(s,{action:'endTurn'});settle(s)
    assert.equal(s.investigators[0].threat.some(card=>card.code==='07258'),false)
    assert.equal(s.encounterDiscard.filter(code=>code==='07258').length,1)
  })
  test('TIC 07258: successful revelation discards immediately and creates no persistent movement effect',()=>{
    const s=lateFixture('aLightInTheFog');s.chaosBag=['0'];s.investigators[0].willpower=9
    draw(s,'07258')
    assert.equal(s.investigators[0].threat.some(card=>card.code==='07258'),false)
    assert.equal(s.encounterDiscard.filter(code=>code==='07258').length,1)
  })
  for(const code of ['07244','07245','07246'])test(`TIC ${code}: local team pays n clues for same-row private look, no reveal or clues`,()=>{
    const s=lateFixture('aLightInTheFog',2);s.humanSeats=[0,1]
    placePrinted(s,code);placePrinted(s,'07102')
    const grotto=locationOf(s,code),tunnel=locationOf(s,'07102');assert.ok(grotto&&tunnel)
    const mechanics=createMechanicsApi(s)
    // The fixture uses production card definitions/placement, then arranges a
    // small deterministic board to isolate the shared row-look rule.
    mechanics.map.place(grotto.id,20,-5);mechanics.map.place(tunnel.id,21,-5)
    grotto.revealed=true;tunnel.revealed=false;tunnel.clues=0
    s.investigators[0].location=grotto.id;s.investigators[1].location=grotto.id
    s.investigators[0].clues=1;s.investigators[1].clues=1
    let command=legalMoves(s).find(command=>command.action==='entityAbility'&&command.entityId===grotto.id)
    assert.ok(command);const actions=s.investigators[0].actionsLeft;let sawPrivate=false
    move(s,command);settle(s,choice=>{
      if(choice.source==='peekLocation'){
        sawPrivate=true;assert.equal(choice.seat,0)
        assert.ok(choice.options.some(option=>option.cardCode==='07102'))
        const remote=viewState(s,1).pendingChoice
        assert.deepEqual(remote.options,[])
        const projected=JSON.stringify(remote)
        assert.equal(projected.includes('cardCode'),false)
        assert.equal(projected.includes(ALL_CARDS['07102'].name),false)
        assert.equal(projected.includes(ALL_CARDS['07102'].nameZh),false)
        return 'done'
      }
      if(choice.options.some(option=>option.id===tunnel.id))return tunnel.id
      return null
    })
    assert.equal(sawPrivate,true);assert.equal(s.investigators[0].clues+s.investigators[1].clues,0)
    assert.equal(s.investigators[0].actionsLeft,actions)
    assert.equal(s.locations.find(location=>location.id===tunnel.id).revealed,false)
    assert.equal(s.locations.find(location=>location.id===tunnel.id).clues,0)
    s.investigators[0].clues=1;s.investigators[1].clues=1
    s.investigators[1].location=tunnel.id
    assert.equal(legalMoves(s).some(command=>command.action==='entityAbility'&&command.entityId===grotto.id),false,'remote clues cannot pay')
    s.investigators[1].location=grotto.id
    mechanics.map.place(tunnel.id,21,-6)
    assert.equal(legalMoves(s).some(command=>command.action==='entityAbility'&&command.entityId===grotto.id),false,'different row is not eligible')
    mechanics.map.place(tunnel.id,21,-5);s.locations.find(location=>location.id===tunnel.id).revealed=true
    assert.equal(legalMoves(s).some(command=>command.action==='entityAbility'&&command.entityId===grotto.id),false,'already revealed is not eligible')
  })
  test('TIC 07335: discard enough printed asset cost using real leave-play; Permanent excluded',()=>{
    const s=lateFixture('intoTheMaelstrom'),here=s.locations.find(loc=>loc.id===s.investigators[0].location)
    here.shroud=4;s.investigators[0].assets=[]
    const first=asset(s,'01020'),second=asset(s,'01086'),permanent=asset(s,'07122')
    s.encounterDeck.push('07335')
    transaction(s,draft=>drawEncounter(draft,draft.investigators[0],[]),choice=>{
      if(choice.options.some(option=>option.id==='discard'))return 'discard'
      if(choice.source==='07335'){
        assert.equal(choice.options.some(option=>option.id===permanent.id),false)
        return choice.options.find(option=>[first.id,second.id].includes(option.id))?.id??null
      }
      return null
    })
    assert.equal(s.investigators[0].assets.some(a=>[first.id,second.id].includes(a.id)),false)
    assert.ok(s.investigators[0].discard.includes('01020'));assert.ok(s.investigators[0].discard.includes('01086'))
    assert.equal(createMechanicsApi(s).water.level(here.id),1)
  })
  test('TIC 07335: insufficient asset total cannot choose discard; real water cap leaves no fake choice',()=>{
    const s=lateFixture('intoTheMaelstrom'),here=s.locations.find(loc=>loc.id===s.investigators[0].location)
    here.shroud=4;s.investigators[0].assets=[];const knife=asset(s,'01086')
    draw(s,'07335')
    assert.equal(createMechanicsApi(s).water.level(here.id),2)
    assert.equal(s.investigators[0].assets.some(a=>a.id===knife.id),true)
    draw(s,'07335')
    assert.equal(s.pendingChoice,null)
    assert.equal(s.encounterDiscard.filter(code=>code==='07335').length,2)
  })
  test('TIC 07336: difficulty counts keyed Sanctum locations, not number of keys; failure can actually advance agenda',()=>{
    const s=lateFixture('intoTheMaelstrom');placePrinted(s,'07324')
    const sanctum=locationOf(s,'07324');assert.ok(sanctum)
    s.scenarioFlags.mechanics.keys.blue={holder:`location:${sanctum.id}`,revealed:true}
    s.scenarioFlags.mechanics.keys.red={holder:`location:${sanctum.id}`,revealed:true}
    s.investigators[0].willpower=0;s.chaosBag=['autofail'];s.doom=s.agendas[s.agendaIndex].doomThreshold-1
    const before=s.agendaIndex;draw(s,'07336')
    assert.equal(s.lastTestResult.difficulty,3)
    assert.equal(s.agendaIndex,before+1)
    assert.equal(s.encounterDiscard.filter(code=>code==='07336').length,1)
  })
  test('TIC 07336: nearest attack option excludes sleeping/cannot-attack Ancient Ones; assigned damage remains real',()=>{
    const s=lateFixture('intoTheMaelstrom');s.enemies=[];s.investigators[0].engaged=[]
    enemy(s,{id:'awake',code:'07330b',originalCode:'07330b',traits:['Ancient One'],engagedSeat:null,damage:1,horror:1})
    enemy(s,{id:'sleep',code:'07331a',originalCode:'07331a',traits:['Ancient One'],engagedSeat:null,damage:3,horror:3})
    s.investigators[0].willpower=0;s.chaosBag=['autofail'];const before=s.investigators[0].damage
    s.encounterDeck.push('07336')
    transaction(s,draft=>drawEncounter(draft,draft.investigators[0],[]),choice=>choice.options.some(option=>option.id==='attack')?'attack':null)
    assert.equal(s.investigators[0].damage,before+1)
  })
  for(const existing of [0,9]) test(`TIC 07277: actual memory-selected v.I agenda back adds four capped curses with ${existing} existing`,()=>{
    const s=lateFixture('theLairOfDagon',1,{memoriesRecovered:['ADecisionToStickTogether']})
    assert.equal(s.agendas[1].originalCode||s.agendas[1].code,'07277')
    assert.equal(s.scenario.mechanics.water.air,true)
    s.agendaIndex=1;s.chaosBag=['0'];createMechanicsApi(s).chaosTokens.add('curse',existing)
    transaction(s,draft=>scenarioRuntime(draft,[]).advanceAgenda())
    assert.equal(createMechanicsApi(s).chaosTokens.count('curse'),Math.min(10,existing+4))
    assert.equal(s.agendaIndex,2)
    assert.equal(s.scenario.mechanics.water.air,true,'air rule remains enabled through agenda transition')
    assert.equal(createMechanicsApi(json(s)).chaosTokens.count('curse'),Math.min(10,existing+4))
  })
  test('TIC 07320 definition/setup-only: real partial flood, orthogonal adjacency, play-zone and investigator starts',()=>{
    const s=lateFixture('intoTheMaelstrom',2),gateway=locationOf(s,'07320')
    assert.ok(gateway);assert.equal(createMechanicsApi(s).water.level(gateway.id),1)
    assert.equal(s.locations.length,9,'gateway plus eight distinct Tidal Tunnel physical cards')
    assert.equal(new Set(s.locations.map(location=>location.id)).size,9)
    assert.equal(gateway.connections.length,4,'orthogonal four; not eight surrounding diagonal cells')
    assert.equal(s.investigators.every(inv=>inv.location===gateway.id),true)
    assert.equal(s.locations.filter(location=>['07321','07322','07323','07324','07325','07326','07327','07328','07329'].includes(location.originalCode||location.code)).length,0)
    const restored=json(s),copy=locationOf(restored,'07320')
    assert.equal(createMechanicsApi(restored).water.level(copy.id),1)
    assert.deepEqual(copy.connections,gateway.connections)
  })
  for(const margin of [-1,1,2]) test(`TIC 07251: real skill choice and water transfer at success margin ${margin}`,()=>{
    const s=lateFixture('aLightInTheFog')
    placePrinted(s,'07251')
    const pump=locationOf(s,'07251'),from=locationOf(s,'07239'),to=locationOf(s,'07243')
    assert.ok(pump&&from&&to);pump.revealed=true;s.investigators[0].location=pump.id
    s.investigators[0].intellect=2+margin;s.chaosBag=['0']
    const water=createMechanicsApi(s).water;water.set(from.id,1);water.set(to.id,0)
    const command=legalMoves(s).find(command=>command.action==='entityAbility'&&command.entityId===pump.id)
    assert.ok(command);move(s,command)
    settle(s,choice=>choice.options.some(option=>option.id==='intellect')?'intellect'
      :margin>=2&&choice.options.some(option=>option.id==='skip')?'skip'
      :choice.options.some(option=>option.id===from.id)?from.id
      :choice.options.some(option=>option.id===to.id)?to.id:null)
    assert.equal(water.level(from.id),margin<0?1:0)
    assert.equal(water.level(to.id),margin===1?1:0)
    assert.equal(s.lastTestResult.skill,'intellect')
    assert.equal(s.lastTestResult.difficulty,2)
  })
  for (const [code,color,cap] of [['07241','white',0],['07243','yellow',1]]) {
    test(`TIC ${code}: real reveal places exactly its reserved key, cap remains after JSON`,()=>{
      const s=lateFixture('aLightInTheFog'),loc=locationOf(s,code)
      assert.ok(loc);assert.equal(loc.revealed,false)
      assert.ok(!keysAt(s,`location:${loc.id}`).includes(color))
      transaction(s,draft=>revealLocation(draft,loc.id,[],0))
      assert.deepEqual(keysAt(s,`location:${loc.id}`),[color])
      const restored=json(s),api=createMechanicsApi(restored)
      assert.equal(api.water.set(loc.id,2),cap)
      assert.equal(api.water.canChange(loc.id,1),false)
      transaction(restored,draft=>revealLocation(draft,loc.id,[],0))
      assert.deepEqual(keysAt(restored,`location:${loc.id}`),[color])
      assert.equal(keysAt(restored,'setAside',{reveal:true}).includes(color),false)
    })
  }
  test('TIC 07256: highest actual Deep One fight sets a real test; non-Deep-One value excluded',()=>{
    const s=lateFixture('aLightInTheFog');s.enemies=[];s.investigators[0].engaged=[]
    enemy(s,{id:'deep-low',traits:['Deep One'],fight:1,engagedSeat:null})
    enemy(s,{id:'deep-high',traits:['Deep One'],fight:5,engagedSeat:null})
    enemy(s,{id:'other-high',traits:['Cultist'],fight:12,engagedSeat:null})
    s.chaosBag=['autofail'];const before=s.investigators[0].horror
    draw(s,'07256')
    assert.equal(s.lastTestResult.difficulty,5)
    assert.equal(s.investigators[0].horror,before+2)
    assert.equal(s.encounterDiscard.filter(code=>code==='07256').length,1)
  })
  test('TIC 07256: no Deep Ones surges once and performs no skill test',()=>{
    const s=lateFixture('aLightInTheFog');s.enemies=[];s.encounterDeck=['01165']
    const result=s.lastTestResult
    draw(s,'07256')
    assert.equal(s.lastTestResult,result)
    assert.equal(s.encounterDeck.length,0)
    assert.equal(s.encounterDiscard.filter(code=>code==='07256').length,1)
    assert.equal(s.investigators[0].threat.filter(card=>card.code==='01165'||card.code==='dissonantVoices').length,1)
  })
  for(const actStep of [1,2,3]) test(`TIC 07295: act${actStep} makes ${actStep} distinct consecutive tests and failed damage`,()=>{
    const s=lateFixture('theLairOfDagon');s.actIndex=actStep-1;s.chaosBag=['autofail']
    s.investigators[0].assets=[];const before=s.investigators[0].damage
    draw(s,'07295')
    assert.equal(s.investigators[0].damage,before+actStep)
    assert.equal(s.lastTestResult.skill,['agility','combat','intellect'][actStep-1])
    assert.equal(s.lastTestResult.difficulty,actStep===1?3:2)
    assert.equal(s.chaosBag.filter(face=>face==='autofail').length,1,'each test returns token before next test')
    assert.equal(s.encounterDiscard.filter(code=>code==='07295').length,1)
  })
  test('TIC 07295: successful tests cause no damage',()=>{
    const s=lateFixture('theLairOfDagon');s.actIndex=2;s.chaosBag=['0']
    Object.assign(s.investigators[0],{agility:9,combat:9,intellect:9})
    const before=s.investigators[0].damage;draw(s,'07295')
    assert.equal(s.investigators[0].damage,before)
  })
  test('TIC 07284: reveal red key; failed investigation at this physical hall causes exactly one horror',()=>{
    const s=lateFixture('theLairOfDagon'),loc=locationOf(s,'07284')
    assert.ok(loc);loc.revealed=false;s.investigators[0].location=loc.id
    transaction(s,draft=>revealLocation(draft,loc.id,[],0))
    assert.deepEqual(keysAt(s,`location:${loc.id}`),['red'])
    s.chaosBag=['autofail'];s.investigators[0].assets=[]
    const before=s.investigators[0].horror;move(s,{action:'investigate'});settle(s)
    assert.equal(s.investigators[0].horror,before+1)
    const remote=s.locations.find(location=>location.id!==loc.id);assert.ok(remote)
    s.investigators[0].location=remote.id;remote.revealed=true;remote.clues=1
    const after=s.investigators[0].horror;move(s,{action:'investigate'});settle(s)
    assert.equal(s.investigators[0].horror,after,'hall does not punish remote failed investigation')
  })
  test('TIC 07323: real key-placement action, free connected movement and per-investigator round limit survive JSON',()=>{
    const s=lateFixture('intoTheMaelstrom',2);s.humanSeats=[0,1]
    placePrinted(s,'07323')
    const loc=locationOf(s,'07323');assert.ok(loc)
    loc.revealed=true;const next=s.locations.find(location=>location.id!==loc.id);assert.ok(next)
    loc.connections=[next.id];next.connections=[loc.id]
    s.investigators[0].location=loc.id;s.investigators[1].location=loc.id
    s.scenarioFlags.mechanics.keys.white={holder:'investigator:0',revealed:true}
    const before=s.investigators[0].actionsLeft
    let command=legalMoves(s).find(command=>command.action==='entityAbility'&&command.entityId===loc.id&&command.abilityIndex===0)
    assert.ok(command);move(s,command);settle(s)
    assert.equal(s.investigators[0].actionsLeft,before-1)
    assert.deepEqual(keysAt(s,`location:${loc.id}`),['white'])
    command=legalMoves(s).find(command=>command.action==='entityAbility'&&command.entityId===loc.id&&command.abilityIndex===1)
    assert.ok(command);const actions=s.investigators[0].actionsLeft;move(s,command);settle(s)
    assert.equal(s.investigators[0].location,next.id);assert.equal(s.investigators[0].actionsLeft,actions)
    const restored=json(s);restored.investigators[0].location=loc.id
    assert.notEqual(validateMove(restored,0,command),null,'same investigator cannot use twice this round')
    restored.currentSeat=1
    assert.equal(validateMove(restored,1,command),null,'second investigator has an independent allowance')
    restored.round++
    restored.currentSeat=0
    assert.equal(validateMove(restored,0,command),null,'new round restores allowance')
  })
  for(const cursed of [false,true]) test(`TIC 07296: failed real test ${cursed?'with':'without'} curse places Cultist doom and exact horror`,()=>{
    const s=lateFixture('theLairOfDagon');s.enemies=[];s.investigators[0].engaged=[]
    const cultist=enemy(s,{id:'cultist',traits:['Cultist'],engagedSeat:null,doom:0})
    const other=enemy(s,{id:'other',traits:['Deep One'],engagedSeat:null,doom:0})
    s.investigators[0].willpower=0;s.chaosBag=['autofail'];s.rngState=0
    // Seed zero picks index zero first: the printed added curse is after autofail
    // in the false branch, and an existing curse is first in the true branch.
    if(cursed)s.chaosBag=['curse','autofail']
    const before=s.investigators[0].horror;draw(s,'07296')
    assert.equal(s.lastTestResult.drawn.includes('curse'),cursed)
    assert.equal(s.enemies.find(e=>e.id===cultist.id).doom,1)
    assert.equal(s.enemies.find(e=>e.id===other.id).doom,0)
    assert.equal(s.investigators[0].horror,before+(cursed?2:1))
    assert.equal(s.encounterDiscard.filter(code=>code==='07296').length,1)
  })
  test('TIC 07296: successful test adds the printed curse but no Cultist doom or horror',()=>{
    const s=lateFixture('theLairOfDagon');s.enemies=[];s.investigators[0].engaged=[]
    enemy(s,{id:'cultist',traits:['Cultist'],engagedSeat:null,doom:0})
    s.investigators[0].willpower=20;s.chaosBag=['0'];const before=s.investigators[0].horror
    draw(s,'07296')
    assert.equal(s.lastTestResult.success,true)
    assert.equal(s.enemies.find(e=>e.id==='cultist').doom,0)
    assert.equal(s.investigators[0].horror,before)
    assert.ok((s.lastTestResult.drawn.includes('curse')?1:0)+s.chaosBag.filter(face=>face==='curse').length>=1)
  })
  for(const water of [0,1,2]) test(`TIC 07298: actual water ${water} sets difficulty and adds failed-by curses`,()=>{
    const s=lateFixture('theLairOfDagon');const api=createMechanicsApi(s)
    api.water.set(s.investigators[0].location,water);s.chaosBag=['0'];s.investigators[0].willpower=1
    const difficulty=water===0?3:5;draw(s,'07298')
    assert.equal(s.lastTestResult.difficulty,difficulty)
    assert.equal(s.chaosBag.filter(face=>face==='curse').length,difficulty-1)
    assert.equal(s.encounterDiscard.filter(code=>code==='07298').length,1)
    assert.deepEqual(json(s).scenarioFlags.mechanics,s.scenarioFlags.mechanics)
  })
  test('TIC 07298: insufficient physical curse supply adds only remaining tokens and surges once',()=>{
    const s=lateFixture('theLairOfDagon');const api=createMechanicsApi(s)
    api.chaosTokens.add('curse',9);s.investigators[0].willpower=0;s.encounterDeck=['01165']
    // Reserve nine elsewhere so none can alter the failed test itself.
    api.chaosTokens.seal('test-sealed-supply','curse',9)
    s.chaosBag=['0'];draw(s,'07298')
    assert.equal(api.chaosTokens.count('curse'),10)
    assert.equal(s.encounterDeck.length,0)
    assert.equal(s.encounterDiscard.filter(code=>code==='07298').length,1)
    assert.equal(s.investigators[0].threat.filter(card=>card.code==='01165'||card.code==='dissonantVoices').length,1)
  })
}

registerLateTests(chapterFixture)
