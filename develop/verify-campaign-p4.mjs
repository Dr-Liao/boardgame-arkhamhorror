// develop/verify-campaign-p4.mjs —— Phase 4 战役流程验证：强制推进三关，校验战役连动与剧本布置。
import { createGameState, applyMove, validateMove, legalMoves, describeState } from '../games/arkhamhorror/engine.js'

const settings = { difficulty: 'standard', playerInvestigator: '01001' }
const players = [{ seat: 0, persona: '人类' }, { seat: 1, persona: '学者' }]
const state = createGameState(settings, players)

function dump(tag) {
  console.log('\n===== ' + tag + ' =====')
  console.log('scenario:', state.scenario.id, '| 幕:', state.actIndex, '| 议程:', state.agendaIndex, '| 毁灭:', state.doom, '| 线索:', state.clues)
  console.log('campaign:', JSON.stringify({ idx: state.campaign.scenarioIndex, victory: state.campaign.victory, xp: state.campaign.xp, records: state.campaign.records, finished: state.campaign.finished }))
  console.log('locations:', state.locations.map((l) => `${l.name}(${l.id}) 线索${l.clues}`).join(' | '))
  console.log('enemies:', state.enemies.map((e) => `${e.name}(${e.location})`).join(' | ') || '无')
  console.log('encounterDeck:', state.encounterDeck.length, '| cultistDeck:', state.cultistDeck.length, '| chaosBag:', state.chaosBag.length)
  console.log('investigators:', state.investigators.map((i) => `${i.name}@${i.location} ${i.maxHealth - i.damage}/${i.maxHealth}hp ${i.maxSanity - i.horror}/${i.maxSanity}sp`).join(' | '))
}

function apply(action) {
  const err = validateMove(state, state.currentSeat, action)
  if (err) throw new Error('校验失败: ' + err + ' ' + JSON.stringify(action))
  applyMove(state, state.currentSeat, action)
}

dump('初始（第一关·集结）')

// 第一关：集齐线索推进幕 1 → 幕 2 → 击败食尸鬼祭司。
state.clues = 4
apply({ action: 'resource' })
dump('幕1推进后（打开走廊）')
if (state.scenario.id !== 'theGathering') throw new Error('仍在第一关')

state.clues = 6
apply({ action: 'resource' })
dump('幕2推进后（揭示客厅 + 食尸鬼祭司）')
if (state.actIndex !== 2) throw new Error('应在幕 3')

// 移除食尸鬼祭司，触发幕 3 目标（击败首领）→ 结局 R2 → 进入第二关。
state.enemies = state.enemies.filter((e) => e.code !== 'ghoulPriest')
apply({ action: 'resource' })
dump('第一关结束后（应进入第二关·午夜假面）')
if (state.scenario.id !== 'theMidnightMasks') throw new Error('应进入第二关')
if (state.campaign.scenarioIndex !== 1) throw new Error('战役索引应为 1')
if (state.campaign.records.ghoulPriestAlive !== false) throw new Error('食尸鬼祭司应被标记为已击败')
if (state.campaign.records.houseBurned !== false) throw new Error('房屋应仍在')

// 第二关：强制盘问 6 名独特异教徒 → 幕推进 → 结局 R1 → 进入第三关。
state.cultistsInVictory = ['wolfManDrew', 'hermanCollins', 'peterWarren', 'victoriaDevereux', 'ruthTurner', 'theMaskedHunter']
apply({ action: 'resource' })
dump('第二关结束后（应进入第三关·地底噬魔）')
if (state.scenario.id !== 'theDevourerBelow') throw new Error('应进入第三关')
if (state.campaign.scenarioIndex !== 2) throw new Error('战役索引应为 2')
if (!state.campaign.records.cultistsInterrogated || state.campaign.records.cultistsInterrogated.length !== 6) throw new Error('应记录盘问的异教徒')

// 第三关：幕 1 推进 → 幕 2 → 幕 3 → 破坏仪式 → 结局 R1 → 战役胜利。
state.clues = 3 * state.numInvestigators
apply({ action: 'resource' })
dump('第三关·幕1推进后')
if (state.actIndex !== 1) throw new Error('应在幕 2')
if (!state.locations.some((l) => l.id === 'ritualSite')) throw new Error('仪式地应已入场')

// 幕 2：进入仪式地（通过移动触发 enterLocation 目标）。
// 主道路已与仪式地相连；直接移动过去。
apply({ action: 'move', locationId: 'ritualSite' })
dump('第三关·幕2推进后（进入仪式地）')
if (state.actIndex !== 2) throw new Error('应在幕 3')

// 幕 3：破坏仪式进度拉满 → 幕推进 → 结局 R1 → 战役胜利。
state.actClues = 2 * state.numInvestigators
apply({ action: 'resource' })
dump('第三关结束后（战役完成）')
if (state.status !== 'over') throw new Error('战役应结束')
if (state.outcome !== 'victory') throw new Error('应为胜利')
if (!state.campaign.finished) throw new Error('战役应标记完成')
console.log('\n✅ 战役流程验证通过。')
console.log('累计胜利点:', state.campaign.victory, '| 经验:', state.campaign.xp)
