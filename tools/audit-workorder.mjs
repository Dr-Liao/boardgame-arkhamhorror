// 引擎卡号债务工作单（重构路线 §10 第 1 项）。
//
// 背景：指标「engine.js 里的 5 位码」= 180，但 180 里混着三种完全不同的东西：
//   · 标识/文案引用（choice 的 source 标签、cardName('…')）——不是规则债务；
//   · 静态数据表（'01101': { hunter: true, … }）——搬家即可，不是逻辑；
//   · 真正的行为分支（if (def.code === '…')、case '…'）——这才是要迁的部分。
// 把三者混在一个数字里，会让"接卡越来越慢"的真实原因被噪声盖住。
//
// 用法：
//   node tools/audit-workorder.mjs            # 打印分布
//   node tools/audit-workorder.mjs --write    # 写 audit/ability-workorder.json
//   node tools/audit-workorder.mjs --check    # 校验产物与源码一致
//
// 分类口径（可在产物里逐条核对证据）：
//   shape  reference | table | block | condition
//   class  A（现有描述子可表达）| B（需要 Phase 1 的状态模型）| C（需要 Phase 2 的语义原语）
//          —— 判定只依赖关键字，属于"候选"，逐条迁移前仍需人工确认。

import { readFileSync, writeFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'
import { EFFECTS } from '../src/cards/card-effects.js'
import { EFFECT_PRIMITIVES } from '../src/engine/effects.js'

const ENGINE_URL = new URL('../src/engine/engine.js', import.meta.url)
const COVERAGE_URL = new URL('../audit/ability-coverage.json', import.meta.url)
const TARGET_URL = new URL('../audit/ability-workorder.json', import.meta.url)
const CODE_LITERAL = /'(0\d{4}[a-z]?)'/g
const ESCAPE_PRIMITIVE = /^(tfa|carcosa|dunwich|notz|circle|innsmouth|edge|scarlet)[A-Z]/

// 需要 Phase 1 状态模型（effect 记录 / history / 目标枚举 / 非玩家卡通道）的能力。
const PHASE1 = [
  ['A1 效果时长', /phaseStatBonus|statBonus|untilEnd|until \w+|expires|duration/i],
  ['B1 目标枚举', /requestChoice|chooseEnemy|chooseTarget|chooseLocation|targetModes/i],
  ['C6 历史记录', /thisTurn|thisRound|lastAction|wasPlayed|hasDrawn/i],
  // 敌人/地点/幕/议程/弱点等非玩家实体的专属机制：要先有 D1 能力通道才能搬。
  ['D1 非玩家通道', /scenarioRuntime|scenarioBehavior|agenda|actCode|actIndex|\.threat\b|enemy\.|encounter|weakness|loc\./i],
]
// 需要 Phase 2 语义原语（布尔修正 / 费用表达式 / 区域附属 / as-if）的能力。
const PHASE2 = [
  ['C1 布尔修正', /cannot|canNot|ignore[A-Z]|blocked|prevent|immune/i],
  ['C3 费用表达式', /discount|additionalCost|costOverride|payExtra/i],
  ['B6 区域附属', /attach|beneath|removedFromGame|setAside/i],
  ['A3 as-if', /asIf|treatAs|countsAs/i],
]
// 只读引擎既有 helper 的实现块：加一层 ctx.api 薄包装即可迁走。
const API_WRAPPER = /reviewable|state\.[a-zA-Z]+\s*[-+*/]?=|\.push\(|\.splice\(|\.find\(/

function lines(url) {
  return readFileSync(url, 'utf8').split('\n')
}

function eachOccurrence(sourceLines, code) {
  const needle = `'${code}'`
  const hits = []
  sourceLines.forEach((line, index) => {
    if (!line.includes(needle)) return
    hits.push({ line: index + 1, text: line.trim() })
  })
  return hits
}

function blockOf(sourceLines, hit) {
  // 取发生点附近的实现体：case/if 之后到下一个同级花括号为止的粗粒度窗口。
  const start = hit.line - 1
  const window = sourceLines.slice(start, Math.min(start + 14, sourceLines.length))
  return window.join('\n')
}

function classify(occurrences, sourceLines) {
  const texts = occurrences.map(hit => hit.text).join('\n')
  const isReference = occurrences.every(hit => /source:\s*'|cardName\(|label:|prompt:/i.test(hit.text))
    && !/===\s*'/.test(texts)
  const isTable = occurrences.some(hit => /^\s*'0\d{4}[a-z]?'\s*:\s*\{/.test(hit.text))
  const isBlock = occurrences.some(hit => /case\s+'0\d{4}|\.code\s*===\s*'0\d{4}/.test(hit.text))
  const shape = isReference ? 'reference' : isTable ? 'table' : isBlock ? 'block' : 'condition'

  const body = occurrences.map(hit => blockOf(sourceLines, hit)).join('\n')
  const needs = []
  for (const [label, pattern] of [...PHASE1, ...PHASE2]) if (pattern.test(body)) needs.push(label)
  if (API_WRAPPER.test(body) && shape === 'block') needs.push('ctx.api 薄包装')
  const phase1 = needs.some(need => need.startsWith('A1') || need.startsWith('B1')
    || need.startsWith('C6') || need.startsWith('D1'))
  const phase2 = needs.some(need => ['C1', 'C3', 'B6', 'A3'].some(prefix => need.startsWith(prefix)))
  const klass = shape === 'reference' || shape === 'table' ? 'A'
    : phase2 ? 'C'
      : phase1 ? 'B' : 'A'
  return { shape, class: klass, needs }
}

export function collect() {
  const sourceLines = lines(ENGINE_URL)
  const source = sourceLines.join('\n')
  const codes = [...new Set([...source.matchAll(CODE_LITERAL)].map(match => match[1]))].sort()
  const effectsCodes = Object.keys(EFFECTS)
  const escapePrimitives = EFFECT_PRIMITIVES.filter(name => ESCAPE_PRIMITIVE.test(name))

  const entries = codes.map(code => {
    const occurrences = eachOccurrence(sourceLines, code)
    const { shape, class: klass, needs } = classify(occurrences, sourceLines)
    const effect = EFFECTS[code]
    const escape = effect ? JSON.stringify(effect).match(/"((?:tfa|carcosa|dunwich)[A-Z]\w*)"/g) : null
    return {
      code,
      shape,
      class: klass,
      needs,
      occurrences: occurrences.length,
      lines: occurrences.map(hit => hit.line),
      inEffects: Boolean(effect),
      ...(escape ? { escapePrimitives: [...new Set(escape.map(token => token.replace(/"/g, '')))] } : {}),
      evidence: occurrences.slice(0, 2).map(hit => hit.text.slice(0, 120)),
    }
  })

  const summary = {
    total: entries.length,
    byShape: countBy(entries, entry => entry.shape),
    byClass: countBy(entries, entry => entry.class),
    nonBehaviorDebt: entries.filter(entry => entry.shape === 'reference' || entry.shape === 'table').length,
  }
  return { codes, entries, summary, effectsCodes, escapePrimitives }
}

function countBy(entries, pick) {
  return entries.reduce((acc, entry) => {
    const key = pick(entry)
    acc[key] = (acc[key] || 0) + 1
    return acc
  }, {})
}

export function buildReport(data) {
  return {
    schemaVersion: 1,
    note: '由 tools/audit-workorder.mjs --write 生成，勿手改。'
      + 'shape=reference/table 不是规则债务（标识与数据表）；block/condition 才是要迁的行为分支。'
      + 'class 只按关键字判定的候选分类，逐条迁移前需人工确认。',
    summary: data.summary,
    batches: {
      A: data.entries.filter(entry => entry.class === 'A').map(entry => entry.code),
      B: data.entries.filter(entry => entry.class === 'B').map(entry => entry.code),
      C: data.entries.filter(entry => entry.class === 'C').map(entry => entry.code),
    },
    entries: data.entries,
  }
}

const serialize = value => `${JSON.stringify(value, null, 2)}\n`

async function main() {
  const mode = process.argv[2]
  if (mode && !['--write', '--check'].includes(mode)) throw new Error('使用 --write 或 --check')
  const data = collect()
  const report = buildReport(data)
  if (mode === '--write') {
    writeFileSync(TARGET_URL, serialize(report))
  } else if (mode === '--check') {
    let actual
    try {
      actual = readFileSync(TARGET_URL, 'utf8')
    } catch {
      throw new Error('缺少 audit/ability-workorder.json，先运行 node tools/audit-workorder.mjs --write')
    }
    if (actual !== serialize(report)) throw new Error('工作单与源码不一致，请重跑 --write 并审阅 diff')
  }
  const { summary } = data
  console.log(`引擎码 ${summary.total} 个：` + Object.entries(summary.byShape).map(([shape, count]) => `${shape}=${count}`).join(' '))
  console.log(`分类：` + Object.entries(summary.byClass).map(([klass, count]) => `${klass}=${count}`).join(' ') + `（非行为债务 ${summary.nonBehaviorDebt}）`)
  const coverage = JSON.parse(readFileSync(COVERAGE_URL, 'utf8'))
  console.log(`参考：EFFECTS ${coverage.metrics.effectsEntries} 条、逃生卡 ${coverage.metrics.escapeCards} 张、窗口 ${coverage.metrics.windows} 个`)
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) await main()
