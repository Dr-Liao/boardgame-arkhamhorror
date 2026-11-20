// 11550 · 淹没城区（theDrownedQuarter）单卡条目。
// 归属：关卡专用 · theDrownedCity/theDrownedQuarter（P7 淹没城区，参考卡 11536）。
// 规则文本与卡表一致见 src/cards/cards-data.js；逐卡行为读点见 note 与章节 behavior.js。
// P2 原语接口：文物（Artifact）由被击败持有者按地图最近幸存调查员移交（transferOnControllerDefeat
// = 'nearest'，见 docs/campaign/theDrownedCity/primitives.md）；该声明落在真实文物条目上，
// 供 tests/tdc-primitives.test.mjs 的移交读点使用（夹具不再重复注册同一卡号）。
export default {
  code: '11550',
  scope: 'storyAsset',
  implemented: true,
  transferOnControllerDefeat: 'nearest',
  flags: {"test":{"skill":"intellect","difficulty":8}},
  note: "印刷：将要离场时从游戏移除；[action] 智力(8) 检定，投入本检定的每张卡牌技能图标翻倍，成功翻面。行为在 behavior.flipObsidianRelic（读 flags.test；成功 → 符文 Y + 胜利区）。近似：资产行动本身（玩家卡行动入口）尚未接线，由章节 events.drownedQuarterFlipObsidianRelic 承载；「图标翻倍」未实现。文物移交走 transferOnControllerDefeat。",
  abilities: [],
}
