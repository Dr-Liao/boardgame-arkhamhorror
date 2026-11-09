#!/usr/bin/env node
// 全战役「冒险指南 / 关卡设置面板」中文审计扫描器（只读）。
//
// 对象：web/scenario-guides/<scenario>.json 的 locales.zh / locales.en
//   · 缺译（missing / 空正文 / 英文冒充中文）
//   · 图标/占位符格式（[token] 是否合法、zh/en token 数量是否一致、遭遇组图标句是否悬空）
//   · 分段（块内单换行、bullet 粘连、超长块）
//   · 分支指引悬空（跳至结局 N / 阅读引言 N / 前往设置 引用的目标不存在）
//   · zh/en 结构对照（块数、长度比、bullet 数）
//
// 用法（在 games/arkhamhorror 下运行）：
//   node docs/translate/tools/scan-guides.mjs           # 摘要
//   node docs/translate/tools/scan-guides.mjs --write   # 写 scan/guides-coverage.json + scan/guides-candidates.json
import { mkdirSync, writeFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import {
  MOD, CAMPAIGN_NAMES, KNOWN_TOKENS, TRADITIONAL_MAP, analyzeZhText, cjkCount, flattenGuideBlocks, guideTree, hasCJK,
  lineOfText, loadJson, segmentationCandidates, sha256, stripMarkup, tokenCandidates,
} from './_shared.mjs'

const OUT_DIR = join(MOD, 'docs/translate/scan')
const GUIDE_DIR = join(MOD, 'web/scenario-guides')
const SECTIONS = ['intro', 'setup', 'specialRules', 'story', 'resolutions']

const candidates = []
const stats = { guides: 0, totalBlocks: 0, zhBlocks: 0, enBlocks: 0, missingBlocks: 0, byCampaign: {}, errors: [], orthography: {} }

function orthographyStat(campaignId) {
  stats.orthography[campaignId] ??= { campaign: campaignId, name: CAMPAIGN_NAMES[campaignId] || campaignId, traditionalTotal: 0, zhu: 0, byChar: {} }
  return stats.orthography[campaignId]
}
const guideIds = readdirSync(GUIDE_DIR).filter(name => name.endsWith('.json')).map(name => name.slice(0, -5)).sort()

function campaignStats(campaignId) {
  stats.byCampaign[campaignId] ??= { campaign: campaignId, name: CAMPAIGN_NAMES[campaignId] || campaignId, guides: 0, guidesWithIssues: new Set(), zhBlocks: 0, missing: 0, candidates: 0 }
  return stats.byCampaign[campaignId]
}

function addCandidate(guide, candidate) {
  const line = candidate.evidence && String(candidate.evidence).length >= 12
    ? lineOfText(join(GUIDE_DIR, `${guide.id}.json`), candidate.evidence) : null
  candidates.push({
    layer: 'guides', campaign: guide.campaignId, campaignName: CAMPAIGN_NAMES[guide.campaignId] || guide.campaignId,
    scenario: guide.id, file: `web/scenario-guides/${guide.id}.json`, line, ...candidate,
  })
  const campaign = campaignStats(guide.campaignId)
  campaign.candidates++
  campaign.guidesWithIssues.add(guide.id)
}

function walkTrees(zhTree, enTree, path, visit) {
  const length = Math.max(zhTree.length, enTree.length)
  for (let index = 0; index < length; index++) {
    const zh = zhTree[index], en = enTree[index]
    const here = `${path}.${index}`
    if (!zh && en) { visit({ type: 'missing-block', path: here, en }); continue }
    if (zh && !en) { visit({ type: 'extra-zh-block', path: here, zh }); continue }
    visit({ type: 'pair', path: here, zh, en })
    if (zh.children?.length || en.children?.length) walkTrees(zh.children || [], en.children || [], `${here}.children`, visit)
  }
}

function guideLine(guide, fragment) {
  return lineOfText(join(GUIDE_DIR, `${guide.id}.json`), fragment)
}

const CONT = /(?:进入|前往|跳至|跳到|继续|开始|阅读|参见|转至|转到|推进|回到|proceed to|Proceed to|Skip to|skip to|Read |read )/
const BRANCH_REF = /(?:跳至|跳到|跳转至|前往|进入|阅读|继续(?:前往)?|前进至|转至|转到|推进至|推进到|参见)\s*(?:〈|《)?\s*(?:结局|引言|开场|序幕|梦境|幕间|尾声|设置|冒险设置|检查点|介绍|剧本)\s*([0-9]+|[IVX]+)?\s*(?:〉|》)?/g
const ANY_BRANCH_VERB = /(?:继续|前往|跳至|跳到|跳转至|进入|阅读|参见|回到|转至|转到|推进|设置|进行)/
const RESOLUTION_TITLE = /(?:结局|尾声|Resolution|Epilogue)\s*([0-9]+|[IVX]+)?/i
// 只把「遭遇组/遭遇牌 … 图标 …：」的清单引导句视为图标清单句；其余解释性文字（如
// 「这张卡具有以下图标：」「图标如下：（貌似没有）」）不是被生成器剥掉的清单，不报警。
const ICON_SENTENCE = /(?:这些|上述|以下)?遭遇(?:组|牌)[^。\n]{0,50}(?:图标|圖標)[^。\n]{0,20}[：:]|encounter (?:sets?|cards?)[^.\n]{0,80}icons?[^.\n]{0,30}:/i

for (const id of guideIds) {
  let guide
  try {
    guide = loadJson(join(GUIDE_DIR, `${id}.json`))
  } catch (error) {
    stats.errors.push({ id, error: String(error) })
    continue
  }
  stats.guides++
  const campaign = campaignStats(guide.campaignId)
  campaign.guides++
  const zh = guide.locales?.zh, en = guide.locales?.en
  if (!zh || !en) {
    addCandidate(guide, { kind: 'guide-missing-locale', severity: 'high', pointer: 'locales', evidence: `zh=${Boolean(zh)} en=${Boolean(en)}` })
    continue
  }
  // 已登记的缺译 backlog（EOTE 类 chineseGaps；当前应为 0）。
  const gaps = guide.chineseGaps || {}
  for (const key of Object.keys(gaps)) {
    if (gaps[key]) {
      stats.missingBlocks++
      campaign.missing++
      addCandidate(guide, { kind: 'declared-chinese-gap', severity: 'medium', pointer: `chineseGaps.${key}`, evidence: String(gaps[key]).slice(0, 80) })
    }
  }
  const guideZhLeaves = [], guideEnLeaves = []
  for (const section of SECTIONS) {
    const zhBlocks = flattenGuideBlocks(zh[section], `locales.zh.${section}`)
    const enBlocks = flattenGuideBlocks(en[section], `locales.en.${section}`)
    stats.totalBlocks += zhBlocks.length + enBlocks.length
    stats.zhBlocks += zhBlocks.length
    stats.enBlocks += enBlocks.length
    campaign.zhBlocks += zhBlocks.length
    for (const leaf of zhBlocks) { leaf.section = section; guideZhLeaves.push(leaf) }
    for (const leaf of enBlocks) { leaf.section = section; guideEnLeaves.push(leaf) }

    // 缺译标记 / 空块
    for (const leaf of zhBlocks) {
      if (leaf.kind === 'missing' || leaf.marker) {
        stats.missingBlocks++
        campaign.missing++
        addCandidate(guide, { kind: 'missing-text', severity: 'high', pointer: leaf.path, evidence: leaf.marker || 'missing' })
      }
      if (leaf.kind === 'text' && !leaf.text.trim()) {
        addCandidate(guide, { kind: 'empty-text', severity: 'medium', pointer: leaf.path, evidence: '' })
      }
    }

    // zh/en 结构对照（缺失块先收集；用整节字数比判断是「真缺」还是「中文把标题内联成正文了」）
    const structureEvents = []
    walkTrees(guideTree(zh[section]), guideTree(en[section]), `locales.zh.${section}`, event => structureEvents.push(event))
    const sectionZhLength = zhBlocks.reduce((total, leaf) => total + cjkCount(leaf.text), 0)
    const sectionEnLength = enBlocks.reduce((total, leaf) => total + stripMarkup(leaf.text).length, 0)
    // 中文长度约为英文的 0.3–0.5 属正常翻译压缩；低于 0.22 才视为「这一节确实少了一大块」。
    const contentCovered = sectionEnLength === 0 || sectionZhLength / sectionEnLength >= 0.22
    for (const event of structureEvents) {
      if (event.type === 'missing-block') {
        const enBlock = event.en || {}
        const hasText = Boolean((enBlock.text || '').trim())
        addCandidate(guide, {
          kind: hasText
            ? (contentCovered ? 'structure-diff-inline' : 'block-missing-in-zh')
            : 'title-missing-in-zh',
          severity: hasText ? (contentCovered ? 'low' : 'high') : 'medium',
          pointer: event.path,
          evidence: (enBlock.text || enBlock.title || '').slice(0, 100),
        })
      } else if (event.type === 'pair') {
        const { zh: zhBlock, en: enBlock } = event
        const zhText = zhBlock.text || '', enText = enBlock.text || ''
        const symbolTokens = text => [...String(text).matchAll(/\[([a-z][a-z0-9_]*)\]/gi)]
          .map(match => match[1].toLowerCase()).filter(name => KNOWN_TOKENS.has(name)).length
        const zhIconCount = symbolTokens(zhText)
        const enIconCount = symbolTokens(enText)
        if (enIconCount !== zhIconCount) {
          addCandidate(guide, { kind: 'icon-count-mismatch', severity: 'medium', pointer: `${event.path}.text`, evidence: `zh=${zhIconCount} en=${enIconCount}` })
        }
        const zhLen = cjkCount(zhText), enLen = stripMarkup(enText).length
        if (enLen > 140 && zhLen > 30 && zhLen / enLen < 0.16) {
          addCandidate(guide, { kind: 'zh-shorter-than-en', severity: 'low', pointer: `${event.path}.text`, evidence: `zh ${zhLen} 字 / en ${enLen} 字符` })
        }
        // 未替换的占位符（[shelterValue]/[count] 等不是可渲染图标，会原样显示）。
        for (const placeholder of (enText + '\n' + zhText).matchAll(/\[(?:shelterValue|count|value|name|key|pointsRemaining|setImgPath)\]/g)) {
          addCandidate(guide, { kind: 'unresolved-placeholder', severity: 'medium', pointer: `${event.path}.text`, evidence: placeholder[0] })
        }
        // 遭遇组图标句：正文说「如下图标所示」，但同一 setup 段没有任何 [token]（生成器把 <img> 段剥掉了）。
        if (ICON_SENTENCE.test(zhText) && !/\[[a-z][a-z0-9_]*\]/.test(zhText)) {
          addCandidate(guide, { kind: 'icon-sentence-dangling', severity: 'medium', pointer: `${event.path}.text`, evidence: zhText.slice(0, 120) })
        }
        const zhBullets = (zhText.match(/•/g) || []).length, enBullets = (enText.match(/•/g) || []).length
        if (enBullets >= 2 && zhBullets + 1 < enBullets) {
          addCandidate(guide, { kind: 'bullet-count-mismatch', severity: 'medium', pointer: `${event.path}.text`, evidence: `zh •=${zhBullets} en •=${enBullets}` })
        }
        // 中文块丢了分支指引：en 块有分支动作、zh 块一个分支动词都没有。
        if (enText && zhText && hasCJK(zhText) && /(?:Proceed to|Skip to|Read |Continue to|continue to|skip to|proceed to)/.test(enText)
          && !ANY_BRANCH_VERB.test(zhText) && enText.length > 40) {
          addCandidate(guide, { kind: 'branch-instruction-missing', severity: 'medium', pointer: `${event.path}.text`, evidence: enText.slice(0, 100) })
        }
      }
    }
  }

  // 收集本关可用的结局编号，用于校验分支引用（引言/梦境编号写在正文标签里，无法稳定建集合，不校验）。
  const allText = guideZhLeaves.map(leaf => leaf.text).join('\n')
  const resolutionNumbers = new Set()
  for (const match of allText.matchAll(/(?:^|\n)\s*(?:结局|尾声|Resolution|Epilogue)\s*([0-9]+)/g)) resolutionNumbers.add(match[1])
  for (const leaf of guideZhLeaves) {
    if (leaf.kind === 'title') {
      const match = RESOLUTION_TITLE.exec(leaf.text)
      if (match?.[1]) resolutionNumbers.add(match[1])
    }
  }
  for (const leaf of guideZhLeaves) {
    if (leaf.kind !== 'text') continue
    const text = stripMarkup(leaf.text)
    for (const match of text.matchAll(BRANCH_REF)) {
      const target = match[1]
      if (!target) continue
      const isResolution = /结局|尾声|Resolution|Epilogue/i.test(match[0])
      if (isResolution && resolveTarget(resolutionNumbers, target) === false) {
        addCandidate(guide, { kind: 'dangling-resolution-ref', severity: 'medium', pointer: leaf.path, evidence: match[0] })
      }
    }
    // 正文出现 @: 跨节引用/多段 HTML/花括号模板
    if (/@:|<\/?[a-z][^>]*>|\{[A-Za-z][A-Za-z0-9_]*\}/.test(leaf.text)) {
      addCandidate(guide, { kind: 'marker-leak', severity: 'high', pointer: leaf.path, evidence: leaf.text.slice(0, 120) })
    }
  }

  // 中文正文语言 / 图标 / 标点检测（zh 侧逐块）
  for (const leaf of guideZhLeaves) {
    if (leaf.kind !== 'text' || !leaf.text.trim()) continue
    // 分支/收束指引被截断：开场块停在一句「如果/检查剧本日志…」上，却没有「前往/跳至/进入…」的目标。
    // 只查 intro——setup 里的条件句通常是后续列表的引导语（后面紧跟 children），不能按单块判决。
    const plainLetter = stripMarkup(leaf.text).trim()
    if (leaf.section === 'intro' && !/[：:]\s*$/.test(plainLetter) && cjkCount(plainLetter) <= 80
      && /(?:如果|若|当|检查(?:剧本|战役)日志|调查员必须|你们必须)[^。！？；\n]{0,40}$/.test(plainLetter)
      && !/(?:前往|跳至|跳转至|跳到|进入|阅读|继续|参见|转至|转到|推进|设置|检查点|结局|引言|开幕|开场|梦境|幕间|尾声|开始|介绍)/.test(plainLetter)) {
      addCandidate(guide, { kind: 'branch-target-missing', severity: 'high', pointer: leaf.path, evidence: plainLetter.slice(-60) })
    }
    // 简繁用字统计（仅统计指南正文）
    const orthography = orthographyStat(guide.campaignId)
    for (const char of leaf.text) if (TRADITIONAL_MAP[char]) {
      orthography.traditionalTotal++
      orthography.byChar[char] = (orthography.byChar[char] || 0) + 1
    }
    for (const match of leaf.text.matchAll(/著/g)) {
      const before = leaf.text[match.index - 1] || '', after = leaf.text[match.index + 1] || ''
      if (/[名作称显土著]/.test(before) || /[名作称]/.test(after)) continue
      orthography.zhu++
    }
    for (const issue of analyzeZhText(leaf.text, { path: leaf.path, kind: 'block' })) {
      if (['long-block', 'label-chinese-label'].includes(issue.kind)) continue
      addCandidate(guide, { kind: issue.kind, severity: issue.severity || 'low', pointer: leaf.path, evidence: issue.evidence || '' })
    }
    for (const issue of segmentationCandidates(leaf.text, { kind: 'block' })) {
      if (issue.kind === 'long-block') continue
      addCandidate(guide, { kind: issue.kind, severity: issue.severity || 'low', pointer: leaf.path, evidence: issue.evidence || '' })
    }
  }
  // 开场收束：en 开场有明确的 Setup/下一段指引，而 zh 开场整段没有「设置 / 继续 / 前往」之类的出口。
  const zhIntro = guideZhLeaves.filter(leaf => leaf.section === 'intro').map(leaf => leaf.text).join('\n')
  const enIntro = guideEnLeaves.filter(leaf => leaf.section === 'intro').map(leaf => leaf.text).join('\n')
  if (/Proceed to Setup|Skip to Setup|to Setup/i.test(enIntro) && !/(?:设置|继续|前往|进入|跳至)/.test(zhIntro)) {
    addCandidate(guide, { kind: 'intro-lacks-setup-transition', severity: 'medium', pointer: 'locales.zh.intro', evidence: enIntro.slice(0, 100) })
  }
  // 分支指引总量对照：en 的 Proceed/Skip/Read 与中文「前往/跳至/进入/阅读」词频差距过大，
  // 通常意味着上游中文 locale 成段丢了分支收尾（TDE《编织宇宙》《神居之所》等）。
  const enAllText = guideEnLeaves.map(leaf => leaf.text).join('\n')
  const enBranchCount = (enAllText.match(/\b(?:Proceed to|Skip to|Read |Continue to|Go to)\b/gi) || []).length
  const zhBranchCount = (allText.match(/(?:前往|跳至|跳到|跳转至|进入|阅读|继续(?:前往)?|参见|转至|转到|推进|设置)/g) || []).length
  if (enBranchCount >= 2 && zhBranchCount <= enBranchCount - 2) {
    addCandidate(guide, {
      kind: 'branch-count-deficit', severity: enBranchCount - zhBranchCount >= 3 ? 'high' : 'medium',
      pointer: 'locales.zh', evidence: `en 分支指引 ${enBranchCount} 处 / zh ${zhBranchCount} 处`,
    })
  }
  // 中文指南必须至少有一处「进入冒险设置 / 前往设置」收束（开场或结局），否则玩家读完不知道怎么继续。
  const hasSetupTransition = /(?:进入|前往|开始)\s*(?:〈|》|《)?\s*冒险设置|进入设置|前往设置|进入〈设置〉|Proceed to Setup/i.test(allText)
  if (!hasSetupTransition) addCandidate(guide, { kind: 'missing-setup-transition', severity: 'low', pointer: 'locales.zh', evidence: '' })
}

function resolveTarget(set, target) {
  if (!target) return null
  if (set.has(target)) return true
  // 罗马数字/阿拉伯数字混用：按数值再比一次。
  const roman = { I: 1, II: 2, III: 3, IV: 4, V: 5, VI: 6, VII: 7, VIII: 8, IX: 9, X: 10 }
  const value = roman[target] ?? Number(target)
  return [...set].some(item => (roman[item] ?? Number(item)) === value)
}

// 汇总
const byKind = candidates.reduce((accumulator, candidate) => {
  accumulator[candidate.kind] = (accumulator[candidate.kind] || 0) + 1
  return accumulator
}, {})
const bySeverity = candidates.reduce((accumulator, candidate) => {
  accumulator[candidate.severity] = (accumulator[candidate.severity] || 0) + 1
  return accumulator
}, {})
// 逐组聚合（同关同 kind 同证据指纹）
const groups = new Map()
for (const candidate of candidates) {
  const key = `${candidate.scenario}\u0000${candidate.kind}\u0000${sha256(candidate.evidence || candidate.pointer)}`
  if (!groups.has(key)) groups.set(key, { ...candidate, count: 0, pointers: [] })
  const group = groups.get(key)
  group.count++
  if (group.pointers.length < 6) group.pointers.push(candidate.pointer)
}
const grouped = [...groups.values()]

const summary = {
  generatedAt: '2026-11-09',
  scope: { guides: stats.guides, zhBlocks: stats.zhBlocks, enBlocks: stats.enBlocks, missingBlocks: stats.missingBlocks },
  byKind,
  bySeverity,
  candidateCount: candidates.length,
  groupedCount: grouped.length,
  campaigns: Object.fromEntries(Object.entries(stats.byCampaign).map(([id, value]) => [id, {
    campaign: id, name: value.name, guides: value.guides, guidesWithIssues: [...value.guidesWithIssues].length,
    zhBlocks: value.zhBlocks, missing: value.missing, candidates: value.candidates,
  }])),
  orthography: stats.orthography,
  sourceErrors: stats.errors,
}

if (process.argv.includes('--write')) {
  mkdirSync(OUT_DIR, { recursive: true })
  writeFileSync(join(OUT_DIR, 'guides-coverage.json'), `${JSON.stringify(summary, null, 2)}\n`)
  writeFileSync(join(OUT_DIR, 'guides-candidates.json'), `${JSON.stringify({ summary, candidates: grouped }, null, 2)}\n`)
  console.log(`guide scan written: ${grouped.length} groups / ${candidates.length} occurrences`)
} else if (process.argv.includes('--json')) {
  console.log(JSON.stringify({ summary, candidates: grouped }, null, 2))
} else {
  console.log(JSON.stringify({ ...summary, top: grouped.slice(0, 40) }, null, 2))
}
