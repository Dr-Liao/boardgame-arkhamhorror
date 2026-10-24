// 05219 牢房看门人 · 归属：关卡专用 05197《崇高利益》（fgg）
// 规则实现：卡面效果由章节 behavior.js 的钩子分派（本章单卡规则集中在 behavior，见 spec）。
export default {
  "code": "05219",
  "scope": "enemy",
  "implemented": true,
  "note": "behavior.js:enemySpawned + afterEvade(躲避 2+ 取得钥匙)"
};
