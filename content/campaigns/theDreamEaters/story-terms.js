// 《食梦者》剧情自译术语表（P8-T 批 00，glossaryVersion = 'tde-terms-v1'）。
//
// 口径（路线图 §8.5 / D2）：
//   · 中文剧情采用**自译补齐**，不是官方中文：story-text.js 的 meta 必须保留
//     `sourceKind: 'self-translated'` 与 `officialChinese: false`，不得写成官方来源；
//   · 专名基线以 `src/cards/cards-data.js` 的中文卡名（340 个 TDE 卡名对）与
//     `record-labels.js` 的 55 个记录标签为准——同一张卡/同一个记录键在剧情里**必须**同词；
//   · 7 个关键词用官方中文词形：多重 / 蜂拥 / 掩藏 / 研究完成 / 警戒 / 隐私 / 绑定；
//   · 本文件只登记「需要跨章节保持一致」的术语与高风险词形；逐卡专名由工具直接从
//     cards-data 生成对照表（`tools/import-tde-story.mjs --extract` 的 glossary.md），不在此重复。
//
// 维护：术语改动 → 改本文件 version → `node tools/import-tde-story.mjs --write` 重生成
// story-text.js/账本（generatedSha256 会变）→ `npm run check:tde:terms` → `npm run test:tde:story`。

export const TDE_STORY_TERMS_META = Object.freeze({
  version: 'tde-terms-v1',
  sourceKind: 'self-translated',
  officialChinese: false,
  // 剧情正文统一用中文全角标点；引号用「」/“”；讨论卡牌关键词时保留英文原文在括号里（首次出现）。
  style: Object.freeze({
    punctuation: 'full-width',
    quote: '「」与“”',
    keywordFirstMention: '中文词形（English）',
    noMarkup: '不写 HTML；不写 _斜体_/*强调*（UI 不解析）；图标用 [skull] 这类方括号记号',
    paragraphs: '段落之间保留空行（\\n\\n）；规则条目前缀 • ；分支指引写「前往〈设置〉。」',
  }),
})

/** 7 个关键词的官方中文词形（P4 `keywords.js` 同源）。 */
export const TDE_KEYWORD_TERMS = Object.freeze([
  { en: 'Myriad', zh: '多重' },
  { en: 'Swarming', zh: '蜂拥' },
  { en: 'Veiled', zh: '掩藏' },
  { en: 'Researched', zh: '研究完成' },
  { en: 'Alert', zh: '警戒' },
  { en: 'Hidden', zh: '隐私' },
  { en: 'Bonded', zh: '绑定' },
])

/** 8 章标题（与 `shared.js` 的 chapters.name 一致）。 */
export const TDE_CHAPTER_TITLES = Object.freeze([
  { id: 'beyondTheGatesOfSleep', en: 'Beyond the Gates of Sleep', zh: '梦境门外' },
  { id: 'wakingNightmare', en: 'Waking Nightmare', zh: '清醒噩梦' },
  { id: 'theSearchForKadath', en: 'The Search for Kadath', zh: '寻觅卡达斯' },
  { id: 'aThousandShapesOfHorror', en: 'A Thousand Shapes of Horror', zh: '万千骇形' },
  { id: 'darkSideOfTheMoon', en: 'Dark Side of the Moon', zh: '月之暗面' },
  { id: 'pointOfNoReturn', en: 'Point of No Return', zh: '无归之地' },
  { id: 'whereTheGodsDwell', en: 'Where the Gods Dwell', zh: '神居之所' },
  { id: 'weaverOfTheCosmos', en: 'Weaver of the Cosmos', zh: '编织宇宙' },
])

/** 双线名称（与 `shared.js` 的 PARTS 一致）。 */
export const TDE_PART_TITLES = Object.freeze([
  { en: 'The Dream-Quest', zh: '梦寻' },
  { en: 'The Web of Dreams', zh: '梦网' },
])

/** 5 位调查员（与 cards-data 中文名一致）。 */
export const TDE_INVESTIGATOR_TITLES = Object.freeze([
  { en: 'Tommy Muldoon', zh: '托米·马尔登' },
  { en: 'Mandy Thompson', zh: '曼蒂·汤普森' },
  { en: 'Tony Morgan', zh: '托尼·摩尔根' },
  { en: 'Luke Robinson', zh: '卢克·罗宾逊' },
  { en: 'Patrice Hathaway', zh: '派翠丝·海瑟薇' },
])

/**
 * 反复出现的概念词（跨 8 章统一）。`en` 是 en locale 里常见的表达，`zh` 是唯一推荐译法；
 * 只是词表不是机翻替换表——正文按语境翻译，但**名词必须用这里的词**。
 */
