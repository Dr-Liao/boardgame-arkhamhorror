// 05178a · 恶罪报应（theWagesOfSin）
// 异端者（A 面）：+2×人数生命；非幽灵地点获得冷漠且不能被交战/受伤；[fast] 花 1 线索谈判查看另一面；被击败后翻到 05178b 并结算。规则在 behavior 的 ensureHereticFaces/flipToUnfinishedBusiness/enemyDefeated。
//
// 一卡一文件：规则的唯一实现在章节目录 behavior.js（本章大量跨卡顺序结算）；
// 本条目只声明卡面身份与 implemented 读点，供 implementedFor/审计与 P9 资产页读取。

export default {
  code: '05178a',
  scope: 'enemy',
  implemented: true,
  flags: { enemyRole: 'heretic' },
}
