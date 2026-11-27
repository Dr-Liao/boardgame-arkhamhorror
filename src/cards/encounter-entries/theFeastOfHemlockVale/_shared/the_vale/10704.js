// 10704 山谷 · 双面剧本参考卡。四档符号标记由序曲的混乱标记规则结算。
export default {
  code: '10704',
  scope: 'scenario',
  implemented: true,
  flags: {
    referenceCard: true,
    doubleSided: true,
    tokenMeanings: {
      easyStandard: {
        skull: { dayMultiplier: -1 },
        cultist: { delta: 1, parleyAutoSucceed: true },
        tablet: { delta: -2, handThreshold: 3, belowThresholdDelta: 0 },
        elderthing: { delta: -1, parleyRevealAnother: true },
      },
      hardExpert: {
        skull: { dayMultiplier: -1, delta: -1 },
        cultist: { delta: -1, parleyDelta: 1 },
        tablet: { delta: -4, handThreshold: 2, belowThresholdDelta: -2 },
        elderthing: { delta: -3, parleyRevealAnother: true },
      },
    },
  },
}
