// 05147 不安的梦（Disquieting Dreams）
// 归属：关卡专用 · theSecretName（P8 w-witch）。卡面：显现 - 检定意志(5)，失败放入威胁区；强制 - 回合结束弃遭遇牌库顶 1 张；强制 - 遭遇牌库耗尽时弃本卡并揭示牌堆顶 10 张。
// 一卡一文件：规则只在这里维护；跨章共享规则在 content/campaigns/theCircleUndone/encounter-rules.js。
import { activeInvestigators, originalOf } from '../../_shared.js'

export default {
  code: '05147', scope: 'treachery', implemented: true,
  treacheryRule: {
    threatArea: true,
    // 强制 - 回合结束：弃遭遇牌库顶 1 张（读点 TCU encounter-rules.turnEnded）。
    turnEnd: { kind: 'discardEncounterTop', amount: 1 },
    // 参考 DisquietingDreams.hs 的第二条强制（EncounterDeckRunsOutOfCards）：
    // 数据声明式，由 encounter-rules.resolveEncounterDeckEmptyForced 统一解释。
    encounterDeckEmpty: { discardSelf: true, revealTop: 10, drawWeaknesses: true },
  },
  encounterResolve(state, inv, card, api) {
    let placed = false
    api.test?.(inv.seat, 'willpower', 5, result => {
      if (result?.success) return
      api.threat?.(inv.seat, '05147')
      placed = true
      api.info?.('😴 不安的梦进入你的威胁区域。')
    })
    return placed
  },
}
