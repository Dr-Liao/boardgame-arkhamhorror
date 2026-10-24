// 05053 森林迷途（Lost in the Woods）
// 归属：关卡专用 · theWitchingHour（P8 w-witch）。卡面：目标 - 轮末团队花费 2×人数线索；背面 - 每人随机放 1 张阿卡姆密林到面前、生成黑山羊、检定、洗入魔鬼的笛声。
// 一卡一文件：规则只在这里维护；跨章共享规则在 content/campaigns/theCircleUndone/encounter-rules.js。
import { ALL_CARDS, activeInvestigators, hasTrait, originalOf } from '../../_shared.js'

export default {
  code: '05053', scope: 'act', implemented: true,
  // 背面需要「面前地点/黑山羊/魔鬼的笛声」章节 helper，流程在 behavior.resolveLostInTheWoods
  // （behavior.actReveal 对 05053 特判），条目保留 implemented 声明与本注释。
  actRule: { chapterFlow: 'resolveLostInTheWoods' },
}
