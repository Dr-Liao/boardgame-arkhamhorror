// 11505 盘问帮派 · 幕 1 版本 II（金盆洗手，La Bella Luna 线）
// 归属：关卡专用 · theDrownedCity/oneLastJob。
// 卡面与 11504 相同（两版随机二选一）。
// 印刷：线索阈值 2；背面把 La Bella Luna 放入商业区右侧、生成内奥米·欧巴尼恩并补齐幕牌库。
// 读点：behavior.checkObjectives / oneLastJobParley / actReveal，均读本条目 flags。
export default {
  code: '11505',
  scope: 'act',
  implemented: true,
  flags: {
    clueThreshold: 2,
    perInvestigatorBonus: 1,
    parley: { discardEngagedCriminal: true, clueOnAct: 1 },
    linkedLocationId: 'laBellaLuna',
    bossCode: '11511',
  },
  note: '数据型条目：与 11504 同文；阈值为「2 + 1[per_investigator]」，流程在 behavior。',
  abilities: [],
}
