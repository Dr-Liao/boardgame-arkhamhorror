// 05131 弗兰克·埃尔伍德的房间（Frank Elwood’s Room）
// 归属：关卡专用 · theSecretName（P8 w-witch）。卡面：闹鬼 - 放 1 个线索在此或密谋放 1 毁灭。
// 一卡一文件：规则只在这里维护；跨章共享规则在 content/campaigns/theCircleUndone/encounter-rules.js。
import { ALL_CARDS, activeInvestigators, originalOf } from '../../_shared.js'

export default {
  code: '05131', scope: 'location', implemented: true,
  // 卡面只有闹鬼：闭集子句写在 definition 的 haunted 数据里。
}
