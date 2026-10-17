import { writeFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import assert from 'node:assert/strict'
import { createGameState, applyMove, validateMove } from '../src/engine/engine.js'
import { settings, playthrough } from './p6-playthrough.mjs'

const cases = [
  { id: 'gathering-burn', branch: 'r1', mode: 'victory', expected: 'r1' },
  { id: 'gathering-preserve', branch: 'r2', mode: 'victory', expected: 'r2' },
  { id: 'gathering-defeat', branch: 'r1', mode: 'failure', expected: 'noResolution' },
  { id: 'gathering-resign', branch: 'r1', mode: 'resign', expected: 'noResolution' },
]
const trajectories = cases.map(item => {
  const { state, trace } = playthrough('p6-0', { ...item, stopAfterFirst: true })
  assert.equal(state.resolution, item.expected)
  let replay = createGameState({ ...settings, seed: 'p6-0' }, [{ seat: 0 }])
  for (const entry of trace) {
    replay = JSON.parse(JSON.stringify(replay))
    assert.equal(validateMove(replay, entry.seat, entry.move), null)
    applyMove(replay, entry.seat, entry.move)
  }
  assert.deepEqual(JSON.parse(JSON.stringify(state)), replay)
  return { ...item, settings: { ...settings, seed: 'p6-0' }, players: [{ seat: 0 }],
    commandCount: trace.length, commands: trace.map(({ seat, move }) => ({ seat, move })),
    result: { uiState: state.uiState, resolution: state.resolution, records: state.campaign.records, trauma: state.campaign.trauma },
    stateSha256: createHash('sha256').update(JSON.stringify(state)).digest('hex') }
})
writeFileSync(new URL('../audit/p6-legal-trajectories.json', import.meta.url), JSON.stringify({
  scope: '从正式局外新游戏到集结结算；没有写入线索、敌人、牌堆、混乱袋或角色属性。不是三关战役胜利声明。',
  trajectories,
}, null, 2) + '\n')
console.log(JSON.stringify(trajectories.map(({ id, commandCount, result }) => ({ id, commandCount, result })), null, 2))
