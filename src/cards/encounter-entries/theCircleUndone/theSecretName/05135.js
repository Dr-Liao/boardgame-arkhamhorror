// 05135 暮光深渊（Twilight Abyss）
// 归属：关卡专用 · theSecretName（P8 w-witch）。卡面：强制 - 进入后检定战斗或敏捷(3)，失败每差 1 点受 1 点伤害。
// 一卡一文件：规则只在这里维护；跨章共享规则在 content/campaigns/theCircleUndone/encounter-rules.js。
import { ALL_CARDS, activeInvestigators, originalOf } from '../../_shared.js'

export default {
  code: '05135', scope: 'location', implemented: true,
  locationRule: {
    onEnter: {
      effect(state, location, api, inv) {
        if (!inv || inv.location !== location.id) return
        // 卡面「[combat] 或 [agility](3)」：二选一检定（引擎多技能数组=两项求和，不能用）。
        const chosen = api.choose?.({
          kind: 'skill', source: '05135', seat: inv.seat,
          prompt: '暮光深渊：选择本次检定使用的技能。',
          options: [{ id: 'combat', label: '战斗' }, { id: 'agility', label: '敏捷' }],
        })
        const skill = chosen === 'agility' ? 'agility' : 'combat'
        api.test?.(inv.seat, skill, 3, result => {
          if (result?.success) return
          const difficulty = Number(result?.difficulty ?? 3)
          const failedBy = Math.max(0, difficulty - Number(result?.value ?? 0))
          if (failedBy > 0) api.damage?.(inv.seat, failedBy)
          api.info?.(`🌑 暮光深渊：${inv.name} 受到 ${failedBy} 点伤害。`)
        })
      },
    },
  },
}
