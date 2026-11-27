// 11552 · 淹没城区（theDrownedQuarter）单卡条目。
// 归属：关卡专用 · theDrownedCity/theDrownedQuarter（P7 淹没城区，参考卡 11536）。
// 规则文本与卡表一致见 src/cards/cards-data.js；逐卡行为读点见 note 与章节 behavior.js。
export default {
  code: '11552',
  scope: 'storyAsset',
  implemented: true,
  controlledAsset: true,
  cannotLeavePlay: true,
  assetRule: { cannotBeDefeated: true },
  flags: { glyphLine: ['q', 'x', 'g', 'k', 's'], glyphHealthBonus: 2 },
  note: '不能被击败或离场。五个所列符文全部翻译后获得 +2 生命。回合开始时可治愈 1 点伤害。',
  abilities: [{
    kind: 'reaction',
    trigger: 'turnBegins',
    limit: { scope: 'perWindow', owner: 'instance' },
    label: '回合开始：治愈屏障节点上的 1 点伤害',
    criteria: ({ inv, source, context }) => context?.seat === inv.seat && (source.damage || 0) > 0,
    resolve: ({ inv, source, api }) => api.healAsset(source, { ownerSeat: inv.seat, damage: 1 }),
  }],
}
