===== 08587 08587 威廉·戴尔教授 / Professor William Dyer
--- EN ---
Partner. Uses (3 secrets).
[fast] Spend 1 secret and exhaust Professor William Dyer: Heal 2 horror from an investigator or another [[Ally]] asset at your location.
--- ENTRY ---
// 08587 威廉·戴尔教授
// 归属：关卡专用 · edgeOfTheEarth/fatalMirage（P7 致命幻景）。
// 伙伴（坚毅）形态：由 battle.choosePartner 交给调查员；技能/费用数值取印刷数据。
//
// 一张卡一个文件：这张卡的行为只在这里维护（规则读点见 flags / *Rule；引擎无卡号分支）。


export default {
  code: '08587',
  scope: 'storyAsset',
  implemented: true,
  uses: 3,
  usesType: 'secrets',
  abilities: [],
  flags: { partner: true, resolute: true, usesType: 'secrets', partnerRules: {"reaction":"heal2HorrorAfterFreeSpend"} },
}
--- TESTS ---
- tests/eote-campaign-flow.test.mjs
- tests/eote-scenario-fatalMirage.test.mjs

===== 08588 08588 丹佛斯 / Danforth
--- EN ---
Partner. Uses (5 secrets).
[reaction] After an investigator at your location resolves a Tekeli-li weakness, exhaust Danforth and spend 1 secret: That investigator draws 3 cards. Discard each Tekeli-li weakness drawn by this effect without resolving its effects.
--- ENTRY ---
// 08588 丹佛斯
// 归属：关卡专用 · edgeOfTheEarth/fatalMirage（P7 致命幻景）。
// 伙伴（坚毅）形态：由 battle.choosePartner 交给调查员；技能/费用数值取印刷数据。
//
// 一张卡一个文件：这张卡的行为只在这里维护（规则读点见 flags / *Rule；引擎无卡号分支）。


export default {
  code: '08588',
  scope: 'storyAsset',
  implemented: true,
  uses: 5,
  usesType: 'secrets',
  abilities: [],
  flags: { partner: true, resolute: true, usesType: 'secrets', partnerRules: {"reaction":"afterTekeliliResolvedDraw3DiscardWeaknesses"} },
}
--- TESTS ---
（测试未按卡号/名称命中：需人工确认覆盖）
- 名称命中: tests/eote-campaign-flow.test.mjs（Danforth）；tests/eote-primitives-flow.test.mjs（Danforth）；tests/eote-primitives-flow.test.mjs（丹佛斯）

===== 08589 08589 伊里亚·阿什瓦克 / Eliyah Ashevak
--- EN ---
Partner. Uses (3 secrets).
[fast] During your turn, spend 1 secret and exhaust Eliyah Ashevak: Evade. Attempt to evade with a base [agility] skill of 6. If you succeed, you may move to a connecting location.
--- ENTRY ---
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
--- TESTS ---
（测试未按卡号/名称命中：需人工确认覆盖）

===== 08590 08590 玛拉·辛哈医生 / Dr. Mala Sinha
--- EN ---
Partner. Uses (3 supplies).
[fast] Spend 1 supply and exhaust Dr. Mala Sinha: Heal 2 damage from an investigator or another [[Ally]] asset at your location.
--- ENTRY ---
// 08590 玛拉·辛哈医生
// 归属：关卡专用 · edgeOfTheEarth/fatalMirage（P7 致命幻景）。
// 伙伴（坚毅）形态：由 battle.choosePartner 交给调查员；技能/费用数值取印刷数据。
//
// 一张卡一个文件：这张卡的行为只在这里维护（规则读点见 flags / *Rule；引擎无卡号分支）。


export default {
  code: '08590',
  scope: 'storyAsset',
  implemented: true,
  uses: 3,
  usesType: 'supplies',
  abilities: [],
  flags: { partner: true, resolute: true, usesType: 'supplies', partnerRules: {"reaction":"heal2DamageAfterFreeSpend"} },
}
--- TESTS ---
（测试未按卡号/名称命中：需人工确认覆盖）

===== 08591 08591 艾弗里·克莱普尔 / Avery Claypool
--- EN ---
Partner. Uses (3 supplies).
[reaction] When an investigator at your location reveals a [frost] token during a skill test, exhaust Avery Claypool: Cancel that token. Then, you must either reveal a new chaos token, or spend 1 supply.
--- ENTRY ---
// 08591 艾弗里·克莱普尔
// 归属：关卡专用 · edgeOfTheEarth/fatalMirage（P7 致命幻景）。
// 伙伴（坚毅）形态：由 battle.choosePartner 交给调查员；技能/费用数值取印刷数据。
//
// 一张卡一个文件：这张卡的行为只在这里维护（规则读点见 flags / *Rule；引擎无卡号分支）。


