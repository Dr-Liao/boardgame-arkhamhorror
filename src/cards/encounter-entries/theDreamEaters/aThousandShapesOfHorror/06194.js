// 06194 诡计「阁楼的秘密」（Secrets in the Attic）· 万千骇形（2 张）
// 归属：关卡专用 · aThousandShapesOfHorror。卡面：
// 显现 - 检定意志（3）。如果你检定失败，受到 1 点恐惧并将阁楼的秘密放置入场，放在密谋牌库旁。
// 地点上的 [fast] 能力不能触发。
// 强制 - 当一轮结束时：从场上弃掉 1 张阁楼的秘密。（每轮最多一次。）
//
// 依据 Haskell Treachery/Cards/.../SecretsInTheAttic.hs：
//   · 显现检定 → 本条目 encounterResolve 里 api.test（失败再结算，不是纯声明式：还要放「密谋牌库旁」的实体）；
//   · 「放在密谋牌库旁」→ 记到 state.scenarioFlags.agendaAside（api.setScenarioFlag 读写，章节行为消费；
//     没有 TDE 版的 agendaAside 共享区，故用纯数据场景标记，符合 R1 不直写状态）；
//   · 「地点 [fast] 不能触发」与轮末弃 1 张 → behavior.fastActions / behavior.roundEnded 按本卡是否在
//     agendaAside 里统一判定（数据驱动，不写卡号分支）。
import { ALL_CARDS } from '../../_shared.js'

const SECRETS = '06194'

const asideCodes = state => (Array.isArray(state.scenarioFlags?.agendaAside) ? state.scenarioFlags.agendaAside : [])

export default {
  code: SECRETS,
  scope: 'treachery',
  implemented: true,
  flags: { agendaAside: true },
  encounterResolve(state, inv, treachery, api) {
    api.test?.(inv.seat, 'willpower', 3, result => {
      if (result.success) return
      api.horror?.(inv.seat, 1)
      const aside = [...asideCodes(state), SECRETS]
      api.setScenarioFlag?.('agendaAside', aside)
      api.info?.(`🕯️ 「阁楼的秘密」在密谋牌库旁放置入场（地点上的 [fast] 能力直到它离场前不能触发）。`)
    })
    return false
  },
  note: `simplified：轮末「弃掉 1 张阁楼的秘密（每轮最多一次）」由 behavior.roundEnded 在共享层之后结算；`
    + `牌面「地点上的 [fast] 能力不能触发」由 behavior.fastActions 读取 scenarioFlags.agendaAside 拦截。`
    + `（本卡没有任何数值子句被省略；${ALL_CARDS[SECRETS]?.nameZh || '阁楼的秘密'} 的实体用场景标记表达。）`,
}
