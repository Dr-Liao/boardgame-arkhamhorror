// 06194 诡计「阁楼的秘密」（Secrets in the Attic）· 万千骇形（2 张）
// 归属：关卡专用 · aThousandShapesOfHorror。卡面：
// 显现 - 检定意志（3）。如果你检定失败，受到 1 点恐惧并将阁楼的秘密放置入场，放在密谋牌库旁。
// 地点上的 [fast] 能力不能触发。
// 强制 - 当一轮结束时：从场上弃掉 1 张阁楼的秘密。（每轮最多一次。）
//
// 依据 Haskell Treachery/Cards/.../SecretsInTheAttic.hs：
//   · 显现检定 → 本条目 encounterResolve 里 api.test（失败再结算，不是纯声明式：还要放「密谋牌库旁」的实体）；
//   · 「放在密谋牌库旁」→ api.putNextToAgenda 创建真实旁置实例；
//   · 「地点 [fast] 不能触发」由通用能力读点读取 blocksLocationFastAbilities；
//   · 轮末每轮只弃 1 张，由章节 roundEnded 在旁置实例中选择并结算。

const SECRETS = '06194'

export default {
  code: SECRETS,
  scope: 'treachery',
  implemented: true,
  treacheryRule: { blocksLocationFastAbilities: true },
  encounterResolve(state, inv, treachery, api) {
    let placed = false
    api.test?.(inv.seat, 'willpower', 3, result => {
      if (result.success) return
      api.horror?.(inv.seat, 1)
      api.putNextToAgenda?.(SECRETS)
      placed = true
      api.info?.(`🕯️ 「阁楼的秘密」在密谋牌库旁放置入场（地点上的 [fast] 能力直到它离场前不能触发）。`)
    })
    return placed
  },
}
