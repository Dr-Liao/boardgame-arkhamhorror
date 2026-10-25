// 05184 · 恶罪报应（theWagesOfSin）
// 长明灯：从基础牌库抽出时按 state rng 随机位置洗入幽灵牌库并获涌动；从幽灵牌库抽出时受到 2 伤害并放回基础弃牌堆。来源由 behavior.encounterDeckFor 在抽牌前记录，结算在 behavior.encounterResolve。
//
// 一卡一文件：规则的唯一实现在章节目录 behavior.js（本章大量跨卡顺序结算）；
// 本条目只声明卡面身份与 implemented 读点，供 implementedFor/审计与 P9 资产页读取。

export default {
  code: '05184',
  scope: 'treachery',
  implemented: true,
  flags: { resolveRule: 'graveLight', surgeRule: 'graveLightStandardDraw' },
}
