// 05180 · 恶罪报应（theWagesOfSin）
// 恶毒邪灵：生成于教堂阁楼/地下室（behavior.spawnLocation）；在幽灵地点获得猎手并 +1 伤害/+1 恐惧（behavior.syncMalevolent/enemyAttackModifier）；被非[[法术]]/[[遗物]]伤害击败时改为治愈、横置、移动到幽灵地点（behavior.enemyDamaged）。
//
// 一卡一文件：规则的唯一实现在章节目录 behavior.js（本章大量跨卡顺序结算）；
// 本条目只声明卡面身份与 implemented 读点，供 implementedFor/审计与 P9 资产页读取。

export default {
  code: '05180',
  scope: 'enemy',
  implemented: true,
  flags: { enemyRole: 'malevolentSpirit', spawnRule: 'chapelAtticOrCrypt' },
}
