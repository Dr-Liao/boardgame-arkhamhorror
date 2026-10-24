// 05203 四把钥匙 · 归属：关卡专用 05197《崇高利益》（fgg）
// 规则实现：卡面效果由章节 behavior.js 的钩子分派（本章单卡规则集中在 behavior，见 spec）。
export default {
  "code": "05203",
  "scope": "act",
  "implemented": true,
  "note": "behavior.js:checkObjectives(同地点机关盒+四钥匙) + actReveal(结局分支)"
};
