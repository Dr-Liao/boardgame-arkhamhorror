// 05214 典礼室（圣堂门廊背面） · 归属：关卡专用 05197《崇高利益》（fgg）
// 规则实现：卡面效果由章节 behavior.js 的钩子分派（本章单卡规则集中在 behavior，见 spec）。
export default {
  "code": "05214",
  "scope": "location",
  "implemented": true,
  "note": "behavior.js:roundEnded(直接恐惧) + locationRevealed(符号翻面)"
};
