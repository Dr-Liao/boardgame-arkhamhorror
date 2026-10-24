// 05264b · 归属：关卡专用 05238《聚合幻灭》（uad）
// 规则实现：卡面效果由章节 behavior.js 的钩子分派（本章单卡规则集中在 behavior，见 spec）。
export default {
  "code": "05264b",
  "scope": "enemy",
  "implemented": true,
  "note": "behavior.js:afterEvade(躲避成功受 1 伤害)",
  "flags": {
    "onEvadeDamage": 1
  }
};
