#!/usr/bin/env node
// 把三份机械扫描候选（story/guides/setup）按人工裁定归并为 docs/translate/findings.json。
//
// 设计：SCAN 负责「全量找候选 + 真实行号」；本文件里的 CURATED 表是**人工复核后的定论**：
//   · 每条 finding 指定匹配条件（campaign/kind/pointer），count 与 samples 由扫描数据复算；
//   · 不匹配任何候选的 finding 会以 count=0 输出并给出警告，防止脚本与数据脱节；
//   · 被判定为噪声/保留项的候选不进入 findings，只在 scan/*.json 里留档。
//
// 用法：node docs/translate/tools/build-findings.mjs --write
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { MOD, lineOfText } from './_shared.mjs'

const SCAN = join(MOD, 'docs/translate/scan')
const OUT = join(MOD, 'docs/translate/findings.json')
const story = JSON.parse(readFileSync(join(SCAN, 'story-candidates.json'), 'utf8'))
const guides = JSON.parse(readFileSync(join(SCAN, 'guides-candidates.json'), 'utf8'))
const setup = JSON.parse(readFileSync(join(SCAN, 'setup-candidates.json'), 'utf8'))
const storyCoverage = JSON.parse(readFileSync(join(SCAN, 'story-coverage.json'), 'utf8'))
const guideCoverage = JSON.parse(readFileSync(join(SCAN, 'guides-coverage.json'), 'utf8'))
const setupCoverage = JSON.parse(readFileSync(join(SCAN, 'setup-coverage.json'), 'utf8'))

const isKind = (...kinds) => candidate => kinds.includes(candidate.kind)
const inCampaign = (...campaigns) => candidate => campaigns.includes(candidate.campaign)
const pointerHas = pattern => candidate => pattern.test(candidate.pointer)

const STORY = story.candidates
const GUIDES = guides.candidates
const SETUP = setup.candidates

