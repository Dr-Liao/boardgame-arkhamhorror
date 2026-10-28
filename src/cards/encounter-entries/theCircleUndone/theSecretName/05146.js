// 05146 群星牵引（Pulled by the Stars）
// 归属：关卡专用 · theSecretName（P8 w-witch）。卡面：显现 - 放入威胁区；强制 - 回合结束且本回合未移动：2 恐惧；[action] 意志(3) 弃掉（横置女巫敌人时自动成功）。
// 一卡一文件：规则只在这里维护；跨章共享规则在 content/campaigns/theCircleUndone/encounter-rules.js。
import { ALL_CARDS, activeInvestigators, originalOf } from '../../_shared.js'

export default {
  code: '05146', scope: 'treachery', implemented: true,
  treacheryRule: {
    threatArea: true,
    // 强制 - 回合结束且本回合未移动过：受到 2 点恐惧（读点 TCU encounter-rules.turnEnded）。
    turnEnd: { kind: 'horrorIfNotMoved', amount: 2 },
  },
  threatAction: {
    rule: 'discardPulledByTheStars', label: '⭐ 检定意志(3)弃掉群星牵引',
    skills: ['willpower'], difficulty: 3, target: 'threat',
  },
  encounterResolve(state, inv, card, api) {
    api.threat?.(inv.seat, '05146')
    api.info?.('⭐ 群星牵引进入你的威胁区域。')
    return true
  },
}
