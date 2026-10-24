// 05148 布朗·詹金（Brown Jenkin · 女巫的魔宠）
// 归属：关卡专用 · theSecretName（P8 w-witch）。卡面：冷漠、猎手；重整的[[生物]]敌人 +2 攻击；强制 - 敌军阶段结束时若重整：本地每位调查员弃掉所有手牌再抽等量。
// 一卡一文件：规则只在这里维护；跨章共享规则在 content/campaigns/theCircleUndone/encounter-rules.js。
import { ALL_CARDS, activeInvestigators, originalOf } from '../../_shared.js'

export default {
  code: '05148', scope: 'enemy', implemented: true,
  // 数值/关键词由 definition 印刷数据提供；两个常驻/强制效果在 behavior.enemyStatModifier 与
  // behavior.enemyPhaseEnd 按 code 实现（需要读取全场敌人与手牌）。
  enemyRule: { aloof: true, hunter: true },
}
