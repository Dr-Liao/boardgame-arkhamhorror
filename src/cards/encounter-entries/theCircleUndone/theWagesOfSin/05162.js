// 05162 · 恶罪报应（theWagesOfSin）
// 议程 1 倒吊人·XII：背面把每个地点翻到幽灵面、放置幽灵看守人到绞刑者河、把看守人组剩余卡与幽灵弃牌堆洗入幽灵遭遇牌库。规则在 behavior.agendaReveal 的 advanceTheHangedMan。
//
// 一卡一文件：规则的唯一实现在章节目录 behavior.js（本章大量跨卡顺序结算）；
// 本条目只声明卡面身份与 implemented 读点，供 implementedFor/审计与 P9 资产页读取。

export default {
  code: '05162',
  scope: 'agenda',
  implemented: true,
  flags: { advanceRule: 'theHangedManXII' },
}
