// 05057 安妮特·梅森（Anette Mason · 高阶女祭司）
// 归属：关卡专用 · theWitchingHour（P8 w-witch）。卡面：反击；强制 - 敌军阶段开始后弃遭遇牌库顶 3 张，把弃掉的女巫敌人生成在她所在地点，否则重整她。生命 4×人数，胜利 2。
// 一卡一文件：规则只在这里维护；跨章共享规则在 content/campaigns/theCircleUndone/encounter-rules.js。
import { ALL_CARDS, activeInvestigators, hasTrait, originalOf } from '../../../_shared.js'

export default {
  code: '05057', scope: 'enemy', implemented: true,
  // 数值与「反击」由 definition 的印刷数据提供；敌军阶段开始的强制效果在本章
  // behavior.enemyPhaseStart 里按 code 实现（需要遭遇牌库操作与 api.spawn）。
  enemyRule: { retaliate: true },
}
