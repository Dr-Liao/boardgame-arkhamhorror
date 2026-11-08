// 08721 罗尔德·埃尔斯沃思（Roald Ellsworth） · 剧情资产（伙伴）· expedition_team
// 归属：战役共用 · edgeOfTheEarth/_shared（开局/关卡由章节按 Partner 原语交给调查员）。
// 卡面：伙伴。使用(5补给)。[free]任意调查员回合期间，横置并花费 1 补给：选择一张附属到任意地点的诡计，其印刷文本框视为空白直到本回合结束。
// 读点：条目 uses/usesType 提供「使用(N secret/supply/ammo/resources)」次数（实例创建时由
//   campaign 侧照抄）；主动/反应能力走 abilities 描述子，写入只走 ctx.api。

export default {
  code: '08721', scope: 'storyAsset', implemented: true,
  flags: { partner: true, partnerRules: { free: 'blankNonWeaknessTreacheryText' } },
  uses: 5, usesType: 'supplies',
  note: '「把地点附属诡计的印刷文本框视为空白直到本回合结束」需要引擎的临时文本空白读点（P7 读点请求 primitive-requests/p7-08721.json）；条目先声明伙伴数据与能力条件。',
  abilities: [],
}


