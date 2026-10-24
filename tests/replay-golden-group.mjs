// golden replay 分组重放：每个分组文件调用一次 registerGoldenReplayTests(group, label)。
// 拆成三个文件是为了让 13 局基线按重放成本并行（文件是 node --test 的最小并行单位）。
import test from 'node:test'
import assert from 'node:assert/strict'
import { replayLog, STATE_HASH_VERSION, stateHash } from '../src/engine/replay.js'
import { fixturesOf, replayTrail, sampledFixtures } from './replay-golden-fixtures.mjs'

export function registerGoldenReplayTests(groupName, label) {
  const group = fixturesOf(groupName)

  test(`${label}：每一局都重放出完全相同的逐步指纹与最终状态`, () => {
    for (const fixture of group) {
      const { log, hashes, final } = fixture
      assert.equal(fixture.log.meta.hashVersion, STATE_HASH_VERSION, `${fixture.id}：基线的指纹版本`)
      assert.equal(hashes.length, log.moves.length + 1, `${fixture.id}：逐步指纹数量`)
      const trail = replayTrail(log)
      assert.deepEqual(trail.hashes, hashes, `${fixture.id}：重放的逐步指纹必须与基线一致`)
      assert.equal(stateHash(trail.state), hashes[hashes.length - 1], `${fixture.id}：最终指纹`)
      assert.equal(trail.state.uiState, final.uiState, `${fixture.id}：uiState`)
      assert.equal(trail.state.status, final.status, `${fixture.id}：status`)
      assert.equal(trail.state.scenario?.id ?? null, final.scenario, `${fixture.id}：关卡`)
      assert.equal(trail.state.revision, final.revision, `${fixture.id}：版本号`)
      assert.equal(trail.state.pendingChoice ? trail.state.pendingChoice.kind : null, final.pendingChoice, `${fixture.id}：待决选择`)
    }
  })

  // 抽样做"存读档 / 差分"的等价检查：全量重复重放会把 fast tier 拖长，
  // 而这两条链路（JSON 往返、until 前缀）已经被上一条用例的逐步指纹覆盖到同一次重放里。
  test(`${label}：JSON 往返与 \`until\` 前缀都不改变指纹（存读档、撤销、差分共用同一条链路）`, () => {
    for (const fixture of sampledFixtures(group)) {
      const last = fixture.log.moves.length
      const restored = JSON.parse(JSON.stringify(fixture.log))
      assert.deepEqual(replayTrail(restored).hashes, fixture.hashes, `${fixture.id}：日志 JSON 往返`)
      assert.equal(stateHash(replayLog(restored, { until: 0 })), fixture.hashes[0], `${fixture.id}：until=0`)
      assert.equal(stateHash(replayLog(restored, { until: last })), fixture.hashes[last], `${fixture.id}：until=末步`)
    }
  })
}

