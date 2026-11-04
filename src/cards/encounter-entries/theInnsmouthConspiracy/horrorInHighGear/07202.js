// 07202 油门踩死 · 全速恐惧（幕 1a）
//
// 印刷（中文）：
//   每个敌人获得猎手。
//   强制 - 当每个调查阶段结束时：每个运行的载具必须在其司机的选择下移动到一个连接的[[道路]]地点。
//   目标 - 尽快开到猎鹰岬！(要推进场景时，你会收到指示)。
// 印刷（英文）：
//   Each enemy gains hunter.
//   Forced - At the end of each investigation phase: Each vehicle that is running must move to a
//   connecting [[Road]] location of the driver's choice.
//   Objective - Drive to Falcon Point as fast as you can! (You will be instructed when to advance.)
//
// 引擎读点：
//   · 「每个敌人获得猎手」= 条目级 `actRule.enemiesGainHunter: true`；
//     读点：猎手关键字判定处汇总当前幕/议程条目的声明，对已入场与后入场的敌人都生效
//     （不写敌人实例快照字段）。
//   · 「调查阶段结束时每辆运行中的载具由司机选择移动」= `abilities` 的 forced +
//     trigger `investigationPhaseEnds`（windows.js 注册、turn.js 的 runBetweenInvestigationPhases
//     派发）。载具枚举走运行时入口：`state.storyAssets` + 调查员受控支援的物理卡，
//     逐个问 `api.mechanics.vehicles.record(id)`（mechanic-state 的只读视图）；「正在运行」
//     读 record.running，「司机」读 record.driver；移动走 `api.mechanics.vehicles.move`
//     （vehicles.js#moveVehicle：原子移动全部乘客、校验连接的[[道路]]地点）。
//   · 目标：「尽快开到猎鹰岬」是**剧情指示型**目标（印刷原文「推进场景时你会收到指示」）：
//     条目声明恒 false 的 `actRule.objective`，让审计「印刷含目标的幕必须有 objective」成立；
//     实际推进由 07203 猎鹰岬近郊的 `locationRule.objective`（全员到达后 checkAct 自动推进）
//     或章节剧情指示承担，本条目**不自动判定**、不误推进。
//   · 背面「(→结局1)」= `actRule.onReveal` → `api.finish('resolution1')`
//     （读点：content/.../entry-rules.js#actReveal；缺 onReveal 会 throw）。
//
// 共用模板位置：investigationPhaseEnds 窗口的既有写法见 07238 / _shared.js 的沉睡 boss 工厂；
// 载具驱动/移动读法见 07211a/07212a 与 07178。
//
// implemented：三句印刷正文均有读点与测试（tests/tic-middle-remaining.test.mjs）：
//   `actRule.enemiesGainHunter`（turn.js#enemyHasHunter）、forced investigationPhaseEnds、
//   `actRule.objective`（剧情指示型，恒 false）、`actRule.onReveal`（背面 (→结局1)）。

import { hasTrait } from '../../_shared.js'

// 载具的物理卡可以挂在 state.storyAssets（剧本支援）或调查员的 assets（受控支援）上。
// 枚举的是「物理卡实例」，运行状态/司机/位置仍只从 api.mechanics.vehicles.record 读。
function vehicleCarriers(state) {
  const seen = new Set()
  const rows = []
  for (const card of [...(state.storyAssets || []), ...state.investigators.flatMap(inv => inv.assets || [])]) {
    if (!card?.id || seen.has(card.id)) continue
    seen.add(card.id)
    rows.push(card)
  }
  return rows
}

export default {
  code: '07202',
  scope: 'act',
  implemented: true,
  actRule: {
    enemiesGainHunter: true,
    // 印刷「目标 - 尽快开到猎鹰岬！(要推进场景时，你会收到指示)」是剧情指示型目标：
    // 恒 false，推进由章节指示 / 07203 的地点 objective 承担，不自动判定。
    objective: () => false,
    onReveal(state, act, api) {
      api.finish('resolution1')
    },
  },
  abilities: [{
    kind: 'forced',
    trigger: 'investigationPhaseEnds',
    label: '调查阶段结束时：每辆运行中的载具由司机选择移动到一个连接的[[道路]]地点',
    resolve: ({ state, api }) => {
      for (const card of vehicleCarriers(state)) {
        const record = api.mechanics.vehicles.record(card.id)
        if (!record?.running || record.driver == null) continue
        const here = state.locations.find(location => location.id === record.location)
        const roads = (here?.connections || [])
          .map(id => state.locations.find(location => location.id === id))
          .filter(location => location && hasTrait(location, 'Road'))
        if (!roads.length) continue
        const answer = api.choice({
          kind: 'location', source: '07202', seat: record.driver,
          prompt: `「${card.name || card.code}」在调查阶段结束时移动到哪个连接的[[道路]]地点？`,
          options: roads.map(location => ({ id: location.id, label: location.name })),
        })
        const destination = roads.find(location => location.id === answer) || roads[0]
        api.mechanics.vehicles.move(card.id, destination.id)
      }
    },
  }],
}
