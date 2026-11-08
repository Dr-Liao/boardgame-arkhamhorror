// P8《地球边缘》战役验收：真实大厅驱动完整主线、检查点/幕间分支、失败结局、
// 伙伴记录、四档难度开局、存档恢复与 replay 确定性。
//
// 主线事实（真实 hub 探针）：致命幻景在幕间 1/2/3 各可进入一次，因此完整路线的
// 章节运行次数多于 8 个「章节单元」；fixture 的 SCENARIO_IDS 仍是 8 个唯一章节 id。
//   · 全开门（默认选项）：part1,part2,part3,FM,peaks,FM,city,FM,heart1,heart2 → campaignResult
//   · 检查点 I 放弃：part1,FM,peaks,FM,city,FM,heart1,heart2（跳过 part2/3）
//   · 检查点 II 逃进群山：part1,part2,FM,peaks,FM,city,FM,heart1,heart2（跳过 part3）
//   · 忽略幕间门：致命幻景只在幕间 2/3 进入（eoteFatalMirageEntries=2）
import test from 'node:test'
import assert from 'node:assert/strict'
import {
  loadEoteWorld, INVESTIGATOR_CODES, createHubGame, hubSetup, finishScenario,
  continueFromResult, beginChapter, saveAndRestore, walkCampaign,
} from './eote-p8-fixture.mjs'
import { PARTNER_CODES, recordDefaults } from '../content/campaigns/edgeOfTheEarth/records.js'
import { CHAOS_BAGS } from '../content/campaigns/edgeOfTheEarth/shared.js'

const world = await loadEoteWorld()

const PART1 = 'iceAndDeathPart1'
const PART2 = 'iceAndDeathPart2'
const PART3 = 'iceAndDeathPart3'
const MIRAGE = 'fatalMirage'
const PEAKS = 'toTheForbiddenPeaks'
const CITY = 'cityOfTheElderThings'
const HEART1 = 'theHeartOfMadnessPart1'
const HEART2 = 'theHeartOfMadnessPart2'

// 各分支的真实章节运行序列（含致命幻景的多次进入）。
const BRANCHES = Object.freeze({
  full: {
    answers: { checkpoint2Choice: 'stand' },
    sequence: [PART1, PART2, PART3, MIRAGE, PEAKS, MIRAGE, CITY, MIRAGE, HEART1, HEART2],
    fatalMirageEntries: 3,
  },
  abandonCheckpoint1: {
    answers: { checkpoint1Choice: 'abandon' },
    sequence: [PART1, MIRAGE, PEAKS, MIRAGE, CITY, MIRAGE, HEART1, HEART2],
    fatalMirageEntries: 3,
  },
  fleeCheckpoint2: {
    answers: { checkpoint2Choice: 'flee' },
    sequence: [PART1, PART2, MIRAGE, PEAKS, MIRAGE, CITY, MIRAGE, HEART1, HEART2],
    fatalMirageEntries: 3,
  },
  ignoreMirageDoors: {
    answers: { checkpoint2Choice: 'stand', interlude1DoorChoice: 'ignore' },
    sequence: [PART1, PART2, PART3, PEAKS, MIRAGE, CITY, MIRAGE, HEART1, HEART2],
    fatalMirageEntries: 2,
  },
})

/** 按分支答案驱动一次完整战役（真实大厅 + 引擎 debug endScenario）。 */
function walk(branchKey, options = {}) {
  const branch = BRANCHES[branchKey]
  return walkCampaign(world, {
    seats: 2, seed: `eote-p8-${branchKey}`,
    investigatorCodes: INVESTIGATOR_CODES.slice(0, 2),
    maxChapters: branch.sequence.length,
    expectedScenarios: branch.sequence,
    storySelect: (choice, state) => {
      const wanted = branch.answers[state.campaign?.flow?.nodeId]
      if (!wanted) return null
      return choice.options.some(option => option.id === wanted) ? wanted : null
    },
    ...options,
  })
}

