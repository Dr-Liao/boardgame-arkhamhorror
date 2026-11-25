// 验收单元 08-a-5：08-a 地球边缘分片 5（eoec 战役卡 B）。
// 规程见 docs/test/ACCEPTANCE-ORDER.md；生成器见 tools/audit-card-unit.mjs。
// 审计报告：docs/test/验收-08-a-地球边缘-分片-5.md / .json（2026-11）。
import fs from 'node:fs'

// 失败清单直接取审计结论 JSON，避免配置与报告两处漂移。
const verdict = JSON.parse(fs.readFileSync(new URL('../../docs/test/验收-08-a-地球边缘-分片-5.json', import.meta.url), 'utf8'))
const failedByCode = new Map(verdict.failedCodes.map(({ code, dimension, reason }) => [code, { code, dimension, reason }]))
for (const code of verdict.pendingCodes || []) if (!failedByCode.has(code)) failedByCode.set(code, { code, dimension: 'pending', reason: '审计标 pending：证据/口径未闭环，按未通过计；详见报告。' })
const failed = [...failedByCode.values()]

// 范围锁定为审计时未验收的 45 条记录（eoec）。
const codes = ["08546", "08547", "08548", "08549", "08550", "08551", "08552", "08553", "08554", "08555", "08556", "08556b", "08557", "08557b", "08558", "08558b", "08559", "08559b", "08560", "08560b", "08561", "08561b", "08562", "08562b", "08563", "08563b", "08564", "08564b", "08565", "08565b", "08566", "08566b", "08567", "08567b", "08568", "08568b", "08569", "08569b", "08570", "08570b", "08571", "08571b", "08572", "08572b", "08573"]
const codeSet = new Set(codes)

export default {
  id: "08-a-5",
  acceptanceId: "eote-campaign-b-2026-11",
  exportPrefix: "EOTE_SHARD5",
  verifiedFn: "eoteShard5CardVerified",
  profile: {
    id: "eote-campaign-b-2026-11",
    scope: "地球边缘 08 段 eoec 战役卡（08546–08573）45 条目录记录。22 条通过五维验收；23 条幻景地点/冰原规则仅 flags 声明无读点暂不切换。",
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
  expectedCount: 45,
  failed,
  testFiles: [
    "games/arkhamhorror/tests/acceptance-08-a-shard5.test.mjs",
    "games/arkhamhorror/tests/eote-scenario-fatalMirage.test.mjs",
    "games/arkhamhorror/tests/eote-scenario-iceAndDeathPart3.test.mjs",
    "games/arkhamhorror/tests/eote-scenario-shared.test.mjs",
    "games/arkhamhorror/tests/eote-all-cards.test.mjs",
    "games/arkhamhorror/tests/eote-rules.test.mjs",
    "games/arkhamhorror/tests/eote-primitives-frost.test.mjs",
    "games/arkhamhorror/tests/eote-primitives-travel.test.mjs",
    "games/arkhamhorror/tests/eote-primitives-geo.test.mjs",
    "games/arkhamhorror/tests/eote-primitives-campaign.test.mjs",
    "games/arkhamhorror/tests/eote-primitives-flow.test.mjs",
  ],
  evidence: { linkedFace: true },
  outputs: {
    ledger: "audit/08-a-5-acceptance.json",
    module: "src/cards/08-a-5-acceptance.js",
  },
}
