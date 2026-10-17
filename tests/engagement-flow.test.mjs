import test from 'node:test'
import assert from 'node:assert/strict'
import { createGameState, applyMove, legalMoves, validateMove, decisionSeat } from '../src/engine/engine.js'
import { targetMoves } from '../web/card-interactions.js'
import { scenario } from '../content/campaigns/nightOfTheZealot/scenarios/theGathering/definition.js'

function settle(s) {
  for (let i=0;s.pendingChoice;i++) {
    assert.ok(i<100)
    const c=s.pendingChoice
    applyMove(s,c.seat,{action:'choose',choiceId:c.id,optionId:c.options.find(o=>['done','skip','self'].includes(o.id))?.id || c.options[0].id})
  }
}
function game() {
  const s=createGameState({seed:'engagement-flow',playerInvestigator:'01001'},[{seat:0,role:'human'},{seat:1,role:'human'},{seat:2,role:'ai'}])
  settle(s);s.campaign.leadSeat=1;s.currentSeat=0;s.turnSeat=0
  s.locations=['hallway','attic','cellar'].map(id=>({...scenario.locations[id],revealed:id!=='cellar',clues:0,maxClues:2}))
  for(const inv of s.investigators){inv.location='attic';inv.assets=[];inv.threat=[];inv.hand=[];inv.actionsLeft=3}
  s.investigators[0].location='hallway'
  return s
}
test('局外仅真人可选队长，多真人须选定后才能开始；单真人自动指定',()=>{
  const s=createGameState({campaignHub:true,seed:'leader'},[{seat:0,role:'human'},{seat:1,role:'human'},{seat:2,role:'ai'}])
  assert.equal(s.campaign.leadConfirmed,false)
  assert.deepEqual(legalMoves(s).filter(m=>m.action==='hubSetLeader').map(m=>m.leadSeat),[0,1])
  assert.ok(validateMove(s,0,{action:'hubSetLeader',leadSeat:2}))
  s.uiState='scenarioSetup';s.hubReady=true
  assert.ok(!legalMoves(s).some(m=>m.action==='hubBeginScenario'))
  applyMove(s,0,{action:'hubSetLeader',leadSeat:1})
  assert.equal(s.campaign.leadSeat,1);assert.equal(s.campaign.leadConfirmed,true)
  assert.ok(legalMoves(s).some(m=>m.action==='hubBeginScenario'))
  const solo=createGameState({campaignHub:true,seed:'solo'},[{seat:0,role:'human'},{seat:1,role:'ai'}])
  assert.equal(solo.campaign.leadSeat,0);assert.equal(solo.campaign.leadConfirmed,true)
})
test('猎物并列由局外队长选角色，拖动对应怪物可恢复并完成结算',()=>{
  const s=game()
  s.enemies=[{id:'e-prey',code:'01160',name:'食尸鬼爪牙',location:'attic',engagedSeat:null,fight:2,evade:2,health:2,damageTaken:0,exhausted:false}]
  applyMove(s,0,{action:'move',locationId:'attic'})
  assert.equal(s.pendingChoice.kind,'prey');assert.equal(decisionSeat(s),1)
  assert.equal(s.pendingChoice.source.id,'e-prey')
  s.legalMoves=legalMoves(s)
  const moves=targetMoves(s,'enemy:e-prey','investigator:0')
  assert.equal(moves.length,1);assert.equal(moves[0].optionId,'0')
  assert.equal(targetMoves(s,'enemy:other','investigator:0').length,0)
  applyMove(s,1,moves[0]);settle(s)
  assert.equal(s.enemies[0].engagedSeat,0)
  assert.equal(s.investigators[0].actionsLeft,2)
})
test('主动拉取同地点敌人消耗一次行动，不允许远处敌人或错误角色目标',()=>{
  const s=game();s.investigators[0].location='attic'
  s.enemies=[{id:'e-pull',code:'01160',name:'食尸鬼爪牙',location:'attic',engagedSeat:2,fight:2,evade:2,health:2,damageTaken:0,exhausted:true}]
  s.investigators[2].engaged=['e-pull'];s.legalMoves=legalMoves(s)
  const move=targetMoves(s,'enemy:e-pull','zone:engage')[0]
  assert.equal(move.action,'engage')
  assert.equal(targetMoves(s,'enemy:e-pull','investigator:1').length,0)
  assert.equal(targetMoves(s,'enemy:e-pull','investigator:0').length,1)
  applyMove(s,0,move);settle(s)
  assert.equal(s.enemies[0].engagedSeat,0);assert.equal(s.investigators[0].actionsLeft,2)
  s.enemies[0].location='cellar'
  assert.ok(validateMove(s,0,{action:'engage',enemyId:'e-pull'}))
})
test('地点揭示演出保留实际进入者，队友不会被误认为本地玩家',()=>{
  const s=game();s.currentSeat=2;s.turnSeat=2;s.investigators[2].location='hallway'
  const events=applyMove(s,2,{action:'move',locationId:'cellar'})
  const reveal=events.find(e=>e.presentation?.kind==='location')
  assert.equal(reveal.presentation.seat,2);assert.equal(reveal.presentation.location,'cellar')
})
