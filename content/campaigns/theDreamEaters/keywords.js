// 食梦者（The Dream Eaters，五循环）· 关键词与规则书条目清单（P4 事实源）。
//
// 这是 P4 的唯一事实源：审计工具（tools/audit-tde-rules.mjs）、Node 验收
// （tests/tde-rules.test.mjs）、规则书条目（web/rulebook-data.js）与机制扫描
// （artifacts/migration/tde/mechanism-scan.json）都以本文件为准。口径（路线图 §6）：
//
//   · 每行对应机制扫描里一个声明了 `keyword` 的机制（共 7 条）：`mechanismId` 对齐扫描 id，
//     `ruleId` 对齐扫描里的 `keyword.ruleId`（审计逐行比对，防漂移）；
//   · `kind` 区分证据形态：`printed` 卡面印刷词、`mechanism` 机制名（卡面不印）、
//     `rule` 只在规则书里成条的规则；本轮 7 条全部是印刷词；
//   · `cardCodes` 是**卡面来源**（P2 实测的全部印刷卡，不是代表卡）：每个卡号都必须能在
//     卡面 text / textZh / traits / slot 命中 `pattern`；pattern 与 rulebook-data.js 的
//     卡文直达判据是同一份正则，测试逐张比对；
//   · `engine` 是引擎行为证据：审计会 import 模块，逐个检查 `names` 是函数、
//     `values` 的形状符合声明；
//   · `deferred` 记录本循环**尚未接线**的部分（不隐藏）：关键词的规则读点已交付，
//     但章节脚本/面板接线属 P5/P8，不能因为「原语有测试」就写成整体已实现。
//
// 中文词形以卡表 src/cards/cards-data.js 为基线（多重 / 蜂拥 / 掩藏 / 研究完成 /
// 警戒 / 隐私 / 绑定），不得自造译名（路线图 §8.5 术语表）。
//
// 规则书条目 id：本循环新增 17 条（路线图 §6 原建议 16 条；P4 按 D5 决策把 Bonded 从
// 「复用 tcuBonded」改为新立 `tdeBonded`，因为本循环多了地点绑定与绑定弱点敌人）。
// `alert` / `hidden` 复用核心条目，不计入这 17 条。

