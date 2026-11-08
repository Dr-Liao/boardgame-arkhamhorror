// 08521 寻找扎营点（Search for a Camp Site）· 幕 1
// 归属：关卡专用 · edgeOfTheEarth/iceAndDeathPart1（theCrash 组）。
// 正面目标：找到安全的地方扎营；所有未被击败的调查员撤退后推进场景（撤退地点的庇护值越高越好）。
// [action]：如果所有调查员都在同一地点，且该地点上没有线索：撤退（扎起营地）。
// 读点：actRule.objective/chapterFlow + behavior.scenarioActions（campResign）/ actObjectiveMet。
export default {
  code: '08521',
  scope: 'act',
  implemented: true,
  actRule: {
    stage: 1,
    chapterFlow: 'searchForACampSite',
    objective: { type: 'resign', sameLocation: true, requiresNoClues: true },
    action: { rule: 'campResign', sameLocation: true, requiresNoClues: true },
  },
}
