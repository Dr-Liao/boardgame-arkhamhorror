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