export default {
  code: '08591',
  scope: 'storyAsset',
  implemented: true,
  uses: 3,
  usesType: 'supplies',
  abilities: [],
  flags: { partner: true, resolute: true, usesType: 'supplies', partnerRules: {"reaction":"cancelFrostThenRevealOrSpendSupply"} },
}
--- TESTS ---
（测试未按卡号/名称命中：需人工确认覆盖）
- 名称命中: tests/eote-scenario-iceAndDeathPart2.test.mjs（艾弗里·克莱普尔）

===== 08592 08592 詹姆斯·“曲奇”·弗雷德里克斯 / James "Cookie" Fredericks
--- EN ---
Partner. Uses (3 ammo).
[fast] During your turn, spend 1 ammo and exhaust James "Cookie" Fredericks: Fight. Fight with a base [combat] skill of 6. If you succeed and the attacked enemy is non-[[Elite]], it cannot attack for the remainder of the round.
--- ENTRY ---
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
--- TESTS ---
- tests/eote-scenario-fatalMirage.test.mjs

===== 08593 08593 艾米·肯斯勒博士 / Dr. Amy Kensler
--- EN ---
Partner. Uses (3 secrets).
[fast] During your turn, spend 1 secret and exhaust Dr. Amy Kensler: Investigate. Investigate with a base [intellect] skill of 6. If you succeed, look at the top card of any investigator's deck or the encounter deck. You may discard that card.
--- ENTRY ---
// 08593 艾米·肯斯勒博士
// 归属：关卡专用 · edgeOfTheEarth/fatalMirage（P7 致命幻景）。
// 伙伴（坚毅）形态：由 battle.choosePartner 交给调查员；技能/费用数值取印刷数据。
//
// 一张卡一个文件：这张卡的行为只在这里维护（规则读点见 flags / *Rule；引擎无卡号分支）。


export default {
  code: '08593',
  scope: 'storyAsset',
  implemented: true,
  uses: 3,
  usesType: 'secrets',
  abilities: [
    { kind: 'action', actionKind: 'investigate', label: '花费 1 秘密并横置：以基础值 6 的智力调查；成功可查看牌库顶', cost: { action: true, exhaust: true, uses: 1 },
      resolve: ({ inv, api }) => {
        api.investigate(inv.seat, { skill: 'intellect', baseValue: 6 })
        if (api.testResult()?.success) api.lookAt(inv.seat, { zone: 'deck', count: 1 })
      } },
  ],
  flags: { partner: true, resolute: true, usesType: 'secrets', partnerRules: {"basicAction":"investigateBase6LookTopCard"} },
}
--- TESTS ---
（测试未按卡号/名称命中：需人工确认覆盖）

===== 08594 08594 罗尔德·埃尔斯沃思 / Roald Ellsworth
--- EN ---
Partner. Uses (3 supplies).
[fast] During an investigator's turn, either exhaust Roald Ellsworth or spend 1 supply: Choose a non-weakness treachery in play. Treat that treachery's text box as if it were blank until the end of this turn.
--- ENTRY ---
// 08594 罗尔德·埃尔斯沃思
// 归属：关卡专用 · edgeOfTheEarth/fatalMirage（P7 致命幻景）。
// 伙伴（坚毅）形态：由 battle.choosePartner 交给调查员；技能/费用数值取印刷数据。
//
// 一张卡一个文件：这张卡的行为只在这里维护（规则读点见 flags / *Rule；引擎无卡号分支）。


export default {
  code: '08594',
  scope: 'storyAsset',
  implemented: true,
  uses: 3,
  usesType: 'supplies',
  abilities: [],
  flags: { partner: true, resolute: true, usesType: 'supplies', partnerRules: {"free":"blankNonWeaknessTreacheryText"} },
}
--- TESTS ---
（测试未按卡号/名称命中：需人工确认覆盖）

===== 08595 08595 高田弘子 / Takada Hiroko
--- EN ---
Partner. Uses (9 resources).
[action] Exhaust Takada Hiroko: Gain 1 resource. Move up to 3 resources from Takada Hiroko to your resource pool.
--- ENTRY ---
// 08595 高田弘子
// 归属：关卡专用 · edgeOfTheEarth/fatalMirage（P7 致命幻景）。
// 伙伴（坚毅）形态：由 battle.choosePartner 交给调查员；技能/费用数值取印刷数据。
//
// 一张卡一个文件：这张卡的行为只在这里维护（规则读点见 flags / *Rule；引擎无卡号分支）。


export default {
  code: '08595',
  scope: 'storyAsset',
  implemented: true,
  uses: 9,
  usesType: 'resources',
  abilities: [],
  flags: { partner: true, resolute: true, usesType: 'resources', partnerRules: {"action":"gain1ResourceMoveUpTo3"} },
}
--- TESTS ---
（测试未按卡号/名称命中：需人工确认覆盖）