// ---------------------------------------------------------------------------
// 1. 完整主线
// ---------------------------------------------------------------------------
test('P8 eote campaign 完整主线：全部章节单元结算并抵达战役结束（含致命幻景 3 次进入）', () => {
  const branch = BRANCHES.full
  const result = walk('full')
  assert.deepEqual(result.chapters.map(chapter => chapter.scenarioId), branch.sequence)
  assert.equal(result.state.campaign.records.eoteFatalMirageEntries, branch.fatalMirageEntries)
  assert.equal(result.state.uiState, 'campaignResult')
  assert.equal(result.state.status, 'over')
  assert.equal(result.state.campaign.flow.nodeId, 'end')
  // 每个章节都拿到真实结局键（debug endScenario 是 CONTRACT §3 的合法引擎动作）。
  for (const chapter of result.chapters) assert.ok(chapter.resolution, `${chapter.scenarioId} 未结算`)
  // 8 个章节单元全部被走到。
  for (const id of [PART1, PART2, PART3, MIRAGE, PEAKS, CITY, HEART1, HEART2]) {
    assert.ok(result.chapters.some(chapter => chapter.scenarioId === id), `主线缺少 ${id}`)
  }
  assert.ok(result.hashes.length >= result.chapters.length * 2, '应记录章节边界状态指纹')
})

// ---------------------------------------------------------------------------
// 2. 检查点分支
// ---------------------------------------------------------------------------
test('P8 eote campaign 检查点 I「放弃」跳过亡命冰原 II/III', () => {
  const branch = BRANCHES.abandonCheckpoint1
  const result = walk('abandonCheckpoint1')
  const ids = result.chapters.map(chapter => chapter.scenarioId)
  assert.deepEqual(ids, branch.sequence)
  assert.equal(ids.includes(PART2), false, '放弃后不应进入第 II 部分')
  assert.equal(ids.includes(PART3), false, '放弃后不应进入第 III 部分')
  assert.ok(ids.includes(PEAKS), '放弃后应继续失落之峰')
})

test('P8 eote campaign 检查点 II「逃进群山」跳过亡命冰原 III 并记录逃跑', () => {
  const branch = BRANCHES.fleeCheckpoint2
  const result = walk('fleeCheckpoint2')
  const ids = result.chapters.map(chapter => chapter.scenarioId)
  assert.deepEqual(ids, branch.sequence)
  assert.ok(ids.includes(PART2), '先走第 II 部分')
  assert.equal(ids.includes(PART3), false, '逃进群山后跳过第 III 部分')
  assert.equal(result.state.campaign.records.theTeamFledToTheMountains, true, '应记录「逃进群山」')
})

// ---------------------------------------------------------------------------
// 3. 致命幻景进入/跳过/回场
// ---------------------------------------------------------------------------
test('P8 eote campaign 致命幻景：幕间进入后回场、忽略幕间门则该次不进入', () => {
  const entered = walk('full')
  const enteredIds = entered.chapters.map(chapter => chapter.scenarioId)
  assert.equal(enteredIds.filter(id => id === MIRAGE).length, 3, '三次幕间都应进入致命幻景')
  // 回场：不存在连续两次致命幻景。
  for (let index = 0; index < enteredIds.length - 1; index += 1) {
    assert.equal(enteredIds[index] === MIRAGE && enteredIds[index + 1] === MIRAGE, false, '致命幻景后应回场')
  }
  assert.deepEqual(enteredIds.slice(0, 5), [PART1, PART2, PART3, MIRAGE, PEAKS], '幕间 1 进入后回到失落之峰')
  // 忽略幕间 1 的门：该次不进入，之后幕间 2/3 仍可进入。
  const skipped = walk('ignoreMirageDoors')
  const skippedIds = skipped.chapters.map(chapter => chapter.scenarioId)
  assert.equal(skippedIds.filter(id => id === MIRAGE).length, 2)
  assert.deepEqual(skippedIds.slice(0, 4), [PART1, PART2, PART3, PEAKS], '忽略门后直接进入失落之峰')
  assert.equal(skipped.state.campaign.records.eoteFatalMirageEntries, 2)
})

// ---------------------------------------------------------------------------
// 4. 失败/撤退结局
// ---------------------------------------------------------------------------
test('P8 eote campaign 失败/撤退结局：noResolution 结算被记录且战役可继续', () => {
  const codes = INVESTIGATOR_CODES.slice(0, 2)
  const state = createHubGame(world, { seats: 2, seed: 'eote-p8-fail', investigatorCodes: codes })
  hubSetup(world, state, { investigatorCodes: codes })
  finishScenario(world, state, 'noResolution')
  assert.equal(state.campaign.scenarioResults.at(-1)?.resolution, 'noResolution')
  assert.equal(state.uiState, 'scenarioResult')
  continueFromResult(world, state, { upgrades: false })
  assert.ok(['scenarioSetup', 'campaignResult', 'interlude'].includes(state.uiState)
    || state.status !== 'playing', `失败结局后状态异常：${state.uiState}/${state.status}`)
  assert.ok((state.campaign.scenarioResults || []).length >= 1)
})

