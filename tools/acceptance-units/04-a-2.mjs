// 验收单元 04-a-2：失落时代分片 2（Shattered Aeons + The Boundary Beyond + The City of Archives）。
// 规程见 docs/test/ACCEPTANCE-ORDER.md；生成器见 tools/audit-card-unit.mjs。
// 逐卡结论与证据见 audit/tfa-shard2-acceptance.json。
const codes = ['04161', '04162', '04163', '04164', '04165', '04166', '04167', '04168', '04169', '04170', '04171', '04172', '04173', '04174', '04175', '04176', '04177', '04178', '04179', '04180', '04181', '04182', '04183', '04184', '04185', '04186', '04187', '04188', '04189', '04190', '04191', '04237', '04238', '04239', '04240', '04241', '04242', '04243', '04244', '04245', '04246', '04247', '04248', '04249', '04250', '04251', '04252', '04253', '04254', '04255', '04256', '04257', '04258', '04259', '04260', '04261', '04262', '04263', '04264', '04314', '04315', '04316', '04317', '04318', '04319', '04320', '04321', '04322', '04323', '04324', '04325', '04325b', '04326', '04326b', '04327', '04328', '04329', '04330', '04331', '04332', '04333', '04334', '04335', '04336', '04337', '04338', '04339', '04340', '04341', '04342', '04343', '04344', '04345', '04346', '04347']
const codeSet = new Set(codes)


export default {
  id: '04-a-2',
  acceptanceId: 'tfa-shattered-aeons-boundary-beyond-city-of-archives-2026-11',
  exportPrefix: 'TFA_SHARD2',
  verifiedFn: 'tfaShard2CardVerified',
  profile: {
    id: 'tfa-shattered-aeons-boundary-beyond-city-of-archives-2026-11',
    scope: '失落时代 04 段 Shattered Aeons（sha，36 条）+ The Boundary Beyond（tbb，31 条）+ The City of Archives（tcoa，28 条）共 95 条目录记录，锁定审计时未验收清单。逐卡结论、证据文件与用例标题见验收账本。',
    basis: '独立复核（不采信既有账本）：卡面 → 本地读点 → 原语 → 交互 → 真实执行测试逐卡核对；证据为 tests/acceptance-04-a-shard2.test.mjs 与 tfa-*.test.mjs 的真实用例标题。本次复验覆盖原报告中全部 14 张失败卡。',
    houseRules: [
      '卡面可选反应由应答者决定，保留既有的协作请求规则',
      '结构卡以印刷正反面、确定性布置、区域守恒及对应章节行为共同验收',
      '存档与重放沿用引擎统一事务模型',
    ],
    sources: [
      '参考资源/ArkhamHorror-main/frontend/public/cards_en.json',
      '参考资源/ArkhamHorror-main/backend/arkham-api/library/Arkham',
    ],
  },
  select: card => codeSet.has(card.code),
  exclude: [],
  expectedCount: 95,
  failed: [],
  testFiles: [
    'games/arkhamhorror/tests/acceptance-04-a-shard2.test.mjs',
    'games/arkhamhorror/tests/tfa-shattered-aeons.test.mjs',
    'games/arkhamhorror/tests/tfa-boundary-beyond.test.mjs',
    'games/arkhamhorror/tests/tfa-city-of-archives.test.mjs',
    'games/arkhamhorror/tests/tfa-turn-back-time.test.mjs',
    'games/arkhamhorror/tests/tfa-encounter-p1.test.mjs',
    'games/arkhamhorror/tests/tfa-p2-hooks.test.mjs',
    'games/arkhamhorror/tests/tfa-mechanics.test.mjs',
    'games/arkhamhorror/tests/tfa-scenario-acceptance.test.mjs',
  ],
  evidence: { linkedFace: true, forbidTitles: /目录|存在性|可构筑/ },
  outputs: {
    ledger: 'audit/tfa-shard2-acceptance.json',
    module: 'src/cards/tfa-shard2-acceptance.js',
  },
}
