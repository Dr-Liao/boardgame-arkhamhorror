// 05064 女巫作祟之林·杂草丛生的谷仓（Overgrown Barn）
// 归属：关卡专用 · theWitchingHour（P8 w-witch）。卡面：[reaction] 一个敌人将要生成在另一处女巫作祟之林时：改为生成在此，然后它攻击本地点的每位调查员。
// 一卡一文件：规则只在这里维护；跨章共享规则在 content/campaigns/theCircleUndone/encounter-rules.js。
import { ALL_CARDS, activeInvestigators, hasTrait, originalOf } from '../../_shared.js'

export default {
  code: '05064', scope: 'location', implemented: true,
  // behavior.spawnLocation / enemySpawned 读取本地点（code 05064）：改道 + 生成后攻击。
  locationRule: {
    redirectSpawnHere: true,
  },
}