const CURATED = [
  // =========================================================================
  // 剧情文本（story）
  // =========================================================================
  {
    id: 'story-0001', area: 'story', category: 'missing-translation', severity: 'high',
    title: '《失落的时代》久远腹地（上/下）导入与结局整段仍是英文原文（故事导入直接显示 Intro 1: / Resolution 1: 英文）',
    match: [STORY, candidate => candidate.campaign === 'theForgottenAge'
      && (isKind('untranslated', 'label-english-label')(candidate))
      && /heartOfTheEldersPart[12]/.test(candidate.pointer)],
    expected: '使用随仓库保存的 `参考资源/.../locales/zh/theForgottenAge/scenarios/heartOfTheElders.json` 的 part1/part2 中文正文（该文件已有完整官方中文），并按段拆分；不要带 "Intro N:" / "Resolution N:" 英文标签。',
    suggestion: '改 `tools/import-tfa-story.mjs` 的来源选择：heartOfTheEldersPart1/2 读 `heartOfTheElders.json` 的 part1/part2，而不是读 upstream 里未译的 `heartOfTheEldersPart1.json`（其 intro 仍是英文）；改完后 `node tools/import-tfa-story.mjs --write` 重生成 `content/campaigns/theForgottenAge/story-text.js`，并把 `tests/tfa-heart-of-the-elders-part1.test.mjs:816` 里 `assert.ok(bare.includes(\'Intro 1:\'))` 改为断言中文正文。',
    sourceKind: 'reference-zh-locale / untranslated-upstream-variant',
    rootCause: 'import-tfa-story.mjs 按 scenarioId 读 `scenarios/<id>.json`；upstream 这几个 id 文件只译了 tokens/label，intro/resolutions 仍是英文；真正的中文在 `scenarios/heartOfTheElders.json` 的 part1/part2。',
  },
  {
    id: 'story-0002', area: 'story', category: 'missing-translation', severity: 'high',
    title: '《万象无终》6 段导入/结局正文仍是英文（含 unionAndDisillusion 的 Additional Intro 与 4 个结局分支）',
    match: [STORY, candidate => candidate.campaign === 'theCircleUndone'
      && isKind('untranslated', 'mixed-language', 'resolution-label-untranslated')(candidate)
      && !/(?:prologue\.sections\.quote|flow\.nodes\.prologue)/.test(candidate.pointer)],
    expected: '按参考英文源逐段补译，保留「结局 N」标题（标题由 UI 生成，正文不要重复标签）；厄琳倒向女巫集会的 Additional Intro 只在调查员与女巫结盟时阅读，尤其不能漏。',
    suggestion: '在 `content/campaigns/theCircleUndone/story-text.js` 对应段落补译（上游 zh locale 缺这几段）；补译后重跑 `npm run import:tcu-story -- --check` 与 `npm run test:tcu:story`。',
    sourceKind: 'reference-zh-locale gap',
  },
  {
    id: 'story-0003', area: 'story', category: 'missing-translation', severity: 'high',
    title: '《食梦者》3 个幕间选择节点的 prompt 仍是英文（选择面板直接显示英文问句）',
    match: [STORY, candidate => candidate.campaign === 'theDreamEaters'
      && candidate.kind === 'untranslated' && /\.prompt$/.test(candidate.pointer)],
    expected: '「我该对你清醒世界的朋友们说些什么呢？」/「黑猫该给你的同伴带什么口信？」等。',
    suggestion: '`content/campaigns/theDreamEaters/interludes.js` 的 INTERLUDE_ONE_DUAL / INTERLUDE_TWO / INTERLUDE_THREE 节点 prompt 是硬编码英文；改成从 story-text 的 label/标题取中文（或补 `promptKey` 走 TDE_STORY_KEYS 本地化）。',
    sourceKind: 'repo-authored',
  },
  {
    id: 'story-0004', area: 'story', category: 'segmentation', severity: 'high',
    title: '《印斯茅斯暗潮》8 关故事导入与部分结局在「调查纪事」中丢失分段（多段 HTML 被 textBlocks() 折成单个 <p>）',
    match: [STORY, candidate => candidate.campaign === 'theInnsmouthConspiracy'
      && candidate.kind === 'display-segmentation' && /^scenarios\./.test(candidate.pointer)],
    expected: '一章导入/结局按原文 `<p>` / `</p>` 拆成多个段落数组元素，故事日志逐段渲染；不要靠 `\\n\\n` 留在同一个字符串里。',
    suggestion: '`content/campaigns/theInnsmouthConspiracy/chapter-definition.js#textBlocks()` 对字符串返回 `[整串]`，导致 `introduction.js`/`resolutions.js#journal()` 的 paragraphs 只有一个元素。改为按 `</p>`/`<li>` 切分成数组（flashbacks.js#story() 已按段落转换，可复用同一转换函数），或让 story-reader 对含 `\\n\\n` 的段落再分段。',
    sourceKind: 'repo-authored display chain',
    rootCause: 'textBlocks 只做标签剥离、不按块切段；story-reader 每个数组元素渲染成一个 <p>，单段内的换行被 HTML 折叠。',
  },
  {
    id: 'story-0005', area: 'story', category: 'symbol-format', severity: 'high',
    title: '《印斯茅斯暗潮》闪现记忆正文泄漏 i18next ICU 转义：玩家看到 `{\'{\'}cultist{\'}\'}` 而不是混乱标记图标',
    match: [STORY, candidate => candidate.campaign === 'theInnsmouthConspiracy' && candidate.kind === 'marker-icu-escape'],
    expected: '`[cultist]` / `[tablet]` / `[elder_thing]` / `[bless]` 等图标记号，由展示层渲染成符号。',
    suggestion: '`flashbacks.js#story()`（以及任何直接展示 STORY_TEXT 正文的路径）在 HTML→纯文本时补 `{\'{\'}x{\'}\'}` → `[x]` 还原（与 `tools/import-scenario-guides.mjs#guideText` 已有替换同口径）；或先在 import-tic-story 生成物里还原。',
    sourceKind: 'upstream-zh-locale escape residual',
  },
  {
    id: 'story-0006', area: 'story', category: 'symbol-format', severity: 'medium',
    title: '《印斯茅斯暗潮》闪现记忆正文保留 Markdown 星号强调（`*与托马斯·道森会面*` 原样显示）',
    match: [STORY, candidate => candidate.campaign === 'theInnsmouthConspiracy' && candidate.kind === 'markdown-emphasis'],
    expected: '「在战役日志的“已恢复的记忆”下记录与托马斯·道森会面」——去掉 `*`，或改成「」书名号/加粗语义。',
    suggestion: 'flashbacks.js#story() 的 HTML→纯文本链补 `*…*`/`_…_` 剥离（TDE/TIC 正文统一无 Markdown 是既定口径）；生成器 import-tic-story 侧同步清理。',
    sourceKind: 'upstream-zh-locale markdown residual',
  },
  {
    id: 'story-0007', area: 'story', category: 'symbol-format', severity: 'medium',
    title: '《失落的时代》幕间三/四用花括号 {cultist}/{skull}/{tablet} 写混乱标记，故事日志原样显示花括号',
    match: [STORY, candidate => candidate.campaign === 'theForgottenAge' && isKind('symbol-brace-token', 'marker-placeholder-brace')(candidate)
      && !/supplies\.choose/.test(candidate.pointer)],
    expected: '卡面记号统一用方括号 `[cultist]`/`[skull]`/`[tablet]`/`[elder_sign]`（`web/card-text.js#SYMBOLS` 只识别方括号）。',
    suggestion: '在 `tools/import-tfa-story.mjs#clean` 把 `{token}` 转成 `[token]`（elderSign→elder_sign），重生成 story-text；`supplies.choose` 的 `{pointsRemaining}` 由 campaign-effects 替换，不在此列。',
    sourceKind: 'reference-zh-locale token format',
  },
  {
    id: 'story-0008', area: 'story', category: 'symbol-format', severity: 'medium',
    title: '《万象无终》隐秘之名 intro3Mystic 首段泄漏 `({mystic})` 花括号职阶记号',
    match: [STORY, candidate => candidate.campaign === 'theCircleUndone' && candidate.kind === 'symbol-brace-token'
      && /intro3Mystic/.test(candidate.pointer)],
    expected: '「（潜修者）：…」或去掉前缀——参考 en 里是职业条件标记，不应把 `{mystic}` 原样展示。',
    suggestion: '在 story-text 该段去掉 `({mystic})` 前缀（投影层本就知道是否有潜修者才读这一段），或改为 `[mystic]`。',
    sourceKind: 'reference-zh-locale residual',
  },
  {
    id: 'story-0009', area: 'story', category: 'segmentation', severity: 'medium',
    title: '结局正文段首重复「结局 N：」标签：标题已由 UI 生成，正文又从头念一遍（TCU 36 / TDE 39 / 敦威治 17 / TIC 15 处）',
    match: [STORY, candidate => candidate.kind === 'resolution-label-duplicate'],
    expected: '结局面板小标题显示「结局 N」，正文直接从叙事开始；正文不要带「结局 N：「」前缀。EOTE 的 `story-access.js#resolutionText()` 已显式剥离该前缀，可作为口径参考。',
    suggestion: '按战役修数据源：TCU/TDE/TIC/Dunwich 的 story-text 结局正文去掉段首标签（生成器 import-*-story 统一 `^结局\\s*\\d*[：:]\\s*` 剥离）；TDE 另有 16 段尾声 localeKeys 正文以「尾声 N：」开头，同样剥离。',
    sourceKind: 'reference-zh-locale + self-translated',
    rootCause: '上游中文来源把「Resolution N:」标题内联进正文；各战役生成器只做 `_`/`*` 清理，没有剥离开头标签。',
  },
  {
    id: 'story-0010', area: 'story', category: 'missing-translation', severity: 'high',
    title: '结局正文段首是英文「Resolution N:」标签（敦威治 5 处、失落的时代 4 处、地球边缘 1 处），中文段落里夹英文标签',
    match: [STORY, candidate => candidate.kind === 'resolution-label-untranslated'],
    expected: '去掉标签（标题由 UI 生成）；若保留分节语义则写「结局 N」。',
    suggestion: '在对应生成器（import-dunwich-story / import-tfa-story / EOTE 生成链）统一剥离/翻译段首标签；同时把「结局标题」补进指南结构，避免中文靠正文标签区分分支。',
    sourceKind: 'reference-zh-locale / upstream mix',
  },
  {
    id: 'story-0011', area: 'story', category: 'mixed-language', severity: 'medium',
    title: '《地球边缘》残留英文标签与短句（"Resolution 3:" / "Intro 3:" 等），EOTE 翻译修复批次未清干净',
    match: [STORY, candidate => candidate.campaign === 'edgeOfTheEarth'
      && isKind('label-english-label', 'resolution-label-untranslated', 'untranslated')(candidate)
      && /story-text\.js$/.test(candidate.file || '') && !/literal@/.test(candidate.pointer)],
    expected: '标题层已显示「结局 3」「引言 3」，正文段首不应再有英文标签；EOTE 的 story-text 应有纯中文正文。',
    suggestion: '在 `content/campaigns/edgeOfTheEarth/story-text.js` 的 zh 叶子里剥离 `Resolution N:` / `Intro N:` / `Scenario I:` 前缀，重跑 `node tools/import-eote-story.mjs --check`；核查为什么这批未进入既有 chineseGaps（可能是补译层手工写入时带入）。',
    sourceKind: 'generated / locale-supplement',
  },
  {
    id: 'story-0012', area: 'story', category: 'marker-leak', severity: 'medium',
    title: '《地球边缘》5 处 `[count]` 占位符残留（label / specialRules），当前实现没有替换点，一旦渲染就是字面量',
    match: [STORY, candidate => candidate.campaign === 'edgeOfTheEarth' && candidate.kind === 'marker-named-placeholder'],
    expected: '占位符由消费端替换成实际数字，或直接改写为「若干/等同于…」的正文；不能把 `[count]` 暴露给玩家。',
    suggestion: '`content/campaigns/edgeOfTheEarth/story-text.js`（以及 locale-supplement 源）把 `{count}` 改写为可读文本，或在 story-access/record label 渲染处实现替换；同时巡检 `[shelterValue]` 同类占位符（en 指南面板 3 处）。',
    sourceKind: 'generated',
  },
  {
    id: 'story-0013', area: 'story', category: 'coverage', severity: 'medium',
    title: '《食梦者》英文回退源保留 60 条英文原文：当前 pendingTranslation 已全部为 false，不会进界面，但需要保留回归断言',
    match: [STORY, candidate => false],
    metrics: { englishFallbackSource: story.summary.localizedFallbackSource },
    expected: 'interludes.js / dual-story.js 的英文原文只作回退；一旦 story-text 缺键，UI 不得静默显示英文。',
    suggestion: '保留 `tests/tde-story.test.mjs` 的 `pendingTranslation === false` 断言；新增/改键时先补中文再重生成。',
    sourceKind: 'locked-english-fallback',
  },
  {
    id: 'story-0014', area: 'story', category: 'terminology', severity: 'medium',
    title: '简繁混用：剧情正文 155 段命中繁体用字，其中台湾译文「著」（应为「着」）约 320 处；卡面/规则书为简体「着」',
    match: [STORY, candidate => candidate.kind === 'traditional-chars'],
    metrics: (() => {
      const rows = Object.values(storyCoverage.campaigns)
      return rows.filter(row => row.zhu + row.traditionalTotal > 0).map(row => ({ campaign: row.campaign, zhu: row.zhu, traditional: row.traditionalTotal }))
    })(),
    expected: '剧情/指南与卡面/规则书统一简体用字（「着」），专名除外。',
    suggestion: '按战役批量替换（先处理 \'著\'→\'着\'，人工复核 著名/著作/土著/显著 等合法词）；来源是参考 zh locale 的台湾译文，EOTE 修复批次已示范过同类清理。',
    sourceKind: 'upstream-zh-locale orthography',
  },
  {
    id: 'story-0015', area: 'story', category: 'format', severity: 'low',
    title: '剧情正文标点/排版机械问题：CJK 后接半角标点 28 处、引号不配对 42 处、中文前多余空格 11 处等',
    match: [STORY, candidate => candidate.kind.startsWith('punct-')],
    expected: '中文正文统一全角标点，引号成对，CJK 与标点之间不留空格。',
    suggestion: '按扫描候选逐条清理；多来自上游 zh locale，可在各 import-*-story 生成器统一做确定性替换。',
    sourceKind: 'upstream-zh-locale punctuation',
  },
  {
    id: 'story-0016', area: 'story', category: 'coverage', severity: 'low',
    title: '剧情正文里的英文虚词残留多为「作品名引用」（如 Lovecraft 英文篇名），保留时需与中文引用格式统一',
    match: [STORY, candidate => false],
    metrics: { note: '参考 story-0016 旧候选：flow prologue 引文里 The Dreams in the Witch House 属英文作品名，保留但建议加书名号并标注原文；TFA 用《超越时空之影》中文译名，两处风格不一致。' },
    expected: '同一类「作品引用」在剧情中的写法一致（中文译名 / 原文名并列）。',
    suggestion: '在战役故事文本层统一引文格式；不要求把作品名强行翻译。',
    sourceKind: 'upstream-zh-locale',
  },

  // =========================================================================
  // 引导文本（guides）
  // =========================================================================
  {
    id: 'guides-0001', area: 'guides', category: 'vague', severity: 'high',
    title: '中文冒险指南成段丢失分支收尾/去向指引：17 关分支指令数显著少于英文（TDE《神居之所》22→5、TCU《聚合幻灭》16→6、TFA《命运之线》13→4 等）',
    match: [GUIDES, candidate => isKind('branch-count-deficit', 'branch-instruction-missing')(candidate)
      || (candidate.kind === 'branch-target-missing'
        && !/(?:转至|转到|介绍|设置|阅读|进入|跳至|前往|继续)/.test(String(candidate.evidence || '')))],
    expected: '每个条件分支都以「前往〈引言 N〉/跳至结局 N/进入冒险设置」收束；不得停在「检查剧本日志。如果……」这种半句。',
    suggestion: '以英文指南为对照，逐关补译缺失的分支行；典型证据：`web/scenario-guides/whereTheGodsDwell.json` 中文 story 段缺少 Ground Design 分支（en 22 处 vs zh 5 处），`shatteredAeons` 开场只剩「检查剧本日志。如果你点燃了火盆」。来源锁在参考 zh locale，需要在生成前补译进 `content/scenario-guide-translations.json` 或战役自译源。',
    sourceKind: 'reference-zh-locale gaps',
    rootCause: '参考工程 zh locale 的指南本身缺分支收尾（英文由 en locale 生成），生成器按 locale 逐块取文本，缺项没有显式 missing 标记。',
  },
  {
    id: 'guides-0002', area: 'guides', category: 'missing-translation', severity: 'high',
    title: '中文指南残留整行英文「Proceed to Setup / Proceed to Intro / Proceed to Scenario」（3 处，玩家读到的下一步指引是英文）',
    match: [GUIDES, candidate => candidate.kind === 'mixed-language'
      && /^Proceed to/.test(String(candidate.evidence || ''))],
    expected: '「进入冒险设置」「继续阅读引言」「前往下一场冒险」。',
    suggestion: '`content/scenario-guide-translations.json` 为 `atDeathsDoorstep`、`disappearanceAtTheTwilightEstate` 补这些过渡句译文；重跑 `node tools/import-scenario-guides.mjs --write`。',
    sourceKind: 'reference-zh-locale',
  },
  {
    id: 'guides-0003', area: 'guides', category: 'mixed-language', severity: 'medium',
    title: '中文指南保留英文小标题/连接词：`Intro N:`、`Resolution N:`、`Scenario I:` 等英文标签 15 处，另有中文句中 `and` 等连接词',
    match: [GUIDES, candidate => (isKind('label-english-label', 'mixed-language-word')(candidate)
      && !/Proceed to/.test(String(candidate.evidence || '')))],
    expected: '「引言 N：」「结局 N」「剧本 I：」；连接词用「、/以及」。',
    suggestion: '上游 zh locale 把 Intro/Resolution 标记留成英文；在指南生成器的 zh 分支统一替换（`Intro\\s*(\\d+)`→`引言 $1` 等），并修 `and` 句；TIC 的「ph\'nglui mglw\'nafh…」咒语属保留项，不做替换。',
    sourceKind: 'upstream-zh-locale',
  },
  {
    id: 'guides-0004', area: 'guides', category: 'symbol-format', severity: 'medium',
    title: '遭遇组图标清单整体缺失：61 份中文指南的 setup 都写着「这些遭遇组由以下图标标示：」，后面没有任何图标（87 处）',
    match: [GUIDES, candidate => candidate.kind === 'icon-sentence-dangling'],
    expected: '句后展示对应遭遇组图标（官方指南的 icon 行），玩家据此核对遭遇组。',
    suggestion: '`tools/import-scenario-guides.mjs#guideText()` 把 `<section class="encounter-sets"><img …></section>` 整段剥掉了，导致中文/英文面板都只剩悬空句。两种修法：①生成期把该 section 转成文本（如「聚集于此、老鼠…」已有名单则删掉「图标」句）；②把图标 alt/遭遇组名渲染成 token/文本列表。en 面板同缺陷，属生成器问题而非翻译问题。',
    sourceKind: 'generated (generator strips <img> section)',
    rootCause: 'guideText 的 `.replace(/<img[^>]*>/gi, \'\')` + `<section class=\'encounter-sets\'>` 整体删除。',
  },
  {
    id: 'guides-0005', area: 'guides', category: 'symbol-format', severity: 'medium',
    title: '《食梦者·梦境门外》14 个梦境条目的职阶图标（[guardian]/[seeker]/[rogue]/[mystic]/[survivor]…）在中文指南中全部丢失（命中 10 个文本块）',
    match: [GUIDES, candidate => candidate.scenario === 'beyondTheGatesOfSleep' && candidate.kind === 'icon-count-mismatch'],
    expected: '「守卫者（[guardian]）之梦」——玩家按职阶选梦境，图标/职阶必须可见。',
    suggestion: 'zh locale 的 14 条梦境标题缺 `([class])` 标记；优先修 `web/scenario-guides/beyondTheGatesOfSleep.json` 的生成来源（参考 zh locale / TDE 自译源），补回职阶 token。',
    sourceKind: 'reference-zh-locale',
  },
  {
    id: 'guides-0006', area: 'guides', category: 'symbol-format', severity: 'medium',
    title: '英文指南面板 3 处 `[shelterValue]` 占位符原样显示（中文侧已改写为「营地庇护值」，英文侧没有）',
    match: [GUIDES, candidate => candidate.kind === 'unresolved-placeholder'],
    expected: '「Shelter Value: （记录营地庇护值）」或在运行时替换为记录值；不能显示内部占位符。',
    suggestion: 'EOTE 生成链 `localizePlaceholders` 只处理 `{xp}/{name}/{key}/{perPlayer}/{fast}`；`[shelterValue]` 应在指南文本改写或渲染层替换。',
    sourceKind: 'generated',
  },
  {
    id: 'guides-0007', area: 'guides', category: 'missing-translation', severity: 'high',
    title: '《食梦者》中文指南成块缺失：whereTheGodsDwell 缺 11 块、weaverOfTheCosmos 缺 4 块（故事/结局的分支收尾与「宏大计划」分支整段没有中文）',
    match: [GUIDES, candidate => candidate.kind === 'block-missing-in-zh' && candidate.severity === 'high'],
    expected: '按 en 指南逐块补译，不得只剩叙事、丢掉分支/结算块。',
    suggestion: '这两关的中文来自 TDE 自译 story-text（sections.story/resolutions），缺块说明自译源缺键；补 `content/campaigns/theDreamEaters/story-source/` 对应条目后重跑 `node tools/import-tde-story.mjs --write` 与 `node tools/import-scenario-guides.mjs --write`。',
    sourceKind: 'self-translated gap',
  },
  {
    id: 'guides-0008', area: 'guides', category: 'symbol-format', severity: 'low',
    title: '中文指南图标 token 与英文数量不一致（如「移除所有…然后各加1个」省略重复 token；封印/庇护值等）',
    match: [GUIDES, candidate => candidate.kind === 'icon-count-mismatch'
      && !/beyondTheGatesOfSleep/.test(candidate.scenario)],
    expected: '需要玩家点击/放置的每个图标在中文里都能对应到明确 token（至少保留 `[cultist]` 等）。',
    suggestion: '逐条复核：语义完整的中文简写可保留（如「各加1个」），涉及具体混乱标记/封印的必须保留 token；建议在生成器做「en 去重后 token 集合 ⊆ zh token 集合」校验。',
    sourceKind: 'reference-zh-locale 简写',
  },
  {
    id: 'guides-0009', area: 'guides', category: 'terminology', severity: 'medium',
    title: '中文指南简繁混用：127 段命中繁体用字，其中「著」（应为「着」）约 329 处（TIC 164 / TCU 111 / TDE 35 / NOTZ 11 / Dunwich 8）',
    match: [GUIDES, candidate => candidate.kind === 'traditional-chars'],
    metrics: (() => Object.values(guideCoverage.orthography).filter(row => row.zhu + row.traditionalTotal > 0)
      .map(row => ({ campaign: row.campaign, zhu: row.zhu, traditional: row.traditionalTotal })))(),
    expected: '指南与卡面/规则书一样使用简体（「着」）。',
    suggestion: '在参考 zh locale 与 TDE 自译源统一替换；EOTE 修复批次已有同类改写脚本可参考。',
    sourceKind: 'upstream-zh-locale orthography',
  },
  {
    id: 'guides-0010', area: 'guides', category: 'format', severity: 'low',
    title: '中文指南标点机械问题：CJK 后接半角标点 201 处、引号不配对 25 处、半角括号 19 处等',
    match: [GUIDES, candidate => candidate.kind.startsWith('punct-')],
    expected: '中文标点全角、引号成对、CJK 与英文 token 之间空格统一。',
    suggestion: '生成器 `tools/import-scenario-guides.mjs` 的 zh 分支做确定性标点规整（EOTE 修复批次已示范「。.」「, 」等批量替换）。',
    sourceKind: 'upstream-zh-locale punctuation',
  },
  {
    id: 'guides-0011', area: 'guides', category: 'structure', severity: 'low',
    title: '中文指南把「No Resolution / Resolution N」标题内联进正文，导致 zh/en 块结构不一致（5 处结构差异，标题层没有中文）',
    match: [GUIDES, candidate => candidate.kind === 'structure-diff-inline'],
    expected: '结局块保留与英文一致的标题层（「未达成结局」「结局 1」），正文不重复标签。',
    suggestion: '属上游 zh locale 结构差异；补 title 层或在生成器把正文首标签提升为 title。',
    sourceKind: 'reference-zh-locale structure',
  },

  // =========================================================================
  // 关卡设置文本（setup）
  // =========================================================================
  {
    id: 'setup-0001', area: 'setup', category: 'symbol-format', severity: 'high',
    title: '《印斯茅斯暗潮·达贡巢穴》场景设置文本残留 ICU 转义 `{\'{\'}bless{\'}\'}` / `{\'{\'}curse{\'}\'}`（设置回退面板会原样显示）',
    match: [SETUP, candidate => candidate.kind === 'setup-marker-icu-escape'],
    expected: '`[bless]` / `[curse]`，或「祝福标记／诅咒标记」。',
    suggestion: '在 `content/campaigns/theInnsmouthConspiracy` 的 setup 生成本身还原 ICU 转义（与 story-0005 同一根因），或设置面板渲染前统一还原。',
    sourceKind: 'upstream-zh-locale escape residual',
  },
  {
    id: 'setup-0002', area: 'setup', category: 'mixed-language', severity: 'medium',
    title: '《印斯茅斯暗潮》8 关场景设置正文是未清理的 HTML/Markdown 串：保留 `*遭遇组名*` 星号、`<p>` 折叠、悬空的「图标」句',
    match: [SETUP, candidate => candidate.campaign === 'theInnsmouthConspiracy'
      && isKind('setup-long-block', 'setup-single-newline-block')(candidate)],
    expected: '设置步骤为纯文本句子列表，不出现 `*` 强调符或「以下图标表示：」悬空句。',
    suggestion: 'TIC 的 `definition.setup` 来自 `textBlocks(story.setup…)`；补 `*…*` 剥离与图标句处理（或直接复用指南 setup 的中文步骤），不要让设置回退面板显示 Markdown。',
    sourceKind: 'generated',
  },
  {
    id: 'setup-0003', area: 'setup', category: 'coverage', severity: 'low',
    title: '6 关场景数据没有 `setup` 文本（敦威治 6 关），设置面板的「步骤」完全依赖指南 JSON 加载成功',
    match: [SETUP, candidate => candidate.kind === 'scenario-setup-empty'],
    expected: '场景数据至少有可回退的布置摘要（设置面板加载失败时显示），与完整指南互补。',
    suggestion: '为 theMiskatonicMuseum / theEssexCountyExpress / bloodOnTheAltar / undimensionedAndUnseen / whereDoomAwaits / lostInTimeAndSpace 补 `content/scenario-guides.js` 的 setup 摘要（参照 theGathering 等已有写法）。',
    sourceKind: 'content gap',
  },
  {
    id: 'setup-0004', area: 'setup', category: 'structure', severity: 'low',
    title: '关卡名中英混排不统一：TDE 仅前两关带英文原名，EOTE 5 关带英文原名；其余战役为纯中文',
    match: [SETUP, candidate => candidate.kind === 'scenario-name-mixed'],
    expected: '同一战役内关卡名格式一致（要么统一「中文 · English」，要么统一中文）。',
    suggestion: '由 product 裁定后统一 `content/campaigns/*/chapters.js` / manifest 的 name 字段；catalog 双语展示逻辑不要求 name 里带英文。',
    sourceKind: 'repo-authored',
  },
  {
    id: 'setup-0005', area: 'setup', category: 'coverage', severity: 'low',
    title: '设置层缺口：fatalMirage 无 scenario.intro、3 个结局键为空（noResolution/defeat 走重定向），属实现接线而非翻译缺失',
    match: [SETUP, candidate => isKind('scenario-intro-missing', 'resolution-empty')(candidate)],
    expected: '若这些分支确实不可达，在代码/账本里显式声明；若可达，必须补正文。',
    suggestion: '人工确认 fatalMirage 回场流程与 TIC noResolution 重定向逻辑后，把它标为既定行为并写进本报告附录。',
    sourceKind: 'verification-needed',
  },

  // =========================================================================
  // 跨层
  // =========================================================================
  {
    id: 'cross-0001', area: 'crosscut', category: 'symbol-format', severity: 'medium',
    title: '图标记号书写不统一：剧情用 `{token}` 花括号（TFA 9 处正文）、`[count]` 占位符（EOTE 5 处）、英文指南 `[shelterValue]`（3 处），而渲染器只认 `[token]`',
    match: [STORY, candidate => false],
    metrics: {
      braceTokensInStory: 9, countPlaceholders: 5, shelterValueInEnglishGuides: 3,
      note: '花括号/占位符不会渲染成图标或数字；见 story-0007/0012、guides-0006。',
    },
    expected: '所有玩家可见文本统一 `[token]`；占位符要么替换、要么改成可读文本。',
    suggestion: '在各 import/生成器统一 token 规范化（`{elderSign}`→`[elder_sign]`、ICU 转义还原、拒绝未知 `[xxx]`），并把「渲染器未注册的 `[...]`」列为 CI 检查。',
    sourceKind: 'multi-source',
  },
  {
    id: 'cross-0002', area: 'crosscut', category: 'terminology', severity: 'low',
    title: '「Intro」类译名混用：引言 / 开场 / 介绍 / Intro 并存（TIC 用「导言」、TCU 有「转至介绍 1」、EOTE/Dunwich 残留「Intro N:」）',
    match: [GUIDES, candidate => candidate.kind === 'label-english-label' || (candidate.kind === 'branch-target-missing' && /介绍/.test(String(candidate.evidence || '')))],
    expected: '统一词表：Intro→引言；Resolution→结局；Scenario→冒险/剧本与既有界面用词一致。',
    suggestion: '建立与卡面/规则书一致的术语表，在指南生成器与战役自译源统一替换；`check-tde-terms` 已有类似机制，可扩展到全战役。',
    sourceKind: 'multi-source',
  },
  {
    id: 'cross-0003', area: 'crosscut', category: 'coverage', severity: 'low',
    title: '来源口径：NOTZ/敦威治/卡尔克萨/TFA/TCU/TIC 的剧情与指南来自参考工程 zh locale（部分台湾繁中/上游缺译），TDE 为自译，EOTE 为 zh locale + 本地补译；同一问题要按来源归属修',
    match: [STORY, candidate => false],
    metrics: {
      storySources: {
        nightOfTheZealot: 'reference-zh-locale', theDunwichLegacy: 'reference-zh-locale', thePathToCarcosa: 'reference-zh-locale',
        theForgottenAge: 'reference-zh-locale', theCircleUndone: 'reference-zh-locale', theDreamEaters: 'self-translated',
        theInnsmouthConspiracy: 'reference-zh-locale + self-translated supplements', edgeOfTheEarth: 'reference-zh-locale + locale-supplement',
      },
    },
    expected: '修上游缺译时写到本仓补译源（content/scenario-guide-translations.json / story-source / locale-supplement），重跑生成器，不要手改生成物。',
    suggestion: '按 finding 的 sourceKind 分流：upstream 继承问题在补译层修；generated 问题修生成器；repo-authored 问题直接改内容模块。',
    sourceKind: 'methodology',
  },
  {
    id: 'cross-0004', area: 'crosscut', category: 'coverage', severity: 'low',
    title: '范围说明：本轮不覆盖 5,930 张卡面文本、规则书、交互按钮/技能检定提示与记录标签 UI；EOTE 已有独立翻译审计（docs/edgeOfTheEarth/translate）',
    match: [STORY, candidate => false],
    metrics: { note: 'scope-only finding' },
    expected: '卡面由既有卡牌迁移/审计链路负责；本报告只覆盖剧情、冒险指南、关卡设置三层。',
    suggestion: '后续如要全 Mod 中文验收，把卡面审计与本报告合并成总账本。',
    sourceKind: 'scope',
  },
]

