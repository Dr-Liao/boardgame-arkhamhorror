import test from 'node:test'
import assert from 'node:assert/strict'
import { loadTdeCampaignWorld, hubSetup, hubBegin, settleParallelLaneChoices } from './tde-p95-fixture.mjs'

async function parallelFixture() {
  const world = await loadTdeCampaignWorld()
  const state = hubSetup(world.engine, { seats: 2, mode: 'parallel', seed: 'tde-completion' })
  state.humanSeats = [0, 1]
  hubBegin(world.engine, state, { viaMod: true, mod: world.mod })
  settleParallelLaneChoices(world.engine, world.mod, state)
  return { ...world, state }
}
function readShared(world) {
  for (let n=0; world.state.parallel.interlude && n<80; n++) {
    const q=world.state.parallel.interlude.state.pendingChoice
    assert.ok(q)
    const view=world.mod.viewState(world.state,q.seat)
    assert.equal(view.parallel.shared,true)
    assert.ok(view.legalMoves.length)
    world.mod.applyMove(world.state,q.seat,{action:'choose',choiceId:q.id,optionId:q.options[0].id})
  }
  assert.equal(world.state.parallel.interlude,undefined)
}

test('TDE completion: parallel shared interlude applies both bags once, confirms both humans and survives JSON', async () => {
  const w=await parallelFixture(), s=w.state
  for (const lane of ['A','B']) {
    const st=s.parallel.lanes[lane]
    w.mod.applyMove(s,st.laneRuntime.roomSeats[0],{action:'debug',kind:'endScenario',resolutionKey:'resolution1'})
    settleParallelLaneChoices(w.engine,w.mod,s)
  }
  const before=Object.fromEntries(['A','B'].map(l=>[l,s.parallel.lanes[l].chaosBag.filter(t=>t==='elderthing').length]))
  assert.ok(s.parallel.sealed[1])
  assert.ok(w.mod.legalMoves(s,0).some(m=>m.action==='hubContinue'))
  w.mod.applyMove(s,0,{action:'hubContinue'})
  assert.ok(s.parallel.interlude)
  const text=w.parallelRuntime.serializeParallelState(s)
  w.state=w.parallelRuntime.restoreParallelState(text)
  assert.equal(w.parallelRuntime.serializeParallelState(w.state),text)
  const confirmations=[]
  while(w.state.parallel.interlude){
    const q=w.state.parallel.interlude.state.pendingChoice
    if(q.kind==='interlude') confirmations.push(q.seat)
    w.mod.applyMove(w.state,q.seat,{action:'choose',choiceId:q.id,optionId:q.options[0].id})
  }
  assert.deepEqual(confirmations,[0,1])
  settleParallelLaneChoices(w.engine,w.mod,w.state)
  for (const lane of ['A','B']) {
    const st=w.state.parallel.lanes[lane]
    assert.equal(st.campaign.phase,'interlude')
    assert.equal(st.campaign.upgradesAllowed,true)
    for(const seat of st.laneRuntime.roomSeats) {
      const done=w.mod.legalMoves(w.state,seat).find(m=>m.action==='hubDoneSeat')
      if(done) w.mod.applyMove(w.state,seat,done)
      settleParallelLaneChoices(w.engine,w.mod,w.state)
    }
    const seat=st.laneRuntime.roomSeats[0]
    const begin=w.mod.legalMoves(w.state,seat).find(m=>m.action==='hubBeginScenario')
    assert.ok(begin)
    w.mod.applyMove(w.state,seat,begin)
    settleParallelLaneChoices(w.engine,w.mod,w.state)
  }
  assert.equal(w.state.parallel.lanes.A.scenario.id,'theSearchForKadath')
  assert.equal(w.state.parallel.lanes.B.scenario.id,'aThousandShapesOfHorror')
  for(const lane of ['A','B']) assert.equal(w.state.parallel.lanes[lane].chaosBag.filter(t=>t==='elderthing').length,before[lane]+1)
  const stable=JSON.stringify(w.state)
  assert.equal(w.parallelRuntime.advanceParallelPair(w.state,1).alreadyApplied,true)
  assert.equal(JSON.stringify(w.state),stable)
})
