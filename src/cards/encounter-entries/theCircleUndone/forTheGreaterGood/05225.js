// 05225 秘社地底 · 归属：关卡专用 05197《崇高利益》（fgg）
// 规则实现：卡面效果由章节 behavior.js 的钩子分派（本章单卡规则集中在 behavior，见 spec）。
export default {
  "code": "05225",
  "scope": "treachery",
  "implemented": true,
  "note": "behavior.js:resolveEncounter(智力 3，失败每点线索/恐惧+险境)",
  "flags": {
    "fggTreachery": "beneathTheLodge"
  }
};