export const TDE_CONCEPT_TERMS = Object.freeze([
  { en: 'investigator', zh: '调查员' },
  { en: 'campaign', zh: '战役' },
  { en: 'scenario', zh: '剧本' },
  { en: 'interlude', zh: '幕间' },
  { en: 'epilogue', zh: '尾声' },
  { en: 'prologue', zh: '序章' },
  { en: 'campaign log', zh: '战役日志' },
  { en: 'act', zh: '幕' },
  { en: 'agenda', zh: '密谋' },
  { en: 'location', zh: '地点' },
  { en: 'enemy', zh: '敌人' },
  { en: 'treachery', zh: '诡计' },
  { en: 'asset', zh: '支援' },
  { en: 'event', zh: '事件' },
  { en: 'skill', zh: '技能' },
  { en: 'clue', zh: '线索' },
  { en: 'doom', zh: '毁灭' },
  { en: 'resource', zh: '资源' },
  { en: 'damage', zh: '伤害' },
  { en: 'horror', zh: '恐惧' },
  { en: 'trauma', zh: '创伤' },
  { en: 'experience', zh: '经验' },
  { en: 'victory display', zh: '胜利区' },
  { en: 'victory points', zh: '胜利点' },
  { en: 'chaos token', zh: '混乱标记' },
  { en: 'chaos bag', zh: '混乱袋' },
  { en: 'skill test', zh: '技能检定' },
  { en: 'difficulty', zh: '难度' },
  { en: 'shroud', zh: '隐藏值' },
  { en: 'encounter deck', zh: '遭遇牌库' },
  { en: 'encounter card', zh: '遭遇卡' },
  { en: 'set aside', zh: '放在一边' },
  { en: 'spawn', zh: '生成' },
  { en: 'engage', zh: '交战' },
  { en: 'evade', zh: '躲避' },
  { en: 'fight', zh: '攻击' },
  { en: 'investigate', zh: '调查' },
  { en: 'parley', zh: '谈判' },
  { en: 'swarm card', zh: '蜂拥卡牌' },
  { en: 'host enemy', zh: '头领敌人' },
  { en: 'story card', zh: '剧情卡' },
  { en: 'resolution', zh: '结局' },
  { en: 'no resolution', zh: '无结局' },
  { en: 'Great Ones', zh: '伟大的存在' },
  { en: 'Dreamlands', zh: '幻梦境' },
  { en: 'waking world', zh: '清醒世界' },
  { en: 'Underworld', zh: '地下世界' },
  { en: 'The Dream-Quest', zh: '梦寻' },
  { en: 'The Web of Dreams', zh: '梦网' },
  { en: 'dreamer', zh: '入梦者' },
  { en: 'the black cat', zh: '黑猫' },
  { en: 'Silver Key', zh: '银钥匙' },
  { en: 'Campaign A', zh: '战役 A' },
  { en: 'Campaign B', zh: '战役 B' },
  { en: 'alarm level', zh: '警报等级' },
  { en: 'lead investigator', zh: '首席调查员' },
  { en: 'tally mark', zh: '计数标记' },
  { en: 'Campaign Guide', zh: '剧本手册' },
  { en: 'Elder Ones', zh: '长老' },
])

/**
 * 高风险词形：`wrong` 命中即术语检查失败。只收「高置信、不误伤普通词」的项；
 * 正则以源码形式保存，`tools/check-tde-terms.mjs` 逐条扫描 story-source 的中文。
 */
export const TDE_FORBIDDEN_VARIANTS = Object.freeze([
  { pattern: '梦境之地', correct: '幻梦境', reason: 'Dreamlands 统一译「幻梦境」' },
  { pattern: '群集', correct: '蜂拥', reason: 'Swarming 统一译「蜂拥」' },
  { pattern: '隐蔽地点|隐蔽状态|隐蔽的', correct: '掩藏（地点）', reason: 'Veiled 统一译「掩藏」' },
  { pattern: '隐秘手牌|隐藏手牌', correct: '隐私手牌', reason: 'Hidden 统一译「隐私」' },
  { pattern: '调查者', correct: '调查员', reason: 'investigator 统一译「调查员」' },
  { pattern: '旧日支配者', correct: '伟大的存在', reason: 'Great Ones（梦地诸神）统一译「伟大的存在」；外神/旧神按具体名' },
  { pattern: '苏醒世界', correct: '清醒世界', reason: 'waking world 统一译「清醒世界」' },
  { pattern: '混乱袋标记', correct: '混乱标记', reason: 'chaos token 统一译「混乱标记」' },
  { pattern: '隐秘区|隐藏区', correct: '隐私区', reason: 'Hidden 区统一译「隐私区」' },
])

/** 图标记号（en 源的 {skull} 等与 [skull] 卡面记号）；生成器/校验器要求中英数量一致。 */
export const TDE_ICON_TOKENS = Object.freeze([
  'skull', 'cultist', 'tablet', 'elder_thing', 'elder_sign', 'auto_fail',
  'bless', 'curse', 'frost', 'willpower', 'intellect', 'combat', 'agility', 'wild',
  'fast', 'reaction', 'free', 'action', 'per_investigator',
])

/** 记录标签：中文名以 record-labels.js 为唯一事实源（55 键，自译校对范围外，直接复用）。 */
export const TDE_RECORD_LABEL_SOURCE = 'content/campaigns/theDreamEaters/record-labels.js'
