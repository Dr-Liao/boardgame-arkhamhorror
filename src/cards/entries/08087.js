// 08087 狙击：本回合下一次使用远程或枪械支援的攻击，将指定标记视为 0。
const code = '08087'

export default {
  code,
  abilities: [{
    kind: 'played',
    noOpportunityAttack: true,
    label: '本回合下次远程或枪械支援攻击：指定符号和自动失败视为 0',
    resolve: ({ inv, api }) => api.treatTokensDuringNextAssetAttack(inv.seat, {
      traits: ['Ranged', 'Firearm'],
      tokens: ['skull', 'cultist', 'tablet', 'elderthing', 'autofail'],
      as: '0',
    }),
  }],
  modifiers: [],
}
