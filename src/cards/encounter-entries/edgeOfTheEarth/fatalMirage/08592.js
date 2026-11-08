// 08592 詹姆斯·“曲奇”·弗雷德里克斯
// 归属：关卡专用 · edgeOfTheEarth/fatalMirage（P7 致命幻景）。
// 伙伴（坚毅）形态：由 battle.choosePartner 交给调查员；技能/费用数值取印刷数据。
//
// 一张卡一个文件：这张卡的行为只在这里维护（规则读点见 flags / *Rule；引擎无卡号分支）。


export default {
  code: '08592',
  scope: 'storyAsset',
  implemented: true,
  uses: 3,
  usesType: 'ammo',
  abilities: [
    { kind: 'action', actionKind: 'fight', label: '花费 1 子弹并横置：以基础值 6 的战斗攻击；成功且非精英则本轮不能攻击', cost: { action: true, exhaust: true, uses: 1 }, target: { kind: 'enemy' },
      resolve: ({ inv, target, api }) => {
        api.fight(inv.seat, target?.id, { baseValue: 6, onSuccess: ({ enemy }) => {
          if (enemy && !enemy.elite) api.addEffect({ duration: 'endOfRound', label: '曲奇：该敌人本轮不能攻击', sourceCode: '08592', controllerSeat: inv.seat, modifiers: [] })
        } })
      } },
  ],
  flags: { partner: true, resolute: true, usesType: 'ammo', partnerRules: {"basicAction":"fightBase6NonEliteCannotAttackThisRound"} },
}
