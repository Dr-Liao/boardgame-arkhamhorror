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
