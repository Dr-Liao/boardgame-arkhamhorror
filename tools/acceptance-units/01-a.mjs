// 验收单元 01-a：修订核心（Revised Core）重印别名。
// 规程见 docs/test/ACCEPTANCE-ORDER.md；生成器见 tools/audit-card-unit.mjs。
// 逐卡结论与用例标题见 audit/rcore-acceptance.json。
export default {
  id: '01-a',
  acceptanceId: 'revised-core-2026-11',
  exportPrefix: 'RCORE',
  verifiedFn: 'rcoreCardVerified',
  profile: {
    id: 'revised-core-2026-11',
    scope: '修订核心 116 张再版印刷号（01501–01603、01683–01695），行为由原版提供。',
    basis: '逐卡核对原版账本、印刷文本、图鉴和运行时别名。60227 与 51007 及其重印均通过实际对局测试。',
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
  failed: [],
  testFiles: ['games/arkhamhorror/tests/acceptance-01-a-rcore.test.mjs'],
  evidence: { titlePrefixes: ['RCore'], forbidTitles: /目录|存在|可构筑|别名表/ },
  outputs: {
    ledger: 'audit/rcore-acceptance.json',
    module: 'src/cards/rcore-acceptance.js',
  },
}