// ---------------------------------------------------------------------------
// 归并：count / samples 由扫描数据复算
// ---------------------------------------------------------------------------
const REL = path => String(path || '').replace(/^.*games\/arkhamhorror\//, '').replaceAll('\\', '/')
const lineCache = new Map()
/** 生成物/指南是 zh/en 混排文件：证据 token 可能先命中英文源，优先返回含中文的那一行。 */
function locateZhEvidence(file, evidence) {
  const path = join(MOD, file)
  const first = lineOfText(path, evidence)
  if (!first || !/(?:story-text\.js|scenario-guides\/)/.test(file)) return first
  if (!lineCache.has(path)) lineCache.set(path, readFileSync(path, 'utf8').split(/\r?\n/))
  const lines = lineCache.get(path)
  const needle = String(evidence).split('\n')[0].slice(0, 12)
  if (needle.length < 4) return first
  for (let index = 0; index < lines.length; index++) {
    if (lines[index].includes(needle) && /[\u3400-\u9fff]/.test(lines[index])) return index + 1
  }
  return first
}
const findings = []
for (const entry of CURATED) {
  const [pool, predicate] = entry.match
  const matched = pool.filter(predicate)
  const occurrences = matched.reduce((total, candidate) => total + (candidate.count || 1), 0)
  const sampleMap = new Map()
  for (const candidate of matched) {
    const samples = candidate.samples?.length
      ? candidate.samples
      : (candidate.pointers || []).length
        ? candidate.pointers.map(pointer => ({ file: candidate.file, line: candidate.line, pointer, evidence: candidate.evidence }))
        : [{ file: candidate.file, line: candidate.line, pointer: candidate.pointer || '', evidence: candidate.evidence }]
    for (const sample of samples) {
      const key = `${sample.file}:${sample.line}:${sample.pointer}`
      if (sampleMap.has(key) || sampleMap.size >= 10) continue
      const file = REL(sample.file || candidate.file)
      const rawEvidence = String(sample.evidence || candidate.evidence || '')
      // 检测器生成的合成证据（「HTML 内含 N 个 <p>」「“×12 」×11」）改成同一条目的正文片段，
      // 这样 samples 里的 evidence 可以在源码里复现，行号也能按证据重新定位。
      const synthetic = !rawEvidence || /^HTML 内含|×\d|\s×/.test(rawEvidence)
      const evidence = (synthetic ? String(candidate.text || candidate.evidence || '') : rawEvidence).slice(0, 160)
      const located = file && evidence.length >= 10 ? locateZhEvidence(file, evidence) : null
      sampleMap.set(key, {
        file, line: located ?? sample.line ?? candidate.line ?? null, pointer: sample.pointer,
        scenario: candidate.scenario, scenarioId: candidate.scenarioId,
        evidence,
      })
    }
  }
  if (!matched.length && !entry.metrics) console.warn(`WARN ${entry.id}: no scan candidates matched`)
  findings.push({
    id: entry.id, area: entry.area, category: entry.category, severity: entry.severity,
    title: entry.title,
    count: { occurrences, groups: matched.length },
    campaigns: [...new Set(matched.map(candidate => candidate.campaign).filter(Boolean))],
    scenarios: [...new Set(matched.map(candidate => candidate.scenario).filter(Boolean))],
    samples: [...sampleMap.values()],
    evidence: matched[0] ? String(matched[0].evidence || matched[0].text || '').slice(0, 180) : '',
    expected: entry.expected, suggestion: entry.suggestion,
    sourceKind: entry.sourceKind, ...(entry.rootCause ? { rootCause: entry.rootCause } : {}),
    ...(entry.metrics ? { metrics: entry.metrics } : {}),
  })
}

const byCategory = findings.reduce((accumulator, finding) => {
  accumulator[finding.category] = (accumulator[finding.category] || 0) + 1
  return accumulator
}, {})
const bySeverity = findings.reduce((accumulator, finding) => {
  accumulator[finding.severity] = (accumulator[finding.severity] || 0) + 1
  return accumulator
}, {})
const byArea = findings.reduce((accumulator, finding) => {
  accumulator[finding.area] = (accumulator[finding.area] || 0) + finding.count.occurrences
  return accumulator
}, {})

const document = {
  generatedAt: '2026-11-09',
  title: '全战役剧情 / 冒险指南 / 关卡设置文本中文审计',
  method: '静态提取 + 机械候选 + 人工复核；扫描器见 docs/translate/tools/scan-*.mjs，原始候选见 docs/translate/scan/*.json',
  scope: {
    campaigns: 8, scenarios: 62, storyUnits: story.summary.scope.units,
    guideFiles: guideCoverage.scope.guides, guideZhBlocks: guideCoverage.scope.zhBlocks,
    setupScenarios: setupCoverage.scope.scenarios,
    excluded: ['5,930 张卡面文本', '规则书文本', '交互按钮/技能检定提示', '记录标签 UI', '卡牌图内文字'],
  },
  summary: { findings: findings.length, byCategory, bySeverity, occurrencesByArea: byArea },
  findings,
}

if (process.argv.includes('--write')) {
  writeFileSync(OUT, `${JSON.stringify(document, null, 2)}\n`)
  console.log(`findings written: ${OUT.replaceAll('\\', '/')}`)
  console.log(`findings=${findings.length} severity=${JSON.stringify(bySeverity)}`)
  for (const finding of findings.filter(item => item.count.occurrences === 0 && !item.metrics)) console.warn(`EMPTY ${finding.id}`)
} else {
  console.log(JSON.stringify(document.summary, null, 2))
  for (const finding of findings) console.log(`- [${finding.severity}] ${finding.id} ${finding.title.slice(0, 80)} (${finding.count.occurrences})`)
}
