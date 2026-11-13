// 09587 阴影笼罩（Shadowed）· 诡计 · dealings_in_the_dark
// 卡面：显现 - 如果场上没有[[异教徒]]敌人，受到 1 点恐惧，且阴影笼罩获得涌动。否则，找到离你最近的
//       [[异教徒]]敌人。在该敌人上放置 1 个毁灭标记并检定[willpower](X)，X 等于该敌人的攻击值。
//       如果你检定失败，受到 2 点恐惧。
// 读点：
//   · 显现入口 = 条目的 `encounterResolve`（treachery-tokens.js 在 entryRevelation 时直接调用，
//     第 4 参就是场景运行时的窄接口 —— 这里只用它的顶层方法，不用 api.scenario）。
//   · 「最近的[[异教徒]]」= api.resolveScenarioEvent('dealingsNearestCultist')
//     （本章 behavior 只实现一次；09585/09588 共用同一句）。
//   · 放置毁灭 = api.doomOn（敌人毁灭的唯一写入口）。
//   · 检定 = api.test(seat, skill, difficulty, resolve)（剧本运行时检定，支持重放）。
//   · 涌动 = 返回 { gainSurge: true }（encounter.js#finishDraw 读 resolution.gainSurge）。
const CODE = '09587'

export default {
  code: CODE,
  scope: 'treachery',
  implemented: true,
  encounterResolve(state, inv, card, api) {
    const target = api.resolveScenarioEvent('dealingsNearestCultist', { from: inv.location })
    if (!target) {
      api.horror(inv.seat, 1)
      api.info?.('「阴影笼罩」：场上没有[[异教徒]]敌人 → 受到 1 点恐惧并获得涌动。')
      return { gainSurge: true, resolved: true }
    }
    const enemy = (state.enemies || []).find(item => item.id === target.enemyId)
    if (!enemy) return false
    api.doomOn(enemy, 1)
    const difficulty = Math.max(0, Number(enemy.fight) || 0)
    api.info?.(`「阴影笼罩」：在「${enemy.name}」上放 1 个毁灭，检定意志(${difficulty})。`)
    api.test(inv.seat, 'willpower', difficulty, result => {
      if (result.success) return
      api.horror(inv.seat, 2)
      api.info?.('「阴影笼罩」检定失败：受到 2 点恐惧。')
    }, 0, { type: 'encounter', label: '阴影笼罩', code: CODE })
    return { resolved: true }
  },
}
