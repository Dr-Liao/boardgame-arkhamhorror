// 05263b · 归属：关卡专用 05238《聚合幻灭》（uad）
// 规则实现：卡面效果由章节 behavior.js 的钩子分派（本章单卡规则集中在 behavior，见 spec）。
export default {
  "code": "05263b",
  "scope": "enemy",
  "implemented": true,
  "note": "behavior.js:enemyEngaged(弃 2 张手牌)",
  "flags": {
    "onEngageDiscardTwo": 2
  }
};
