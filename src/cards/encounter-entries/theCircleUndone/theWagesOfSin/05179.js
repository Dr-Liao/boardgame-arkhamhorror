// 05179 · 恶罪报应（theWagesOfSin）
// 复仇女巫：生成于绞刑架或异端者的墓地（behavior.spawnLocation）；警戒/猎手；被击败时对同地点每位调查员造成其伤害/恐惧（直接）。规则在 behavior.enemyDefeated。
//
// 一卡一文件：规则的唯一实现在章节目录 behavior.js（本章大量跨卡顺序结算）；
// 本条目只声明卡面身份与 implemented 读点，供 implementedFor/审计与 P9 资产页读取。

export default {
  code: '05179',
  scope: 'enemy',
  implemented: true,
  flags: { enemyRole: 'vengefulWitch', spawnRule: 'gallowsOrHereticsGraves' },
}
