// 05062 女巫作祟之林·被污染的井（Tainted Well）
// 归属：关卡专用 · theWitchingHour（P8 w-witch）。卡面：其他女巫作祟之林↔本地点之间的技能检定可跨地点各投入 1 张牌。
// 一卡一文件：规则只在这里维护；跨章共享规则在 content/campaigns/theCircleUndone/encounter-rules.js。
import { ALL_CARDS, activeInvestigators, hasTrait, originalOf } from '../../_shared.js'

export default {
  code: '05062', scope: 'location', implemented: true,
  // approximation：引擎的投入窗口只询问「同地点」调查员（tests.js），没有「跨地点投入」修饰目标。
  // 本条目登记读点标记，behavior.canCommitCard / commitIconMultiplier 已接线；真正的远程投入
  // 交互受引擎限制（见 scenarios/theWitchingHour/behavior.js 的 scenarioApproximations）。
  locationRule: {
    allowsCrossWoodsCommit: true,
    crossWoodsCommitIcons: 1,
  },
}
