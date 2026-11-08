// 08715 丹佛斯（Danforth） · 剧情资产（伙伴）· expedition_team
// 归属：战役共用 · edgeOfTheEarth/_shared（开局/关卡由章节按 Partner 原语交给调查员）。
// 卡面：伙伴。使用(5秘密)。[reaction]你所在地点的调查员结算忒咳哩-哩弱点后，横置丹佛斯并花费 1 秘密：该调查员抽取 2 张卡牌。
// 读点：条目 uses/usesType 提供「使用(N secret/supply/ammo/resources)」次数（实例创建时由
//   campaign 侧照抄）；主动/反应能力走 abilities 描述子，写入只走 ctx.api。

export default {
  code: '08715', scope: 'storyAsset', implemented: true,
  flags: { partner: true, partnerRules: { reaction: 'draw2AfterTekeliliResolved' } },
  uses: 5, usesType: 'secrets',
  note: '「结算忒咳哩-哩弱点后」需要引擎的弱点结算后窗口（P7 读点请求 primitive-requests/p7-08715.json）；条目先声明伙伴数据与能力条件。',
}


