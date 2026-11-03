// 食梦者（The Dream Eaters）逐卡验收备注注册表。
//
// 这是**人工/代理逐卡行为审计的补充说明**，不是验收状态的事实源：逐卡自动测试状态由
// `tools/audit-tde-all-cards.mjs` 实跑 `TDE <code>` 测试后写进
// `audit/tde-all-card-acceptance.json` 与 `src/cards/tde-campaign-acceptance.js`。
//
// 本轮已补全旧简化；原始逐卡备注、章节缺口与实现证据保存在
// audit/tde-completion-review.json 和 audit/tde-scenario-gap-triage.json。
// 新发现的未完成子句必须重新登记，发布门禁要求集合为空。
export const TDE_CARD_ACCEPTANCE_NOTES = {}

// P8 的 12 条 behavior.scenarioGaps 落卡映射（来自 audit/tde-scenario-gap-triage.json）：
// chapterId → 受影响卡号（必须都是 simplified）。章节级 gap（无法落到单卡时）锚到该章的
// 剧本参考卡/机制核心卡，note 写明章节级理由。
export const TDE_SCENARIO_GAP_CARDS = {}

// P8 的 12 条 gap 逐条评审账本（与 behavior.scenarioGaps 原文一一对应）。
export const TDE_SCENARIO_GAP_TRIAGE_FILE = 'audit/tde-scenario-gap-triage.json'

// P6 调查员简化 = 0：P6 的 3 处历史简化（卢克 asIfEvent、梦境之门 06013/06014、06017 隐私敌人）
// 已在 P6/P8 还账，条目无 simplified 标记；audit/tde-investigators.json 的 simplified 也为 []。
export const TDE_P6_SIMPLIFICATION_CODES = Object.freeze([])

// 10 条 noEntry 记录（P8 口径：8 张剧本参考卡 + 2 张背面故事面）：
// 它们没有一卡一文件的单卡条目，但都在章节 definition/behavior 里有实现落点，逐卡测试按
// 「剧本参考卡 = 本章 definition/behavior」「背面故事面 = 主卡翻面流程 + 章节行为」验收。
export const TDE_NO_ENTRY_CODES = Object.freeze([
  '06039', '06063', '06119', '06168', '06206', '06247', '06286', '06333', '06057b', '06058b',
])
export const TDE_NO_ENTRY_REASONS = Object.freeze({
  '06039': '剧本参考卡：实现 = Beyond the Gates of Sleep 章节 definition/behavior（manifest.referenceCode）',
  '06063': '剧本参考卡：实现 = Waking Nightmare 章节 definition/behavior（manifest.referenceCode）',
  '06119': '剧本参考卡：实现 = The Search for Kadath 章节 definition/behavior（manifest.referenceCode）',
  '06168': '剧本参考卡：实现 = A Thousand Shapes of Horror 章节 definition/behavior（manifest.referenceCode）',
  '06206': '剧本参考卡：实现 = Dark Side of the Moon 章节 definition/behavior（manifest.referenceCode）',
  '06247': '剧本参考卡：实现 = Point of No Return 章节 definition/behavior（manifest.referenceCode）',
  '06286': '剧本参考卡：实现 = Where the Gods Dwell 章节 definition/behavior（manifest.referenceCode）',
  '06333': '剧本参考卡：实现 = Weaver of the Cosmos 章节 definition/behavior（manifest.referenceCode）',
  '06057b': '背面故事面：无单卡条目；谈判/击败分支由 06057 敌人条目翻面流程 api.cardFlip 展示正文',
  '06058b': '背面故事面：无单卡条目；谈判/击败分支由 06058 敌人条目翻面流程 api.cardFlip 展示正文',
})
