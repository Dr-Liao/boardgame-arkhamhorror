// 05178h · 恶罪报应（theWagesOfSin）
// 未了之事（H 面）：轮末弃 2 张手牌或翻回敌人面；在异端者墓地无线索时检定(4)驱除。规则在 behavior.unfinishedBusinessForced/actions。
//
// 一卡一文件：规则的唯一实现在章节目录 behavior.js（本章大量跨卡顺序结算）；
// 本条目只声明卡面身份与 implemented 读点，供 implementedFor/审计与 P9 资产页读取。

export default {
  code: '05178h',
  scope: 'storyAsset',
  implemented: true,
  flags: { storyRule: 'unfinishedBusiness' },
}
