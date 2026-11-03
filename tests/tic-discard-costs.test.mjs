// Proposed actual-engine acceptance cases. Parent integrates cost keys/readers
// first. Worker runs syntax checks only; no missing production card is created.
import test from 'node:test'
import assert from 'node:assert/strict'
import {fixture as coreFixture,move,settle,asset} from './core-fixture.mjs'
import {registerCardAbilities,registeredEntry} from '../src/engine/ability.js'
import {legalMoves,validateMove} from '../src/engine/engine.js'

const gain=({inv,api})=>api.gainResources(inv.seat,10)
registerCardAbilities([
 {code:'testEarlyIconCost',scope:'location',abilities:[{kind:'action',actionKind:'parley',cost:{action:1,discardHandIcons:3},resolve:gain}]},
 {code:'testEarlyMixedHandCost',scope:'location',abilities:[{kind:'action',actionKind:'parley',cost:{action:1,discardHand:1,discardHandIcons:2},resolve:gain}]},
 {code:'testEarlyResourceIconCost',scope:'location',abilities:[{kind:'action',actionKind:'parley',cost:{action:1,resources:2,discardHandIcons:3},resolve:gain}]},
 {code:'testEarlyAssetCost',scope:'location',abilities:[{kind:'action',actionKind:'parley',cost:{action:1,resources:2,discardControlledAsset:1},resolve:gain}]},
 {code:'testEarlyTwoAssetCost',scope:'location',abilities:[{kind:'action',actionKind:'parley',cost:{action:1,discardControlledAsset:2},resolve:gain}]},
 {code:'testEarlySharedAssetCost',teamActivatable:true,abilities:[{kind:'action',cost:{action:1,resources:2,discardControlledAsset:1},resolve:gain}]},
 {code:'testEarlySelfAssetCost',abilities:[{kind:'action',cost:{action:1,discardSelf:true,discardControlledAsset:1},resolve:gain}]},
 {code:'testEarlyCannotDiscardAsset',passive:{cannotDiscard:true}},
 {code:'testEarlyCannotLeaveAsset',cannotLeavePlayWhile:()=>true},
 {code:'testEarlyCannotCancelCost',abilities:[{kind:'forced',trigger:'wouldDiscardFromHand',
  resolve:({inv,context,api})=>{context.cancelled=true;api.gainResources(inv.seat,100)}}]},
 {code:'testEarlyDiscardObserver',abilities:[{kind:'forced',trigger:'handCardDiscarded',
  resolve:({inv,context,api})=>{if(context.seat===inv.seat)api.gainResources(inv.seat,1)}}]},
])
if(!registeredEntry('07150'))registerCardAbilities((await import('../src/cards/encounter-entries/theInnsmouthConspiracy/inTooDeep/07150.js')).default)
if(!registeredEntry('06203'))registerCardAbilities((await import('../src/cards/entries/06203.js')).default)
function fixture(code='testEarlyIconCost',count=1){
 const s=coreFixture('01001',count);s.humanSeats=s.investigators.map(i=>i.seat);s.abilityLimits={}
 const here=s.investigators[0].location;Object.assign(s.locations.find(l=>l.id===here),{code,originalCode:code,revealed:true,clues:1})
 return s
}
const entity=s=>legalMoves(s).find(m=>m.action==='entityAbility'&&m.entityId===s.investigators[0].location)
function chooseCard(code){return c=>c.options.find(o=>o.cardCode===code)?.id??null}
function finish(s,select=()=>null){settle(s,(c,state)=>{
 if(['discard','discard-asset'].includes(c.kind)){
  assert.notEqual(c.canSkip,true);assert.equal(c.options.some(o=>['skip','cancel','done'].includes(o.id)),false)
 }
 return select(c,state)
})}

