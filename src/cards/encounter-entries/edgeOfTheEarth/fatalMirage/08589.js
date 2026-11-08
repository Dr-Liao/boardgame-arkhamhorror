// 08589 伊里亚·阿什瓦克
// 归属：关卡专用 · edgeOfTheEarth/fatalMirage（P7 致命幻景）。
// 伙伴（坚毅）形态：由 battle.choosePartner 交给调查员；技能/费用数值取印刷数据。
//
// 一张卡一个文件：这张卡的行为只在这里维护（规则读点见 flags / *Rule；引擎无卡号分支）。


export default {
  code: '08589',
  scope: 'storyAsset',
  implemented: true,
  uses: 3,
  usesType: 'secrets',
  abilities: [
    { kind: 'action', actionKind: 'evade', label: '花费 1 秘密并横置：以基础值 6 的敏捷躲避；成功可移动到连接地点', cost: { action: true, exhaust: true, uses: 1 }, target: { kind: 'enemy' },
      resolve: ({ inv, source, target, state, api }) => {
        api.evade(inv.seat, { enemyId: target?.id, skill: 'agility', baseValue: 6 })
        const result = api.testResult()
        if (!result?.success) return
        const destinations = api.moveDestinations(inv.seat)
        if (!destinations.length) return
        const destination = destinations.length === 1 ? destinations[0] : api.choice({ kind: 'location', source: '08589', seat: inv.seat,
          prompt: '选择移动目的地。', options: destinations.map(id => ({ id, label: api.locName(id) })) })
        api.moveInvestigator(inv.seat, destination)
      } },
  ],
  flags: { partner: true, resolute: true, usesType: 'secrets', partnerRules: {"basicAction":"evadeBase6ThenMayMove"} },
}
