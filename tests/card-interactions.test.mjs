import test from 'node:test'
import assert from 'node:assert/strict'
import { choicePresentation, entityMoves, targetMoves } from '../web/card-interactions.js'
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

test('weapon with one enemy exposes an explicit legal target and resolves through the normal test', () => {
  const st=createGameState({playerInvestigator:'01001',seed:'direct-target'},[{seat:0,name:'玩家'}])
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
