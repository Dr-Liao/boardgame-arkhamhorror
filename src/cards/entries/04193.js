// 04193 特制弹药
// 卡面：快速。只能在你回合期间打出。
// 卡面：附属到你所在地点的一位调查员控制的[[枪械]]支援上。在该支援上放置2子弹。每个支援仅限1张。
// 卡面：附属的支援对[[怪物]]敌人执行攻击时造成+1伤害。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。

export default {
  code: '04193',
  playCondition: [{ when: ({ state, inv }) => state.currentSeat === inv.seat, message: '只能在你自己的回合打出' }],
  attachTo: {"kind":"asset","trait":"firearm","maxPerTarget":1,"controllerScope":"location"},
  onAttach: {"ammo":2},
  fast: true,
  passive: {"hostMonsterDamage":1},
  monsterAttackDamageBonus: 1,
  abilities: [

  ],
  modifiers: [

  ],
}
