// 01069 眩光一闪
// 卡面：躲避。这次躲避尝试不使用[agility]，改为使用[willpower]。如果检定成功，对刚躲避的敌人造成2点伤害。如果躲避尝试期间揭示了[skull]、[cultist]、[tablet]、[elder_thing]或[auto_fail]符号，本回合失去1个行动并受到1点恐惧。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。

export default {
  code: '01069',
  abilities: [
    {
      kind: 'played',
      label: '眩光一闪',
      effect: {
        type: 'evade',
        skill: 'willpower',
        damageOnSuccess: 2,
        symbolActionLoss: true,
        onChaosSymbolHorror: 1,
      },
    },
  ],
  modifiers: [

  ],
}
