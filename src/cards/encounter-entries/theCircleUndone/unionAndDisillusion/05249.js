// 05249 · 归属：关卡专用 05238《聚合幻灭》（uad）
// 规则实现：卡面 [action]：撤退 → definition.js 的 locations.miskatonicRiver 声明 resign:true，
// 由引擎的撤退入口（src/engine/moves.js:448-453、771-774）直接生成；本章 behavior 只管 circle 行动。
export default {
  "code": "05249",
  "scope": "location",
  "implemented": true,
  "note": "definition.js:locations.miskatonicRiver(resign:true) → 引擎撤退行动；behavior.js:actions/performAction(circle)"
};
