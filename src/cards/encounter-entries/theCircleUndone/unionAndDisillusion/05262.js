// 05262 · 归属：关卡专用 05238《聚合幻灭》（uad）
// 规则实现：卡面效果由章节 behavior.js 的钩子分派（本章单卡规则集中在 behavior，见 spec）。
export default {
  "code": "05262",
  "scope": "storyAsset",
  "implemented": true,
  "note": "behavior.js:resolveFate(disappeared+trail→剧情支援+alive；claimed→翻回敌人面)"
};
