// 05321 凋零术
// 卡面：[action]：攻击。本次攻击不使用[combat]，改为使用[willpower]。你本次攻击得到+2[willpower]。
//       如果本次攻击期间揭示了[skull]、[cultist]、[tablet]或[elder_thing]符号，被攻击敌人在本回合剩余时间内
//       得到-1攻击值、-1生命值和-1躲避值，最低减至1。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 05321 凋零术：意志攻击 +2（doFight 的 skill / combatBonus 参数，countsAs:'fight'）。
// 符号标记后的临时敌人数值降低未实现（现有修正管线没有「临时降低敌人 fight/health/evade」的通用读点），见 note。

export default {
  code: '05321',
  simplified: true,
  note: '符号标记（skull/cultist/tablet/elder_thing）后敌人 -1 攻击/-1 生命/-1 躲避 未实现：'
    + '现有 entityModifier 读点只认实体自身条目/地点/剧本行，没有「临时敌人数值修正」的通用写入口；意志攻击主效果已实现。',
  abilities: [
    {
      kind: 'action',
      cost: { action: true },
      countsAs: 'fight',
      target: { kind: 'enemy' },
      label: '攻击（意志代替战斗，+2 意志）',
      resolve: ({ inv, target, api }) => {
        const enemy = target?.entity
        if (!enemy) { api.info('这里没有可攻击的敌人。'); return }
        api.fight(inv.seat, enemy.id, { skill: 'willpower', combatBonus: 2, noSpend: true, sourceCode: '05321' })
      },
    },
  ],
  modifiers: [

  ],
}
