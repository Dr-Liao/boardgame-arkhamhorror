// 08643 复苏的古老者（Reawakened Elder Thing）· enemy
//
// 归属：关卡专用 · edgeOfTheEarth/cityOfTheElderThings（P7）。
// 卡面：
//   猎手。
//   强制 - 在本敌人与你交战时：将你控制的一个钥匙放到本敌人上。在本敌人离场时，将该钥匙放在本敌人所在地点。
//   强制 - 在本敌人所在地点的一位调查员控制一个钥匙时：本敌人重整，与该调查员交战，并攻击该调查员。
//
// 逐卡规则由 `src/cards/card-rules.js` 的读点读取（actRule / agendaRule / locationRule / enemyRule / treacheryRule / encounterResolve / flags），章节 behavior 只做分派。
export default {
  code: "08643",
  scope: "enemy",
  implemented: true,
  enemyRule: {
    hunter: true,
    takesKeyOnEngage: true,
    readiesOnKeyControlled: true,
    placesKeyOnLeave: true
  }
}
