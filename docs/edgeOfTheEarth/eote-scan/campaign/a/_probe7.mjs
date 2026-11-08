// scratch probe (auditor A) — camp record keys written by Part1 resolution + checkpoint shelter
import { loadEoteWorld, createHubGame, hubSetup, finishScenario, legalFor, playMove, settleChoices, decisionSeat }
  from 'file:///G:/boardgame-hall-ai/games/arkhamhorror/tests/eote-p8-fixture.mjs'

const world = await loadEoteWorld()
const out = []
const log = (...p) => out.push(p.join(' '))
const state = createHubGame(world, { seats: 2, seed: 'audit-a-camp', investigatorCodes: ['08001', '08004'] })
hubSetup(world, state, { investigatorCodes: ['08001', '08004'] })
log('scenario=', state.scenario.id)
// 真实场景动作：camp resign 是否出现
let moves = legalFor(world, state, decisionSeat(world, state))
log('legalActions=', [...new Set(moves.map(m => m.action))].join(','))
log('scenarioAction moves=', moves.filter(m => m.action === 'scenarioAction').map(m => m.label).join('|') || '(none)')
// 用 debug 结算 Part1
finishScenario(world, state, 'resolution1')
const records = state.campaign.records
const campKeys = Object.keys(records).filter(k => /camp|Camp|shelter|Shelter/.test(k))
log('Part1 records camp/shelter keys=', campKeys.join(',') || '(none)', 'values=', JSON.stringify(Object.fromEntries(campKeys.map(k => [k, records[k]]))))
// 继续到 checkpoint 后
playMove(world, state, { action: 'hubContinue' }, 0)
settleChoices(world, state)
log('after continue uiState=', state.uiState)
log('eoteShelterValue=', state.campaign.records.eoteShelterValue, 'eoteMissingCount=', state.campaign.records.eoteMissingCount)
console.log(out.join('\n'))
