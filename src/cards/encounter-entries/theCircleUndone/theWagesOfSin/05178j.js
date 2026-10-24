// 05178j · 恶罪报应（theWagesOfSin）
// 未了之事（J 面）：翻回敌人面、立即攻击；本场敌人不能以任何方式被击败、谈判只能位于幽灵地点且费用 +1×人数线索；下次结算本面改为驱除。规则在 behavior.resolveImmediateUnfinishedBusiness/performHereticParley。
//
// 一卡一文件：规则的唯一实现在章节目录 behavior.js（本章大量跨卡顺序结算）；
// 本条目只声明卡面身份与 implemented 读点，供 implementedFor/审计与 P9 资产页读取。

export default {
  code: '05178j',
  scope: 'storyAsset',
  implemented: true,
  flags: { storyRule: 'unfinishedBusinessImmediate' },
}
