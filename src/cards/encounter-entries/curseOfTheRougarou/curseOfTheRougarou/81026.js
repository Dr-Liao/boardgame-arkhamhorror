// 81026 拖入水底 · 诡计（狼人诅咒 / The Bayou）
// 归属：关卡专用 · curseOfTheRougarou/curseOfTheRougarou。
// 卡面：显现 - 检定[敏捷](3)。如果失败，将拖入水底放置入你的威胁区域。
//       强制 - 你离开当前地点时：受到 2 点伤害并弃掉拖入水底。
//       强制 - 你的回合结束时：检定[敏捷](3)。如果成功，弃掉拖入水底。
// 读点（引擎既有）：
//   · 显现检定走 api.test（scenarioRuntime）；失败后 api.threat 进威胁区域（唯一写入口）；
//   · 「离开地点」由 behavior.locationLeft 扫描 threat 中的本卡结算；
//   · 「回合结束」由 behavior.turnEnded 扫描 threat 中的本卡结算。
export default {
  code: '81026',
  scope: 'treachery',
  implemented: true,
  flags: { threatTest: { skill: 'agility', difficulty: 3 } },
  encounterResolve(state, inv, card, api) {
    api.test(inv.seat, 'agility', 3, result => {
      if (result?.success) {
        api.info?.(`✔️ ${inv.name} 挣脱了拖拽（敏捷 ${result.value} vs 3）。`)
        return
      }
      api.threat?.(inv.seat, '81026', { originalCode: '81026' })
      api.info?.(`🌊 ${inv.name} 检定失败：「拖入水底」进入其威胁区域。`)
    })
    return true
  },
  note: '显现检定 + 失败进威胁区在 encounterResolve；离场 2 伤害/弃卡与回合结束检定在 behavior.locationLeft / behavior.turnEnded（读 inv.threat 中的本卡号）。',
}
