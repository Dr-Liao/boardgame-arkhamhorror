// 05185 · 恶罪报应（theWagesOfSin）
// 祸害生者：险境二选一——把场上未了之事翻回异端者面并放一半生命伤害，或从幽灵牌库顶弃到灵怪敌人并生成交战。规则在 behavior 的 encounterResolve。
//
// 一卡一文件：规则的唯一实现在章节目录 behavior.js（本章大量跨卡顺序结算）；
// 本条目只声明卡面身份与 implemented 读点，供 implementedFor/审计与 P9 资产页读取。

export default {
  code: '05185',
  scope: 'treachery',
  implemented: true,
  flags: { resolveRule: 'baneOfTheLiving' },
}
