// 05140 旧日支配者皇廷（Court of the Great Old Ones）
// 归属：关卡专用 · theSecretName（P8 w-witch）。卡面：强制 - 进入后检定意志(3)，失败每差 1 点受 1 点恐惧；闹鬼：下一行动必须调查。
// 一卡一文件：规则只在这里维护；跨章共享规则在 content/campaigns/theCircleUndone/encounter-rules.js。
import { ALL_CARDS, activeInvestigators, originalOf } from '../../_shared.js'

export default {
  code: '05140', scope: 'location', implemented: true,
  locationRule: {
    onEnter: {
      effect(state, location, api, inv) {
        if (!inv || inv.location !== location.id) return
        api.test?.(inv.seat, 'willpower', 3, result => {
          if (result?.success) return
          const failedBy = Math.max(0, 3 - Number(result?.value ?? 0))
          if (failedBy > 0) api.horror?.(inv.seat, failedBy)
          api.info?.(`👑 旧日支配者皇廷：${inv.name} 受到 ${failedBy} 点恐惧。`)
        })
      },
    },
  },
}
