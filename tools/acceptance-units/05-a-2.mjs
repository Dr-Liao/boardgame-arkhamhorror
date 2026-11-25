// 验收单元 05-a-2：05-a 万象无终分片 2（tcu 豪华包后半）。
// 规程见 docs/test/ACCEPTANCE-ORDER.md；生成器见 tools/audit-card-unit.mjs。
// 审计报告：docs/test/验收-05-a-万象无终-分片-2.md / .json（2026-11）。
import fs from 'node:fs'

// 失败清单直接取审计结论 JSON，避免配置与报告两处漂移。
const verdict = JSON.parse(fs.readFileSync(new URL('../../docs/test/验收-05-a-万象无终-分片-2.json', import.meta.url), 'utf8'))
const failed = verdict.failedCodes.map(({ code, dimension, reason }) => ({ code, dimension, reason }))

// 范围锁定为审计时未验收的 55 条记录（tcu）。
const codes = ["05055b", "05056", "05057", "05058", "05059", "05060", "05061", "05062", "05063", "05064", "05065", "05066", "05067", "05068", "05069", "05070", "05071", "05072", "05073", "05074", "05075", "05076", "05077", "05078", "05079", "05080", "05081", "05082", "05083", "05084", "05085", "05085b", "05086", "05087", "05088", "05089", "05090", "05091", "05092", "05093", "05094", "05095", "05096", "05097", "05098", "05099", "05100", "05101", "05102", "05103", "05104", "05105", "05106", "05107", "05108"]
const codeSet = new Set(codes)

export default {
  id: "05-a-2",
  acceptanceId: "tcu-deluxe-b-2026-11",
  exportPrefix: "TCU_SHARD2",
  verifiedFn: "tcuShard2CardVerified",
  profile: {
    id: "tcu-deluxe-b-2026-11",
    scope: "万象无终 05 段 tcu 豪华包后半（05055b–05108）55 条目录记录。54 条通过五维验收；1 条（05055b）因 R1 直写 setAside 暂不切换。",
    basis: '独立复核（不采信既有账本）：卡面 → 本地读点 → 原语 → 交互 → 真实执行测试逐卡核对；证据为验收测试与既有回归的真实用例标题。近似与缺口逐条披露，未声称等价。',
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
  expectedCount: 55,
  failed,
  testFiles: [
    "games/arkhamhorror/tests/acceptance-05-a-shard2.test.mjs",
    "games/arkhamhorror/tests/tcu-witching-hour.test.mjs",
    "games/arkhamhorror/tests/tcu-deaths-doorstep.test.mjs",
    "games/arkhamhorror/tests/tcu-shared-encounters.test.mjs",
    "games/arkhamhorror/tests/tcu-p0-regressions.test.mjs",
    "games/arkhamhorror/tests/tcu-p1-regressions.test.mjs",
    "games/arkhamhorror/tests/tcu-primitives-location-state.test.mjs",
  ],
  evidence: { linkedFace: true, forbidTitles: /目录|存在性|可构筑/ },
  outputs: {
    ledger: "audit/05-a-2-acceptance.json",
    module: "src/cards/05-a-2-acceptance.js",
  },
}