// ---------------------------------------------------------------------------
// 5. 伙伴记录
// ---------------------------------------------------------------------------
test('P8 eote campaign 伙伴记录：9 名伙伴都有状态记录（全存/全灭分支可解析）', () => {
  const result = walk('full')
  const records = result.state.campaign.records
  const statuses = Array.isArray(records.eotePartnerStatuses) ? records.eotePartnerStatuses : []
  const byCode = new Map(statuses.map(entry => {
    const [code, status] = String(entry).split(':')
    return [code, status]
  }))
  for (const code of PARTNER_CODES) {
    assert.ok(byCode.has(code), `伙伴 ${code} 缺少状态记录（eotePartnerStatuses）`)
    assert.ok(String(byCode.get(code)).length > 0, `伙伴 ${code} 状态为空`)
  }
  assert.equal(byCode.size, PARTNER_CODES.length, '9 名伙伴各一条状态')
  for (const key of ['eotePartnerStatuses', 'eoteMissingPartners', 'eoteCheckedPartners', 'resolutePartners']) {
    assert.ok(Array.isArray(recordDefaults[key]), `${key} 默认值应为数组`)
  }
  assert.equal(typeof recordDefaults.eoteEliminatedPartners, 'number')
})

// ---------------------------------------------------------------------------
// 6. 四档难度开局
// ---------------------------------------------------------------------------
test('P8 eote campaign 四档难度：开局混乱袋 = 基础袋 + 本章 setup 追加的 1 个 cultist', () => {
  for (const difficulty of ['easy', 'standard', 'hard', 'expert']) {
    const codes = INVESTIGATOR_CODES.slice(0, 2)
    const state = createHubGame(world, { seats: 2, difficulty, seed: `eote-p8-${difficulty}`, investigatorCodes: codes })
    hubSetup(world, state, { investigatorCodes: codes })
    const expected = [...CHAOS_BAGS[difficulty], 'cultist'].sort()
    assert.deepEqual([...state.chaosBag].sort(), expected, `${difficulty} 开局混乱袋不一致`)
    assert.equal(state.chaosBag.filter(token => token === 'frost').length,
      CHAOS_BAGS[difficulty].filter(token => token === 'frost').length, `${difficulty} frost 数量不一致`)
    assert.equal(state.chaosBag.filter(token => token === 'cultist').length, 2, `${difficulty} cultist 数量`)
    assert.equal(state.investigators.length, 2)
  }
})

// ---------------------------------------------------------------------------
// 7. 存档恢复
// ---------------------------------------------------------------------------
test('P8 eote campaign 存档恢复：检查点/幕间后 JSON → migrateState 往返可继续', () => {
  const codes = INVESTIGATOR_CODES.slice(0, 2)
  const state = createHubGame(world, { seats: 2, seed: 'eote-p8-save', investigatorCodes: codes })
  hubSetup(world, state, { investigatorCodes: codes })
  const firstId = state.scenario.id
  finishScenario(world, state, Object.keys(state.scenario.resolutions)[0])
  continueFromResult(world, state, { upgrades: false })
  assert.equal(state.uiState, 'scenarioSetup', '第一章后应进入下一章准备')
  const saved = saveAndRestore(world, state)
  assert.deepEqual(saved.secondChanges, [], 'migrateState 应幂等')
  assert.equal(saved.state.uiState, 'scenarioSetup')
  beginChapter(world, saved.state)
  assert.equal(saved.state.uiState, 'inScenario')
  assert.notEqual(saved.state.scenario.id, firstId)
  // 同一份 JSON 连续两次迁移：第二轮无变更。
  const second = world.saveMigration.migrateState(JSON.parse(saved.text))
  assert.deepEqual(second.changes, saved.changes)
  assert.deepEqual(second.secondChanges ?? [], [])
})

// ---------------------------------------------------------------------------
// 8. replay 章节边界指纹
// ---------------------------------------------------------------------------
test('P8 eote campaign replay：同 seed 两次同脚本的章节边界状态指纹一致', () => {
  const first = walk('full', { maxChapters: 4 })
  const second = walk('full', { maxChapters: 4 })
  assert.deepEqual(first.chapters.map(chapter => chapter.scenarioId), second.chapters.map(chapter => chapter.scenarioId))
  assert.deepEqual(first.hashes, second.hashes, '同 seed 同脚本的章节边界状态指纹应一致')
  assert.deepEqual(first.chapters.slice(0, 4).map(chapter => chapter.scenarioId), [PART1, PART2, PART3, MIRAGE])
})
