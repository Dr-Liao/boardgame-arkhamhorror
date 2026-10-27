// 05149 那赫卜（Nahab · 于黑书签下姓名）
// 归属：关卡专用 · theSecretName（P8 w-witch）。卡面：猎手、反击；密谋推进时不移除毁灭；攻击 +X（当前密谋编号）；强制 - 敌军阶段开始若重整：放 1 毁灭。
// 一卡一文件：规则只在这里维护；跨章共享规则在 content/campaigns/theCircleUndone/encounter-rules.js。
import { ALL_CARDS, activeInvestigators, originalOf } from '../../_shared.js'

export default {
  code: '05149', scope: 'enemy', implemented: true,
  // 卡面「在密谋推进时，不要移除那赫卜的毁灭标记。」（引擎 advanceAgenda 读点）
  doomKeptOnAgendaAdvance: 'self',
  enemyRule: { hunter: true, retaliate: true },
}
