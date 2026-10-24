// 05182 · 恶罪报应（theWagesOfSin）
// 往昔重担：威胁区无未了之事时涌动；否则触发威胁区每张未了之事的强制能力（如同轮末）。规则在 behavior.afterTest/encounterResolve 的未了之事分派。
//
// 一卡一文件：规则的唯一实现在章节目录 behavior.js（本章大量跨卡顺序结算）；
// 本条目只声明卡面身份与 implemented 读点，供 implementedFor/审计与 P9 资产页读取。

export default {
  code: '05182',
  scope: 'treachery',
  implemented: true,
  flags: { resolveRule: 'burdensOfThePast', surgeRule: 'noUnfinishedBusiness' },
}
