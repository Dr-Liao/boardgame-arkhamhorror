// 验收单元 04-a-1：失落时代分片 1（The Forgotten Age 豪华包 + Threads of Fate）。
// 规程见 docs/test/ACCEPTANCE-ORDER.md；生成器见 tools/audit-card-unit.mjs。
// 审计报告：docs/test/验收-04-a-失落时代战役卡-分片-1.md / .json（2026-11-24）。
import fs from 'node:fs'

// 失败清单直接取审计结论 JSON，避免配置与报告两处漂移。
const verdict = JSON.parse(fs.readFileSync(new URL('../../docs/test/验收-04-a-失落时代战役卡-分片-1.json', import.meta.url), 'utf8'))
const failed = verdict.failedCodes.map(({ code, dimension, reason }) => ({ code, dimension, reason }))

// 范围锁定为审计时未验收的 106 条记录（tfa 60 + tof 46）；tfaPlayer/tfaInvestigators 账本覆盖的卡不重复。
const codes = ["04043", "04044", "04045", "04046", "04047", "04048", "04049", "04050", "04051", "04052", "04053", "04054", "04055", "04056", "04057", "04058", "04059", "04060", "04061", "04062", "04063", "04064", "04065", "04066", "04067", "04068", "04069", "04070", "04071", "04072", "04073", "04074", "04075", "04076", "04077", "04078", "04079", "04080", "04081", "04082", "04083", "04084", "04085", "04086", "04087", "04088", "04089", "04090", "04091", "04092", "04093", "04094", "04095", "04096", "04097", "04098", "04099", "04100", "04101", "04102", "04113", "04114", "04115", "04116", "04117a", "04117b", "04118a", "04118b", "04119", "04120", "04121", "04122", "04122b", "04123", "04124", "04125a", "04125b", "04126a", "04126b", "04127", "04128a", "04128b", "04129", "04130a", "04130b", "04131", "04132", "04133a", "04133b", "04134a", "04134b", "04135", "04136", "04137a", "04137b", "04138", "04139", "04140", "04141", "04142", "04143", "04144", "04145", "04146", "04147", "04148"]
const codeSet = new Set(codes)

export default {
  id: '04-a-1',
  acceptanceId: 'tfa-deluxe-threads-of-fate-2026-11',
  exportPrefix: 'TFA_SHARD1',
  verifiedFn: 'tfaShard1CardVerified',
  profile: {
    id: 'tfa-deluxe-threads-of-fate-2026-11',
    scope: '失落时代 04 段 The Forgotten Age 豪华包（tfa，60 条）+ Threads of Fate（tof，46 条）共 106 条目录记录，锁定审计时未验收清单。83 条通过五维验收；23 条因真实行为缺陷、声明未接线或存量 R1 直写暂不切换。',
    basis: '独立复核（不采信既有账本）：卡面 → 本地读点 → 原语 → 交互（真实 legalMoves/applyMove/pendingChoice）→ 真实执行测试逐卡核对；证据为 tests/acceptance-04-a-shard1.test.mjs 与 tfa-*.test.mjs 的真实用例标题。缺陷与缺口逐条披露，未声称等价。',
    houseRules: [
      '保留项目既有的自动奖励反应与协作请求规则',
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
  expectedCount: 106,
  failed,
  testFiles: [
    'games/arkhamhorror/tests/acceptance-04-a-shard1.test.mjs',
    'games/arkhamhorror/tests/tfa-untamed-wilds.test.mjs',
    'games/arkhamhorror/tests/tfa-doom-of-eztli.test.mjs',
    'games/arkhamhorror/tests/tfa-threads-of-fate.test.mjs',
    'games/arkhamhorror/tests/tfa-encounter-p1.test.mjs',
    'games/arkhamhorror/tests/tfa-p2-hooks.test.mjs',
    'games/arkhamhorror/tests/tfa-mechanics.test.mjs',
    'games/arkhamhorror/tests/tfa-visibility.test.mjs',
    'games/arkhamhorror/tests/tfa-scenario-acceptance.test.mjs',
  ],
  evidence: { linkedFace: true, forbidTitles: /目录|存在性|可构筑/ },
  outputs: {
    ledger: 'audit/tfa-shard1-acceptance.json',
    module: 'src/cards/tfa-shard1-acceptance.js',
  },
}
