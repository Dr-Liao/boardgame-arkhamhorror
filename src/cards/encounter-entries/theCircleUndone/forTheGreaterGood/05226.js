// 05226 修道会符号 · 归属：关卡专用 05197《崇高利益》（fgg）
// 规则实现：卡面效果由章节 behavior.js 的钩子分派（本章单卡规则集中在 behavior，见 spec）。
export default {
  "code": "05226",
  "scope": "treachery",
  "implemented": true,
  "note": "behavior.js:resolveEncounter(按钥匙结算伤害/恐惧/弃牌/资源)",
  "flags": {
    "fggTreachery": "markOfTheOrder"
  }
};