test('icon cost counts wild and mixed printed icons, excludes zero-icon cards and pays one real action',()=>{
 const s=fixture();s.investigators[0].hand=['01093','01021','01088']
 const resources=s.investigators[0].resources,actions=s.investigators[0].actionsLeft
 move(s,entity(s));assert.ok(s.pendingChoice)
 assert.equal(s.pendingChoice.options.some(o=>o.cardCode==='01093'),true)
 assert.equal(s.pendingChoice.options.some(o=>o.cardCode==='01088'),false)
 finish(s,chooseCard('01093'))
 assert.deepEqual(s.investigators[0].hand,['01088']);assert.deepEqual([...s.investigators[0].discard].sort(),['01021','01093'])
 assert.equal(s.investigators[0].resources,resources+10);assert.equal(s.investigators[0].actionsLeft,actions-1)
})
test('icon cost overshoots with two distinct same-code copies, each original physical hand slot once, and JSON resumes',()=>{
 const s=fixture();s.investigators[0].hand=['01089','01089']
 move(s,entity(s));assert.ok(s.pendingChoice);assert.equal(new Set(s.pendingChoice.options.map(o=>o.id)).size,2)
 const saved=JSON.parse(JSON.stringify(s));finish(s);finish(saved)
 assert.equal(s.investigators[0].hand.length,0);assert.equal(s.investigators[0].discard.filter(c=>c==='01089').length,2)
 assert.deepEqual(saved.investigators,s.investigators)
})
test('empty, one-short, hidden and weakness-only icon hands atomically reject before any ordinary fee',()=>{
 for(const reason of ['empty','short','hidden','weakness']){
  const s=fixture('testEarlyResourceIconCost')
  if(reason==='short')s.investigators[0].hand=['01089']
  if(reason==='hidden'){s.investigators[0].hand=['01093','01021'];s.investigators[0].hiddenCards=['01093']}
  if(reason==='weakness')s.investigators[0].hand=['06331','01021']
  const before=JSON.stringify(s)
  assert.equal(entity(s),undefined)
  assert.notEqual(validateMove(s,0,{action:'entityAbility',entityId:s.investigators[0].location,abilityIndex:0}),null)
  assert.equal(JSON.stringify(s),before)
 }
})
test('combined ordinary hand-card and icon costs cannot pay twice with one physical card',()=>{
 const s=fixture('testEarlyMixedHandCost');s.investigators[0].hand=['01089']
 const before=JSON.stringify(s);assert.equal(entity(s),undefined);assert.equal(JSON.stringify(s),before)
 const t=fixture('testEarlyMixedHandCost');t.investigators[0].hand=['01089','01088']
 move(t,entity(t));assert.ok(t.pendingChoice)
 assert.deepEqual(t.pendingChoice.options.map(o=>o.cardCode),['01088'],'ordinary discard must preserve enough icons for the separate icon fee')
 finish(t);assert.equal(t.investigators[0].hand.length,0);assert.deepEqual([...t.investigators[0].discard].sort(),['01088','01089'])
})
test('insufficient actor resources or actions reject even with ample icons, without a pending discard choice',()=>{
 for(const reason of ['resources','actions']){
  const s=fixture('testEarlyResourceIconCost',2);s.investigators[0].hand=['01093','01021']
  if(reason==='resources')s.investigators[0].resources=1;else s.investigators[0].actionsLeft=0
  const before=JSON.stringify(s);assert.equal(entity(s),undefined);assert.equal(JSON.stringify(s),before);assert.equal(s.pendingChoice,null)
 }
})
test('last real action is charged once through _actionPaid and icon fees still complete before next actor turn',()=>{
 const s=fixture('testEarlyResourceIconCost',2);s.investigators[0].hand=['01093','01021'];s.investigators[0].actionsLeft=1;s.investigators[0].resources=2
 move(s,entity(s));finish(s)
 assert.equal(s.investigators[0].actionsLeft,0);assert.equal(s.investigators[0].resources,10)
 assert.equal(s.investigators[0].hand.length,0)
})
test('discarding to pay cannot be cancelled as an effect, but genuine after-discard notifications still happen once',()=>{
 const s=fixture();s.investigators[0].hand=['01093','01021'];asset(s,'testEarlyCannotCancelCost');asset(s,'testEarlyDiscardObserver')
 const resources=s.investigators[0].resources;move(s,entity(s));finish(s)
 assert.equal(s.investigators[0].hand.length,0);assert.equal(s.investigators[0].resources,resources+12)
})
test('ordinary discard plus icon payment retains a real Moonstone after-discard play and remaining payment',()=>{
 const s=fixture('testEarlyMixedHandCost');s.investigators[0].hand=['06203','01089'];s.investigators[0].resources=3
 move(s,entity(s));finish(s,c=>c.options.find(o=>o.cardCode==='06203'&&o.id.startsWith('desc:'))?.id??null)
 assert.equal(s.investigators[0].assets.filter(a=>a.code==='06203').length,1)
 assert.equal(s.investigators[0].hand.length,0);assert.equal(s.investigators[0].discard.includes('01089'),true)
 assert.equal(s.investigators[0].resources,10,'three Moonstone resources paid once, then cost ability benefit10')
})
test('controlled asset fee uses actor assets, not the shared ability source controller assets',()=>{
 const s=fixture('plain',2),source=asset(s,'testEarlySharedAssetCost',{},1),own=asset(s,'01021'),other=asset(s,'01021',{},1)
 const actorResources=s.investigators[0].resources,otherResources=s.investigators[1].resources
 const m=legalMoves(s).find(m=>m.action==='ability'&&m.assetId===source.id);assert.ok(m)
 move(s,m);assert.ok(s.pendingChoice);assert.deepEqual(s.pendingChoice.options.map(o=>o.id),[own.id])
 const saved=JSON.parse(JSON.stringify(s));finish(s);finish(saved)
 assert.equal(s.investigators[0].assets.some(a=>a.id===own.id),false);assert.equal(s.investigators[1].assets.some(a=>a.id===other.id),true)
 assert.equal(s.investigators[0].resources,actorResources+8);assert.equal(s.investigators[1].resources,otherResources)
 assert.deepEqual(saved.investigators,s.investigators)
})
test('no controlled asset, permanent, cannot-discard and dynamic leave prohibition all reject atomically',()=>{
 for(const reason of ['none','permanent','cannot-discard','cannot-leave','other-owner']){
  const s=fixture('testEarlyAssetCost',2)
  if(reason==='permanent')asset(s,'02158')
  if(reason==='cannot-discard')asset(s,'testEarlyCannotDiscardAsset')
  if(reason==='cannot-leave')asset(s,'testEarlyCannotLeaveAsset')
  if(reason==='other-owner')asset(s,'01021',{},1)
  const before=JSON.stringify(s);assert.equal(entity(s),undefined)
  assert.notEqual(validateMove(s,0,{action:'entityAbility',entityId:s.investigators[0].location,abilityIndex:0}),null)
  assert.equal(JSON.stringify(s),before)
 }
})
test('asset leave replacement to removed-from-game pays fee once without a duplicate discard',()=>{
 const s=fixture('testEarlyAssetCost'),joe=asset(s,'07150');const resources=s.investigators[0].resources
 move(s,entity(s));const saved=JSON.parse(JSON.stringify(s));finish(s);finish(saved)
 assert.equal(s.investigators[0].assets.some(a=>a.id===joe.id),false)
 assert.equal(s.removedFromGame.filter(c=>c==='07150').length,1);assert.equal(s.investigators[0].discard.includes('07150'),false)
 assert.equal(s.investigators[0].resources,resources+8);assert.deepEqual(saved.removedFromGame,s.removedFromGame)
})
test('controlled asset payment removes actor control but uses explicit true owner for the discard destination',()=>{
 const s=fixture('testEarlyAssetCost',2),borrowed=asset(s,'01021',{ownerSeat:1})
 const actorResources=s.investigators[0].resources,ownerResources=s.investigators[1].resources
 move(s,entity(s));finish(s)
 assert.equal(s.investigators[0].assets.some(a=>a.id===borrowed.id),false)
 assert.equal(s.investigators[0].discard.includes('01021'),false);assert.equal(s.investigators[1].discard.filter(c=>c==='01021').length,1)
 assert.equal(s.investigators[0].resources,actorResources+8);assert.equal(s.investigators[1].resources,ownerResources)
})
test('discardSelf plus discardControlledAsset reserves the source and needs a second physical asset',()=>{
 const s=fixture('plain'),source=asset(s,'testEarlySelfAssetCost')
 assert.equal(legalMoves(s).some(m=>m.action==='ability'&&m.assetId===source.id),false)
 const other=asset(s,'01021');move(s,legalMoves(s).find(m=>m.action==='ability'&&m.assetId===source.id))
 assert.ok(s.pendingChoice);assert.deepEqual(s.pendingChoice.options.map(o=>o.id),[other.id]);finish(s)
 assert.equal(s.investigators[0].discard.filter(c=>c==='testEarlySelfAssetCost').length,1)
 assert.equal(s.investigators[0].discard.filter(c=>c==='01021').length,1)
})
test('duplicate asset array references cannot count one physical id twice; distinct same-code copies can pay count2',()=>{
 const s=fixture('testEarlyTwoAssetCost'),same=asset(s,'01021');s.investigators[0].assets.push(same)
 const before=JSON.stringify(s);assert.equal(entity(s),undefined);assert.equal(JSON.stringify(s),before)
 const t=fixture('testEarlyTwoAssetCost');asset(t,'01021');asset(t,'01021');move(t,entity(t));finish(t)
 assert.equal(t.investigators[0].assets.length,0);assert.equal(t.investigators[0].discard.filter(c=>c==='01021').length,2)
})

registerCardAbilities([{code:'testEarlyDrawDuringCost',abilities:[{kind:'forced',trigger:'handCardDiscarded',criteria:({context})=>context.cardCode==='01021',resolve:({inv,api})=>api.drawCards(inv.seat,1)}]}])
test('sequential printed-icon cost offers a card genuinely drawn after its first discard',()=>{
 const s=fixture(),inv=s.investigators[0];inv.hand=['01021','01093'];inv.deck=['01089'];asset(s,'testEarlyDrawDuringCost')
 move(s,entity(s))
 finish(s,c=>chooseCard(c.options.some(o=>o.cardCode==='01089')?'01089':'01021')(c))
 assert.deepEqual(s.investigators[0].hand,['01093']);assert.deepEqual([...s.investigators[0].discard].sort(),['01021','01089']);assert.equal(s.investigators[0].deck.length,0)
})
