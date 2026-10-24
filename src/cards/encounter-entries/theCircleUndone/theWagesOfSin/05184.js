// 05184 · 恶罪报应（theWagesOfSin）
// 长明灯：从基础牌库抽出时洗入幽灵牌库并获涌动；从幽灵牌库抽出时受到 2 伤害并放回基础弃牌堆。规则在 behavior 的 encounterResolve（按 behavior.encounterDeckFor 路由近似来源）。
//
// 一卡一文件：规则的唯一实现在章节目录 behavior.js（本章大量跨卡顺序结算）；
// 本条目只声明卡面身份与 implemented 读点，供 implementedFor/审计与 P9 资产页读取。

export default {
  code: '05184',
  scope: 'treachery',
  implemented: true,
  flags: { resolveRule: 'graveLight', surgeRule: 'graveLightStandardDraw' },
}
