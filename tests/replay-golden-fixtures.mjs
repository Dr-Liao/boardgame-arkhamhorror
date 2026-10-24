// golden replay 测试共用的基线加载与重放工具。
//
// 2026-10-24 P0/P1 拆分：13 局基线按战役拆进三个测试文件并行重放（原来一个文件串行 ≈86s，
// 引擎热点修复后仍有 ~27s，是 fast tier 的关键路径）；基线一致性、动作覆盖率与
// 「停在待决选择」的门禁留在 replay-golden.test.mjs（只读 JSON，不重放整局）。
import fs from 'node:fs'
import { stateHash } from '../src/engine/replay.js'
import { replayLog } from '../src/engine/replay.js'

export const FIXTURES = JSON.parse(fs.readFileSync(new URL('./fixtures/replay/golden-replays.json', import.meta.url), 'utf8'))
export const TOTAL_STEPS = FIXTURES.fixtures.reduce((sum, fixture) => sum + fixture.log.moves.length, 0)

// 分组按「重放成本」而不是单纯战役切：midnight-masks 一局 152 步比其它 8 局 notz 合计还大，
// 单独和 midnight-masks-only 放一组；strict 3 人随机局（80 步且带 JSON 往返抽样）补到跨战役组，
// 让三组的重放步数（含抽样重复）大致均衡。
export const GROUPS = Object.freeze({
  'notz-gathering': Object.freeze(['notz-gathering-hub-victory-r1', 'notz-gathering-hub-victory-r2', 'notz-gathering-defeat',
    'notz-gathering-resign', 'notz-gathering-pending-choice']),
  'notz-long': Object.freeze(['notz-midnight-masks', 'notz-midnight-masks-only']),
  campaigns: Object.freeze(['carcosa-curtain-call-hub', 'carcosa-curtain-call-only', 'dunwich-extracurricular-hub',
    'tfa-untamed-wilds-hub', 'tfa-untamed-wilds-only', 'notz-strict-random-3p']),
})

export function fixturesOf(groupName) {
  const ids = GROUPS[groupName]
  if (!ids) throw new Error(`未知 golden replay 分组：${groupName}`)
  return FIXTURES.fixtures.filter(fixture => ids.includes(fixture.id))
}

// 一次重放拿到全部中间指纹与最终状态：比"逐步重复重放"快一个数量级（O(n) 而不是 O(n²)）。
export function replayTrail(log) {
  const hashes = []
  const state = replayLog(log, { observe: snapshot => hashes.push(stateHash(snapshot)) })
  return { hashes, state }
}

// 抽样做"存读档 / 差分"的等价检查：沿用原实现的每 3 局取 1 局（按基线里的全局顺序）。
export function sampledFixtures(group) {
  return group.filter(fixture => FIXTURES.fixtures.indexOf(fixture) % 3 === 0)
}
