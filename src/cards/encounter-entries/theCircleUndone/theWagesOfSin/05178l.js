// 05178l · 恶罪报应（theWagesOfSin）
// 未了之事（L 面）：翻回敌人面、立即攻击；下次击败本敌人时驱除。规则在 behavior.resolveImmediateUnfinishedBusiness 与 enemyDefeated 的 hereticBanishNext 分支。
//
// 一卡一文件：规则的唯一实现在章节目录 behavior.js（本章大量跨卡顺序结算）；
// 本条目只声明卡面身份与 implemented 读点，供 implementedFor/审计与 P9 资产页读取。

export default {
  code: '05178l',
  scope: 'storyAsset',
  implemented: true,
  flags: { storyRule: 'unfinishedBusinessImmediate' },
}
