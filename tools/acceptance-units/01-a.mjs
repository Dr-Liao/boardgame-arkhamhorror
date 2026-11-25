// 验收单元 01-a：修订核心（Revised Core）重印别名。
// 规程见 docs/test/ACCEPTANCE-ORDER.md；生成器见 tools/audit-card-unit.mjs。
// 审计报告：docs/test/验收-01-a-修订核心.md / .json（2026-11-24）。
export default {
  id: '01-a',
  acceptanceId: 'revised-core-2026-11',
  exportPrefix: 'RCORE',
  verifiedFn: 'rcoreCardVerified',
  profile: {
    id: 'revised-core-2026-11',
    scope: '2021 修订核心（Revised Core）116 条目录记录（01501–01616）。这些卡是原核心 01xxx 卡片的再版印刷号，行为由 canonical 条目经 _reprint-aliases.js 提供，不单独实现。',
    basis: '逐卡核对：duplicateOfCode → canonical 已验收、别名映射覆盖、文本一致、无第二份行为实现；证据为 tests/acceptance-01-a-rcore.test.mjs 的真实断言。114/116 通过；01685/01689 的 canonical（60227/51007）所属入门包/重返单元尚未逐卡验收，暂不计入 verified。未声称穷举所有卡牌组合。',
    houseRules: [
      '保留项目既有的自动奖励反应与协作请求规则',
      '重印号只保留 canonical 实现，015xx 不进入构筑池（availability 保持 catalog-only）',
      '目录状态与别名表由同一份账本锁定，别名解析不到即视为未验收',
    ],
    sources: [
      '参考资源/ArkhamHorror-main/frontend/public/cards_en.json',
      '参考资源/ArkhamHorror-main/backend/arkham-api/library/Arkham',
    ],
  },
  select: card => card.pack === 'rcore',
  exclude: [],
  expectedCount: 116,
  failed: [
    {
      code: '01685',
      dimension: 'implementation',
      reason: 'canonical 60227（Seeking Answers）尚无逐卡验收结论（入门包账本只到批次 open 层），本卡行为依赖该 canonical，不能先于它声明 verified。',
    },
    {
      code: '01689',
      dimension: 'implementation',
      reason: 'canonical 51007（Rite of Seeking）尚无逐卡验收结论（重返敦威治批次账本只到 open 层），本卡行为依赖该 canonical，不能先于它声明 verified。',
    },
  ],
  testFiles: ['games/arkhamhorror/tests/acceptance-01-a-rcore.test.mjs'],
  evidence: { titlePrefixes: ['RCore'], forbidTitles: /目录|存在|可构筑|别名表/ },
  outputs: {
    ledger: 'audit/rcore-acceptance.json',
    module: 'src/cards/rcore-acceptance.js',
  },
}
