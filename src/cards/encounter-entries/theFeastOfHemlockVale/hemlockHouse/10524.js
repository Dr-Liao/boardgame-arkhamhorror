// 10524 猎杀之屋 / The Predatory House · 双面剧情卡·正面（掠食袋建立）（The Feast of Hemlock Vale · hemlockHouse）
//
// 归属：关卡专用 · theFeastOfHemlockVale/hemlockHouse（P7 汉洛克庄园）。
// 卡面：建立独立的掠食袋（[cultist]/[tablet]/[elder_thing]，再按当前日加入 cultist）。
// 读点：behavior.resolvePredatoryHouse / ensurePredationBag / predationBagTokens；掠食袋用引擎既有
// 原语 api.tokenBag（state.tokenBags.predation），不新增状态字段。
// 
// 本卡在 Setup 时放一边（out of play）；议程 1b「活着的庄园」把它翻到「猎杀检定」面并结算。

export default {
  "code": "10524",
  "scope": "storyAsset",
  "implemented": true,
  "flags": {
    "predatoryHouse": true,
    "doubleSided": true,
    "backFaceCode": "10524b",
    "startsSetAside": true,
    "predationBag": true,
    "predationBaseTokens": [
      "cultist",
      "tablet",
      "elderthing"
    ],
    "dayCultists": {
      "1": 2,
      "2": 1,
      "3": 0
    }
  },
  "note": "掠食袋走引擎 tokenBag 原语（袋 id predation）；「翻面进入场上」由 behavior 写 storyAssets 条目（引擎没有剧情卡翻面的独立原语）。"
}
