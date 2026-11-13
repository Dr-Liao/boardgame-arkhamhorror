// 09588 纠缠不休（Accosted）· 诡计 · dealings_in_the_dark
// 卡面：显现 - 如果场上没有[[异教徒]]敌人，受到 1 点伤害，且纠缠不休获得涌动。否则，找到离你最近的
//       [[异教徒]]敌人。在该敌人上放置 1 个毁灭标记并检定[agility](X)，X 等于该敌人的躲避值。
//       如果你检定失败，受到 2 点伤害。
// 读点（与 09587 同句模板，差异只在技能/惩罚）：
//   · 显现入口 = 条目的 `encounterResolve`（第 4 参是场景运行时窄接口）；
//   · 「最近的[[异教徒]]」= api.resolveScenarioEvent('dealingsNearestCultist')；
//   · 毁灭 = api.doomOn；检定 = api.test；涌动 = { gainSurge: true }。
const CODE = '09588'

export default {
  code: CODE,
  scope: 'treachery',
  implemented: true,
  encounterResolve(state, inv, card, api) {
    const target = api.resolveScenarioEvent('dealingsNearestCultist', { from: inv.location })
    if (!target) {
      api.damage(inv.seat, 1)
      api.info?.('「纠缠不休」：场上没有[[异教徒]]敌人 → 受到 1 点伤害并获得涌动。')
      return { gainSurge: true, resolved: true }
    }
    const enemy = (state.enemies || []).find(item => item.id === target.enemyId)
    if (!enemy) return false
    api.doomOn(enemy, 1)
    const difficulty = Math.max(0, Number(enemy.evade) || 0)
    api.info?.(`「纠缠不休」：在「${enemy.name}」上放 1 个毁灭，检定敏捷(${difficulty})。`)
    api.test(inv.seat, 'agility', difficulty, result => {
      if (result.success) return
      api.damage(inv.seat, 2)
      api.info?.('「纠缠不休」检定失败：受到 2 点伤害。')
    }, 0, { type: 'encounter', label: '纠缠不休', code: CODE })
    return { resolved: true }
  },
}
