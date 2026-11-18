// 10524b 猎杀检定 / Predation Test · 双面剧情卡·背面（掠食检定结果表）（The Feast of Hemlock Vale · hemlockHouse）
//
// 归属：关卡专用 · theFeastOfHemlockVale/hemlockHouse。
// 卡面：只在从掠食袋揭示标记时使用这些结果：cultist 放到一边；tablet 每个敌人-地点攻击该处每名
// 调查员（没有攻击则领队抽遭遇牌）并把本标记与放一边的标记放回袋里；elder_thing 放到一边并翻面
// 最近的未封印 [[Dormant]] 地点。
// 读点：behavior.makePredationTest / resolvePredationToken / returnSetAsidePredationTokens。

export default {
  "code": "10524b",
  "scope": "storyAsset",
  "implemented": true,
  "flags": {
    "predationTest": true,
    "frontFaceCode": "10524",
    "results": [
      "cultist",
      "tablet",
      "elderthing"
    ],
    "setAsideOnCultist": true,
    "returnSetAsideOnTablet": true,
    "flipNearestDormantOnElderThing": true
  },
  "note": "掠食检定不建立技能检定：behavior.makePredationTest 直接揭示掠食袋标记并结算。"
}
