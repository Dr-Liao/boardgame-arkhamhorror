// 05128 发霉的走道（Moldy Halls）
// 归属：关卡专用 · theSecretName（P8 w-witch）。卡面：闹鬼 - 失去 3 资源。
// 一卡一文件：规则只在这里维护；跨章共享规则在 content/campaigns/theCircleUndone/encounter-rules.js。
import { ALL_CARDS, activeInvestigators, originalOf } from '../../_shared.js'

export default {
  code: '05128', scope: 'location', implemented: true,
  // 卡面只有闹鬼：闭集子句写在 definition 的 haunted 数据里（P2.1 引擎统一结算）。
}
