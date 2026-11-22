// 12045 M1903 击锤内置式手枪（M1903 Hammerless）· 资产 · 游荡者 0 经验 · 手部槽
// 卡面：使用(4子弹)。
// 卡面：[action]花费1子弹：攻击([agility])。如果目标敌人处于横置状态，本次攻击造成伤害+1。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 参考实现：Asset/Assets/M1903Hammerless.hs
//   （skillTestAbility (fightActionWith #agility (assetUseCost Ammo 1))；
//    ChoseEnemy → CriteriaModifier (enemy exhausted) (DamageDealt 1)）。
// 读点：action 描述子 → effect DSL 的 fight（skill:'agility' 走 doFight 的替代技能；
//   conditionalBonus.targetExhausted.damage 是引擎 doFight 的既有条件加伤读点，见 combat.js）。
export default {
  code: '12045',
  uses: 4,
  usesType: 'ammo',
  abilities: [
    {
      kind: 'action',
      label: '射击（敏捷攻击；目标已横置时伤害 +1）',
      cost: { action: true, uses: 1 },
      effect: {
        type: 'fight',
        skill: 'agility',
        conditionalBonus: { targetExhausted: { damage: 1 } },
      },
    },
  ],
  modifiers: [],
}
