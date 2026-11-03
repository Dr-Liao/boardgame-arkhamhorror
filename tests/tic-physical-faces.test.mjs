import { chapterFixture } from './tic-chapter-fixture.mjs'
// Main copies into Mod/tests and registers with real chapterFixture plus wrappers
// around the reviewed production flip API. No callback may simulate state edits.
import test from 'node:test'
import assert from 'node:assert/strict'
import { enemy, asset, move, settle } from './core-fixture.mjs'
import { scenarioRuntime, legalMoves, validateMove, enemyHealth } from '../src/engine/engine.js'
import { createMechanicsApi } from '../src/engine/api-mechanics.js'
import { resolveTransaction } from '../src/engine/resolution.js'
import { keysAt } from '../src/engine/scenario-keys.js'
const json=value=>JSON.parse(JSON.stringify(value))
function run(state,execute){
  resolveTransaction(state,0,{action:'physicalFaceTest'},execute)
  for(let guard=0;state.pendingChoice;guard++){
    assert.ok(guard<100)
    const choice=state.pendingChoice,id=choice.options.find(option=>['skip','done','self'].includes(option.id))?.id??choice.options[0].id
    resolveTransaction(state,choice.seat,{action:'choose',choiceId:choice.id,optionId:id},execute)
  }
}
const place=(state,code)=>{
  const found=state.locations.find(location=>(location.originalCode||location.code)===code)
  if(found)return found
  const definition=Object.entries(state.scenario.locations).find(([,location])=>(location.originalCode||location.code)===code)
  assert.ok(definition);scenarioRuntime(state,[]).place(definition[0])
  return state.locations.find(location=>(location.originalCode||location.code)===code)
}

export function registerPhysicalFaceIntegrationTests(chapterFixture,{flipEnemy,flipAsset}){
  assert.equal(typeof flipEnemy,'function');assert.equal(typeof flipAsset,'function')
  for(const [scenario,front,back] of [['theLairOfDagon','07292a','07292b'],['intoTheMaelstrom','07330a','07330b'],['intoTheMaelstrom','07331a','07331b']]){
    test(`P7 physical ${front}→${back}: real flip preserves id/counters/keys/seals/attachments and JSON; null health remains distinct`,()=>{
      const s=chapterFixture(scenario,2);s.enemies=[]
      for(const inv of s.investigators){inv.engaged=[];inv.assets=[]}
      const boss=scenarioRuntime(s,[]).spawn(front,s.investigators[0].location);assert.ok(boss)
      Object.assign(boss,{exhausted:true,damageTaken:1,doom:2,resources:3,clues:4,attachments:[{id:'physical-note',code:'fixture-note'}]})
      createMechanicsApi(s).keys.transfer('blue','setAside',`enemy:${boss.id}`,{reveal:true})
      const tokens=createMechanicsApi(s).chaosTokens;tokens.add('bless',1);tokens.seal(boss.id,'bless',1)
      assert.equal(enemyHealth(s,boss),null)
      const before=json({keys:s.scenarioFlags.mechanics.keys,seals:s.chaos.sealed})
      run(s,draft=>flipEnemy(draft,draft.enemies.find(enemy=>enemy.id===boss.id),back))
      const actual=s.enemies.find(enemy=>enemy.id===boss.id);assert.ok(actual)
      assert.equal(actual.originalCode||actual.code,back)
      assert.equal(s.enemies.length,1)
      assert.deepEqual({exhausted:actual.exhausted,damageTaken:actual.damageTaken,doom:actual.doom,resources:actual.resources,clues:actual.clues,attachments:actual.attachments},
        {exhausted:true,damageTaken:1,doom:2,resources:3,clues:4,attachments:[{id:'physical-note',code:'fixture-note'}]})
      assert.deepEqual({keys:s.scenarioFlags.mechanics.keys,seals:s.chaos.sealed},before)
      assert.equal(keysAt(s,`enemy:${actual.id}`).includes('blue'),true)
      assert.equal(enemyHealth(s,actual),scenario==='theLairOfDagon'?18:null)
      const restored=json(s),again=restored.enemies.find(enemy=>enemy.id===boss.id)
      run(restored,draft=>flipEnemy(draft,draft.enemies.find(enemy=>enemy.id===again.id),front))
      assert.equal(restored.enemies.length,1);assert.equal(enemyHealth(restored,restored.enemies[0]),null)
      assert.deepEqual(restored.chaos.sealed,before.seals)
    })
  }
  test('P7 physical asset face preserves actual controller, damage, uses, key and seal without enter/leave duplication',()=>{
    const s=chapterFixture('theLairOfDagon',2);for(const inv of s.investigators)inv.assets=[]
    const statue=asset(s,'07300',{damage:1,horror:2,doom:3,uses:4,usesType:'secrets',exhausted:true,attachments:[{id:'attached-note',code:'fixture-note'}]},1)
    createMechanicsApi(s).keys.transfer('red','setAside',`asset:${statue.id}`,{reveal:true})
    const tokens=createMechanicsApi(s).chaosTokens;tokens.add('bless',1);tokens.seal(statue.id,'bless',1)
    const before=json({keys:s.scenarioFlags.mechanics.keys,seals:s.chaos.sealed,removed:s.removedFromGame,discard:s.investigators[1].discard})
    run(s,draft=>flipAsset(draft,draft.investigators[1].assets.find(asset=>asset.id===statue.id),'07300b'))
    const actual=s.investigators[1].assets.find(asset=>asset.id===statue.id);assert.ok(actual)
    assert.equal(actual.code,'07300b');assert.equal(s.investigators[1].assets.length,1);assert.equal(s.investigators[0].assets.length,0)
    assert.deepEqual({damage:actual.damage,horror:actual.horror,doom:actual.doom,uses:actual.uses,usesType:actual.usesType,exhausted:actual.exhausted},
      {damage:1,horror:2,doom:3,uses:4,usesType:'secrets',exhausted:true})
    assert.deepEqual(json({keys:s.scenarioFlags.mechanics.keys,seals:s.chaos.sealed,removed:s.removedFromGame,discard:s.investigators[1].discard}),before)
    assert.deepEqual(json(s).investigators[1].assets,s.investigators[1].assets)
  })
}

registerPhysicalFaceIntegrationTests(chapterFixture,{flipEnemy:(s,e,c)=>scenarioRuntime(s,[]).flipEnemy(e,c),flipAsset:(s,a,c)=>scenarioRuntime(s,[]).flipAsset(a,c)})
