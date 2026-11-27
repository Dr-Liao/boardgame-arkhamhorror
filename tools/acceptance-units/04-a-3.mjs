// 验收单元 04-a-3：失落时代分片 3（The Depths of Yoth + Heart of the Elders）。
// 规程见 docs/test/ACCEPTANCE-ORDER.md；生成器见 tools/audit-card-unit.mjs。
// 2026-11-26 复验通过，逐卡证据保存在生成的验收账本。

// 本单元范围锁定为审计时的 53 张未验收记录（tdoy 27 + hote 26）；已由 tfaPlayer 账本验收的
// 25 张玩家卡不重复纳入，避免与历史账本重复声明。
const codes = [
  '04205', '04206', '04206b', '04207', '04208', '04209', '04209b', '04210', '04211', '04212',
  '04213', '04214', '04215', '04216', '04217', '04218', '04219', '04220', '04221', '04222',
  '04223', '04224', '04225', '04226', '04227', '04228', '04277', '04278', '04279', '04280',
  '04281', '04282', '04283', '04284', '04285', '04286', '04287', '04288', '04289', '04290',
  '04291', '04292', '04293', '04294', '04295', '04296', '04297', '04298', '04299', '04300',
  '04301', '04302', '04303',
]
const codeSet = new Set(codes)

export default {
  id: '04-a-3',
  acceptanceId: 'tfa-depth-of-yoth-heart-of-the-elders-2026-11',
  exportPrefix: 'TFA_SHARD3',
  verifiedFn: 'tfaShard3CardVerified',
  profile: {
    id: 'tfa-depth-of-yoth-heart-of-the-elders-2026-11',
    scope: '失落时代 04 段幽嘶深渊与久远腹地共 53 条目录记录，全部通过五维验收。',
    basis: '独立复核（不采信既有账本）：卡面 → 本地读点 → 原语 → 交互 → 真实执行测试逐卡核对；证据为 tests/acceptance-04-a-shard3.test.mjs 及 tfa-*.test.mjs 的真实用例标题。近似与缺口逐条披露，未声称等价。',
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
  expectedCount: 53,
  failed: [],
  testFiles: [
    'games/arkhamhorror/tests/acceptance-04-a-shard3.test.mjs',
    'games/arkhamhorror/tests/tfa-depths-of-yoth.test.mjs',
    'games/arkhamhorror/tests/tfa-depths-of-yoth-ending.test.mjs',
    'games/arkhamhorror/tests/tfa-heart-of-the-elders-part1.test.mjs',
    'games/arkhamhorror/tests/tfa-heart-of-the-elders-part2.test.mjs',
  ],
  evidence: {
    forbidTitles: /目录|存在性|可构筑/,
    // 关联面：04209（act 研究图案）的验收证据以背面 04209b 的布置/分区用例承载。
    aliases: { '04209': ['04209b'] },
  },
  outputs: {
    ledger: 'audit/tfa-shard3-acceptance.json',
    module: 'src/cards/tfa-shard3-acceptance.js',
  },
}