export const TDE_KEYWORDS = Object.freeze([
  {
    id: 'myriad',
    kind: 'printed',
    printed: 'Myriad',
    zh: '多重',
    ruleId: 'tdeMyriad',
    mechanismId: 'myriad',
    ruleOwned: true,
    implemented: true,
    sourceKind: 'text',
    pattern: 'Myriad|多重',
    cardCodes: Object.freeze([
      '06020', '06021', '06023', '06026', '06029', '06034', '06199',
      '06241', '06242', '06243', '06245', '06278', '06323', '06328',
    ]),
    engine: Object.freeze([
      {
        module: 'src/engine/myriad.js',
        names: ['isMyriad', 'countTitleCopies', 'validateMyriadLimit', 'addCardRespectingMyriad', 'myriadUsage'],
        values: [{ name: 'MYRIAD_LIMIT' }],
      },
    ]),
    deferred: Object.freeze([
      'P7 已接线构筑界面 n/3 显示（web/deck-rules.js#myriadUsage → web/hub.js cardMeta）与构筑校验拦截；'
        + '06199/06241–06243 的「多张同名在场」结算按卡牌行为处理（P7 逐卡实现/显式简化）',
    ]),
    note: '构筑期同名至多 3 张（按卡牌标题跨卡号共享额度）；06021/06199 的「多张同名在场」是卡面效果，不是关键词规则。',
  },
  {
    id: 'swarming',
    kind: 'printed',
    printed: 'Swarming X',
    zh: '蜂拥',
    ruleId: 'tdeSwarming',
    mechanismId: 'swarming',
    ruleOwned: true,
    implemented: true,
    sourceKind: 'text',
    pattern: 'Swarming|蜂拥',
    cardCodes: Object.freeze([
      '06102', '06106', '06107', '06108', '06145', '06147',
      '06148', '06151', '06152', '06228', '06273',
    ]),
    engine: Object.freeze([
      {
        module: 'src/engine/swarming.js',
        names: ['swarmingSpec', 'swarmingCount', 'swarmingCountForText', 'swarmingXFromState', 'perInvestigatorCount'],
        values: [{ name: 'SWARMING_KINDS', length: 5 }],
      },
      {
        module: 'src/engine/swarm.js',
        names: ['placeSwarmCards', 'swarmCardsOf', 'swarmCountOf', 'swarmCanBeDefeated', 'swarmBlockedReason', 'splitSwarmingDamage', 'swarmHostOf'],
        values: [],
      },
    ]),
    deferred: Object.freeze([
      '真实蜂拥实体在场景里的生成/攻击/交战（P8）；面板（数量、来源、溢出伤害）属 P5 交互第 3 条',
    ]),
    note: 'X 的四种口径：固定值、每调查员、警报等级（06228）、剧本参考卡伤害数（06273）；清空前头领不可击败，溢出伤害逐张扣。',
  },
  {
    id: 'veiled',
    kind: 'printed',
    printed: 'Veiled',
    zh: '掩藏',
    ruleId: 'tdeVeiled',
    mechanismId: 'veiled',
    ruleOwned: true,
    implemented: true,
    sourceKind: 'text',
    pattern: 'Veiled|掩藏',
    cardCodes: Object.freeze([
      '06127', '06129', '06130', '06131', '06132', '06133', '06135', '06136',
      '06137', '06138', '06139', '06140', '06141', '06142', '06143',
      '06254', '06257', '06258', '06261', '06262', '06263', '06264', '06265',
    ]),
    engine: Object.freeze([
      {
        module: 'src/engine/veiled.js',
        names: ['isVeiledLocation', 'veiledFlipBlockedReason', 'canFlipVeiledLocation', 'flipVeiledLocation', 'shuffleVeiledIntoDeck', 'normalizeVeiledScenario'],
        values: [],
      },
    ]),
    deferred: Object.freeze([
      '翻面动作接进调查/移动流程与故事卡阅读器（P8）；A2 的 b 面故事卡文本属 P8-T',
    ]),
    note: 'P4 更正：掩藏地点以已揭示面入场，「无线索时 [fast] 翻面」才是关键词规则；P3 曾误写成「翻面前不可调查」，见 docs/tde-p4-report.md §4。',
  },
  {
    id: 'researched',
    kind: 'printed',
    printed: 'Researched',
    zh: '研究完成',
    ruleId: 'tdeResearched',
    mechanismId: 'researched',
    ruleOwned: true,
    implemented: true,
    sourceKind: 'text',
    pattern: 'Researched|研究完成',
    cardCodes: Object.freeze(['06236', '06237', '06238']),
    // 购买/升级限制的读点是既有的 researchRequirement 门禁（与 02/03/04 段的
    // 「奇怪的溶液 / 古代雕文 / 古代石」共用），TDE 三张梦境日记在 P7 声明记录键。
    engine: Object.freeze([
      {
        module: 'src/campaign/campaign.js',
        names: ['replacementAnalysis', 'replacementOptions', 'replacementBlockers', 'availablePurchases'],
        values: [],
      },
      { module: 'src/engine/ability.js', names: ['registeredEntry'], values: [] },
    ]),
    deferred: Object.freeze([
      'P7 已在 06236/06237/06238 条目声明 researchRequirement: youHaveInterpretedTheDreams（记录由 06112 的 api.recordResearch 写入）；'
        + '战役层写入该记录的章节流程属 P8',
    ]),
    note: '研究完成不是游戏内能力：它限制购入时机（战役日志记录研究结果后），不改变检定/行动/数值。',
  },
  {
    id: 'alert',
    kind: 'printed',
    printed: 'Alert',
    zh: '警戒',
    ruleId: 'alert',
    mechanismId: 'alert',
    // 路线图 §6：警戒复用核心规则条目，不新建重复条目。
    ruleOwned: false,
    implemented: true,
    sourceKind: 'text',
    pattern: 'Alert|警戒',
    cardCodes: Object.freeze(['06105', '06107', '06227', '06308', '06311']),
    engine: Object.freeze([
      { module: 'src/engine/combat.js', names: ['createCombat'], values: [] },
    ]),
    deferred: Object.freeze([
      'Alert + Swarming 的反击归属（蜂拥卡是否也反击）与 Alert + Massive 的攻击顺序留给 P8 章节接线时逐卡确认',
    ]),
    note: '核心读点已存在：躲避失败后未横置的警戒敌人攻击躲避者；本循环只需确认与蜂拥/庞大的组合。',
  },
  {
    id: 'hidden',
    kind: 'printed',
    printed: 'Hidden',
    zh: '隐私',
    ruleId: 'hidden',
    mechanismId: 'hidden',
    ruleOwned: false,
    implemented: true,
    sourceKind: 'text',
    pattern: 'Hidden|隐私',
    cardCodes: Object.freeze([
      '06017', '06087', '06088', '06089', '06293', '06299', '06306', '06307', '06308',
      '06309', '06310', '06314', '06315', '06316', '06317', '06319', '06320', '06321',
    ]),
    engine: Object.freeze([
      { module: 'src/engine/hidden-rules.js', names: ['createHiddenRules'], values: [] },
    ]),
    deferred: Object.freeze([
      '敌人形态的隐私卡（06306–06310）在手牌中被攻击/躲避的入口属 P8；隐私投影按座位过滤属 P5/P8',
      '本循环 18 张全部带险境（Peril），与核心隐私条目一致，不新增组合规则',
    ]),
    note: '核心隐私语义（手牌即威胁区、能力只由持有者触发、不能按普通方式弃掉）由 TCU 已交付；本循环确认敌人形态的差异并登记为 P8 待接。',
  },
  {
    id: 'bonded',
    kind: 'printed',
    printed: 'Bonded',
    zh: '绑定',
    ruleId: 'tdeBonded',
    mechanismId: 'bonded',
    ruleOwned: true,
    implemented: true,
    sourceKind: 'text',
    pattern: 'Bonded|绑定',
    cardCodes: Object.freeze([
      '06013', '06014', '06015a', '06015b', '06018', '06019', '06021', '06022', '06024',
      '06025', '06027', '06028', '06030', '06031', '06032', '06033', '06112', '06113',
      '06236', '06237', '06238', '06276', '06277', '06282', '06283', '06330', '06331',
    ]),
    engine: Object.freeze([
      {
        module: 'src/engine/bonded.js',
        names: ['bondedCardList', 'isBondedCopy', 'findBondedMain', 'bondedSetProjection', 'createBonded'],
        values: [],
      },
      {
        module: 'src/engine/bonded-location.js',
        names: ['bondedCodesOf', 'placeBondedLocation', 'bondedPartnerOf', 'removeBondedLocation', 'normalizeBondedLocations'],
        values: [],
      },
    ]),
    deferred: Object.freeze([
      '绑定弱点敌人（06025/06283）的场外实体与「无主卡在场则放回场外」的接线属 P8',
      '06025/06283 的绑定关系只写在卡文（Bonded (Crystallizer of Dreams)），cards-data 没有 bonded 字段：P7 在单卡条目里声明',
      '梦境之门作为地点实体入场后的移动/离开处理属 P8（放置原语已在 P3.13 交付）',
    ]),
    note: 'D5 决策（P4）：新立 tdeBonded 条目，不复用 tcuBonded——本循环多了地点绑定（06015a/b）与绑定弱点敌人，且《梦的本质》的「每种绑定卡只放 1 张」需要单独讲清。',
  },
])

// 17 条规则书条目 id（TDE 自有）。`alert` / `hidden` 复用核心条目，不在此列。
export const TDE_RULE_IDS = Object.freeze([
  'tdeCampaign', 'tdeDreamQuest', 'tdeWebOfDreams', 'tdeChaos', 'tdeRecords', 'tdeEpilogue',
  'tdeMyriad', 'tdeSwarming', 'tdeVeiled', 'tdeResearched', 'tdeBonded',
  'tdeDreamGate', 'tdeInfestationBag', 'tdeAlarmLevel', 'tdeSignsOfTheGods', 'tdeStoryAssets',
  'tdeLocationDoom',
])

// 机制扫描里声明 keyword 的机制 id（7 条）；顺序无关，测试按集合比对。
export const TDE_SCANNED_KEYWORD_MECHANISMS = Object.freeze([
  'alert', 'bonded', 'hidden', 'myriad', 'researched', 'swarming', 'veiled',
])

// 两套基础混乱袋（参考实现 Campaigns/TheDreamEaters/ChaosBag.hs 逐枚对齐）。
// 标记名与引擎一致：数字用 '+1'/'0'/'-1'…，符号用 skull/cultist/tablet/elder_thing/autofail/eldersign。
// A 线（梦寻）没有骷髅与古神，B 线（梦网）没有石板；枚数 A 14/14/15/16、B 17/17/18/19。
export const TDE_CHAOS_BAGS = Object.freeze({
  A: Object.freeze({
    easy: Object.freeze(['+1', '+1', '0', '0', '0', '-1', '-1', '-2', '-2', 'cultist', 'tablet', 'tablet', 'autofail', 'eldersign']),
    standard: Object.freeze(['+1', '0', '0', '-1', '-1', '-2', '-2', '-3', '-4', 'cultist', 'tablet', 'tablet', 'autofail', 'eldersign']),
    hard: Object.freeze(['0', '0', '-1', '-1', '-2', '-2', '-3', '-3', '-4', '-5', 'cultist', 'tablet', 'tablet', 'autofail', 'eldersign']),
    expert: Object.freeze(['0', '-1', '-1', '-2', '-2', '-3', '-4', '-4', '-5', '-6', '-8', 'cultist', 'tablet', 'tablet', 'autofail', 'eldersign']),
  }),
  B: Object.freeze({
    easy: Object.freeze(['+1', '+1', '0', '0', '0', '-1', '-1', '-1', '-2', '-2', 'skull', 'skull', 'cultist', 'elder_thing', 'elder_thing', 'autofail', 'eldersign']),
    standard: Object.freeze(['+1', '0', '0', '-1', '-1', '-1', '-2', '-2', '-3', '-4', 'skull', 'skull', 'cultist', 'elder_thing', 'elder_thing', 'autofail', 'eldersign']),
    hard: Object.freeze(['0', '0', '0', '-1', '-1', '-2', '-2', '-3', '-3', '-4', '-5', 'skull', 'skull', 'cultist', 'elder_thing', 'elder_thing', 'autofail', 'eldersign']),
    expert: Object.freeze(['0', '-1', '-1', '-2', '-2', '-3', '-3', '-4', '-4', '-5', '-6', '-8', 'skull', 'skull', 'cultist', 'elder_thing', 'elder_thing', 'autofail', 'eldersign']),
  }),
})

// 两线的基础袋符号构成（规则书 `tdeChaos` 与测试共用，避免手写数字）。
export const TDE_CHAOS_FACTS = Object.freeze({
  A: Object.freeze({ sizes: Object.freeze({ easy: 14, standard: 14, hard: 15, expert: 16 }), symbols: Object.freeze({ cultist: 1, tablet: 2, autofail: 1, eldersign: 1 }) }),
  B: Object.freeze({ sizes: Object.freeze({ easy: 17, standard: 17, hard: 18, expert: 19 }), symbols: Object.freeze({ skull: 2, cultist: 1, elder_thing: 2, autofail: 1, eldersign: 1 }) }),
})

export const tdeKeyword = id => TDE_KEYWORDS.find(keyword => keyword.id === id) || null
export const tdeKeywordByRule = ruleId => TDE_KEYWORDS.find(keyword => keyword.ruleId === ruleId) || null
