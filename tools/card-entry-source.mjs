// 卡牌行为文件（src/cards/entries/<code>.js）的源码工具。
//
// 这里只做「源码切片 / 合并 / 渲染」，不 import 引擎，也不读运行时状态，
// 因此既能被一次性的旧文件拆分工具使用，也能被索引生成器与新卡脚手架复用。
//
// 设计约束：
//   · 不引入 AST 依赖（项目零构建、零额外依赖）；用括号/字符串/注释感知的扫描器。
//   · 条目里的函数、matcher 调用、模板字符串原样保留，不做求值或重写。
//   · 合并规则与 card-abilities.js 旧 byCode 完全一致：
//       { ...existing, ...entry, abilities: [...], modifiers: [...] }
//     同名字段后者覆盖，abilities/modifiers 顺序拼接。

export const MATCHER_SYMBOLS = Object.freeze([
  'atTrait', 'clueAtLocation', 'investigatorClues', 'noEnemiesHere', 'ownFirstAction', 'ownSeat', 'ownTurn',
  'remainingSanityAtLeast', 'resignAvailable',
])

export const SHARED_SYMBOLS = Object.freeze([
  'investigatorSign', 'skillModifier', 'allSkillModifiers', 'searchInvestigatorDeck',
  'attachToChosenLocation', 'healWithTrauma', 'SKILL_NAMES_ZH', 'CHAOS_SYMBOLS',
])

export const CARD_EFFECT_SYMBOLS = Object.freeze(['INVESTIGATOR_ABILITIES'])

// ---------------------------------------------------------------------------
// 词法扫描：所有函数都假设输入是可信源码，只负责找到「结构边界」。
// ---------------------------------------------------------------------------

function skipLineComment(text, index) {
  while (index < text.length && text[index] !== '\n') index++
  return index
}

function skipBlockComment(text, index) {
  index += 2
  while (index < text.length && !(text[index] === '*' && text[index + 1] === '/')) index++
  return Math.min(text.length, index + 2)
}

export function skipString(text, index) {
  const quote = text[index]
  index++
  while (index < text.length) {
    if (text[index] === '\\') { index += 2; continue }
    if (text[index] === quote) return index + 1
    index++
  }
  return index
}

// 跳过空白、注释；返回第一个有效字符的下标。
export function skipTrivia(text, index, end = text.length) {
  while (index < end) {
    const char = text[index]
    if (char === ' ' || char === '\t' || char === '\r' || char === '\n') { index++; continue }
    if (char === '/' && text[index + 1] === '/') { index = skipLineComment(text, index); continue }
    if (char === '/' && text[index + 1] === '*') { index = skipBlockComment(text, index); continue }
    break
  }
  return index
}

// 从 open（必须是 [、{、(）开始，返回配对的闭括号下标。
export function matchBracket(text, open) {
  const pairs = { '[': ']', '{': '}', '(': ')' }
  const stack = [text[open]]
  if (!stack[0]) throw new Error(`matchBracket: ${open} 不是括号`)
  for (let index = open + 1; index < text.length; index++) {
    const char = text[index]
    if (char === '"' || char === "'" || char === '`') { index = skipString(text, index) - 1; continue }
    if (char === '/' && text[index + 1] === '/') { index = skipLineComment(text, index) - 1; continue }
    if (char === '/' && text[index + 1] === '*') { index = skipBlockComment(text, index) - 1; continue }
    if (pairs[char]) { stack.push(char); continue }
    if (char === ']' || char === '}' || char === ')') {
      const want = Object.entries(pairs).find(([, close]) => close === char)?.[0]
      const got = stack.pop()
      if (got !== want) throw new Error(`括号不匹配：位置 ${index} 期望 ${pairs[got]}，实际 ${char}`)
      if (!stack.length) return index
    }
  }
  throw new Error(`括号未闭合：从 ${open} 开始`)
}

// 把 start..end 按顶层逗号切开。切片保留注释与空白，方便渲染时保留说明。
export function splitTopLevel(text, start, end) {
  const parts = []
  let depth = 0
  let last = start
  for (let index = start; index < end; index++) {
    const char = text[index]
    if (char === '"' || char === "'" || char === '`') { index = skipString(text, index) - 1; continue }
    if (char === '/' && text[index + 1] === '/') { index = skipLineComment(text, index) - 1; continue }
    if (char === '/' && text[index + 1] === '*') { index = skipBlockComment(text, index) - 1; continue }
    if (char === '[' || char === '{' || char === '(') depth++
    else if (char === ']' || char === '}' || char === ')') depth--
    else if (char === ',' && depth === 0) { parts.push(text.slice(last, index)); last = index + 1 }
  }
  parts.push(text.slice(last, end))
  return parts
}

export function findTopLevel(text, start, end, wanted) {
  let depth = 0
  for (let index = start; index < end; index++) {
    const char = text[index]
    if (char === '"' || char === "'" || char === '`') { index = skipString(text, index) - 1; continue }
    if (char === '/' && text[index + 1] === '/') { index = skipLineComment(text, index) - 1; continue }
    if (char === '/' && text[index + 1] === '*') { index = skipBlockComment(text, index) - 1; continue }
    if (char === '[' || char === '{' || char === '(') depth++
    else if (char === ']' || char === '}' || char === ')') depth--
    else if (depth === 0 && char === wanted) return index
  }
  return -1
}

// 在顶层 const 声明里找赋值号右侧的 [...] 或 {...}。
export function scanTopLevelDeclarations(text) {
  const found = []
  let depth = 0
  for (let index = 0; index < text.length; index++) {
    const char = text[index]
    if (char === '"' || char === "'" || char === '`') { index = skipString(text, index) - 1; continue }
    if (char === '/' && text[index + 1] === '/') { index = skipLineComment(text, index) - 1; continue }
    if (char === '/' && text[index + 1] === '*') { index = skipBlockComment(text, index) - 1; continue }
    if (char === '[' || char === '{' || char === '(') { depth++; continue }
    if (char === ']' || char === '}' || char === ')') { depth--; continue }
    if (char !== '=' || depth !== 0) continue
    const before = text.slice(Math.max(0, index - 120), index)
    const match = before.match(/(?:export\s+)?const\s+([A-Za-z_$][\w$]*)\s*$/)
    if (!match) continue
    const valueStart = skipTrivia(text, index + 1)
    if (text[valueStart] === '[' || text[valueStart] === '{') {
      found.push({ name: match[1], kind: text[valueStart], start: valueStart })
    }
  }
  return found
}

// 从任意切片里取出第一个顶层对象字面量（跳过前导注释/空白）。
export function objectSpan(slice) {
  const start = skipTrivia(slice, 0)
  if (slice[start] !== '{') return null
  const end = matchBracket(slice, start)
  return { start, end, source: slice.slice(start, end + 1) }
}

export function arraySpan(slice) {
  const start = skipTrivia(slice, 0)
  if (slice[start] !== '[') return null
  const end = matchBracket(slice, start)
  return { start, end, source: slice.slice(start, end + 1) }
}

// 取切片前面的注释行（给文件头用）。
export function leadingComment(slice) {
  const object = objectSpan(slice)
  const end = object ? object.start : slice.length
  const lines = []
  for (const line of slice.slice(0, end).split('\n')) {
    const trimmed = line.trim()
    if (!trimmed) continue
    if (trimmed.startsWith('//')) lines.push(trimmed.replace(/^\/\/\s?/, ''))
    else if (trimmed.startsWith('/*')) lines.push(trimmed.replace(/^\/\*\s?/, '').replace(/\*\/$/, ''))
  }
  return lines
}

// ---------------------------------------------------------------------------
// 对象字面量：拆成有序属性。只支持条目会用到的形态（普通键、引号键、简写）。
// ---------------------------------------------------------------------------

function stripLeadingTrivia(slice) {
  const index = skipTrivia(slice, 0)
  return slice.slice(index)
}

function parseKey(trimmed) {
  const colon = findTopLevel(trimmed, 0, trimmed.length, ':')
  if (colon < 0) {
    const shorthand = /^([A-Za-z_$][\w$]*)$/.exec(trimmed)
    return shorthand ? { key: shorthand[1], value: shorthand[1], shorthand: true } : null
  }
  const head = trimmed.slice(0, colon).trim()
  const quoted = /^(?:"([^"]+)"|'([^']+)'|([A-Za-z_$][\w$]*))$/.exec(head)
  if (!quoted) return null
  const key = quoted[1] || quoted[2] || quoted[3]
  const value = trimmed.slice(colon + 1).trim()
  return { key, value, shorthand: false }
}

export function objectProperties(objectSource) {
  const start = skipTrivia(objectSource, 0)
  if (objectSource[start] !== '{') throw new Error('objectProperties: 不是对象字面量')
  const end = matchBracket(objectSource, start)
  const parts = splitTopLevel(objectSource, start + 1, end)
  const properties = []
  let trailingComment = ''
  for (const part of parts) {
    const raw = part.trim()
    if (!raw) continue
    const body = stripLeadingTrivia(part).trim().replace(/,$/, '').trim()
    if (!body) continue
    // 纯注释尾巴（对象最后一个逗号之后）。
    if (body.startsWith('//') || body.startsWith('/*')) {
      trailingComment = body
      continue
    }
    const parsed = parseKey(body)
    if (!parsed) {
      trailingComment = body
      continue
    }
    properties.push({ ...parsed, comment: leadingComment(part) })
  }
  return { properties, trailingComment }
}

export function arrayElements(arraySource) {
  const span = arraySpan(arraySource)
  if (!span) return null
  // 只认「整个值就是数组字面量」；`['a'].map(...)` 是表达式，不能按元素拆。
  if (skipTrivia(arraySource, span.end + 1) !== arraySource.length) return null
  return splitTopLevel(span.source, 1, span.source.length - 1)
    .map(part => part.trim())
    .filter(Boolean)
}

// ---------------------------------------------------------------------------
// 合并与渲染
// ---------------------------------------------------------------------------

function dedent(value) {
  const lines = value.split('\n')
  const indents = lines.slice(1)
    .filter(line => line.trim())
    .map(line => line.match(/^ */)[0].length)
  const common = indents.length ? Math.min(...indents) : 0
  if (!common) return value
  return [lines[0], ...lines.slice(1).map(line => line.slice(common))].join('\n')
}

function indentLines(value, spaces) {
  const prefix = ' '.repeat(spaces)
  return value.split('\n').map((line, index) => (index === 0 ? line : prefix + line)).join('\n')
}

function renderArray(elements, indent) {
  const inner = elements
    .map(element => {
      const body = indentLines(dedent(element.trim()), indent + 2)
      return `${' '.repeat(indent + 2)}${body},`
    })
    .join('\n')
  return `[\n${inner}\n${' '.repeat(indent)}]`
}

function renderProperties(properties) {
  const lines = ['{']
  for (const property of properties) {
    const key = /^[A-Za-z_$][\w$]*$/.test(property.key) ? property.key : JSON.stringify(property.key)
    if (property.elements) {
      lines.push(`  ${key}: ${renderArray(property.elements, 2)},`)
    } else {
      lines.push(`  ${key}: ${indentLines(dedent(property.value.trim()), 2)},`)
    }
  }
  lines.push('}')
  return lines.join('\n')
}

// 与旧 byCode 的合并语义一致；返回可直接写进 export default 的对象源码。
export function mergeEntrySources(baseSource, patchSources = []) {
  const base = objectProperties(baseSource)
  const map = new Map()
  const order = []
  for (const property of base.properties) {
    if (!map.has(property.key)) order.push(property.key)
    map.set(property.key, { ...property })
  }
  for (const patchSource of patchSources) {
    const patch = objectProperties(patchSource)
    for (const property of patch.properties) {
      if (property.key === 'code') continue
      const existing = map.get(property.key)
      if (property.key === 'abilities' || property.key === 'modifiers') {
        const elements = arrayElements(property.value)
        // 补丁是表达式（例如 04005 的 `[...].map(...)`）：只有基条目的数组为空时才能安全替换。
        if (!elements) {
          if (existing && (existing.elements?.length || arrayElements(existing.value)?.length)) {
            throw new Error(`${property.key} 的补丁不是数组字面量，且基条目已有元素；需要人工合并`)
          }
          if (!existing) {
            if (!order.includes(property.key)) order.push(property.key)
            map.set(property.key, { key: property.key, value: property.value, elements: null })
          } else {
            existing.value = property.value
            existing.elements = null
          }
          continue
        }
        if (!existing) {
          if (!order.includes(property.key)) order.push(property.key)
          map.set(property.key, { key: property.key, value: property.value, elements: [...elements] })
        } else {
          existing.elements = [...(existing.elements || arrayElements(existing.value) || []), ...elements]
        }
        continue
      }
      if (!existing) {
        if (!order.includes(property.key)) order.push(property.key)
        map.set(property.key, { ...property })
      } else {
        existing.value = property.value
        existing.elements = null
      }
    }
  }
  // 旧 byCode 对每个条目都生成 abilities/modifiers（没有就是空数组）。
  for (const key of ['abilities', 'modifiers']) {
    if (!map.has(key)) {
      order.push(key)
      map.set(key, { key, value: '[]', elements: [] })
    } else if (!map.get(key).elements) {
      const elements = arrayElements(map.get(key).value)
      if (elements) map.get(key).elements = elements
    }
  }
  const properties = order.map(key => map.get(key))
  return renderProperties(properties)
}

// 取条目的卡号；兼容 `code: '01001'` 与 `"code": "01001"`。
export function codeOf(slice) {
  const match = /(?:^|[\s,{])["']?code["']?\s*:\s*['"]([^'"]+)['"]/.exec(slice)
  return match?.[1] || null
}

// ---------------------------------------------------------------------------
// 模块渲染
// ---------------------------------------------------------------------------

export function collectSymbols(source) {
  const has = name => new RegExp(`\\b${name}\\b`).test(source)
  const matcher = MATCHER_SYMBOLS.filter(has)
  const shared = SHARED_SYMBOLS.filter(has)
  const cardEffects = CARD_EFFECT_SYMBOLS.filter(has)
  return { matcher, shared, cardEffects, usesEs: has('es') }
}

function commentLines(lines, prefix = '// ') {
  return lines.map(line => `${prefix}${line}`.trimEnd())
}

export function renderEntryModule({
  code, name, text, source, comment = [], preamble = '', symbols = collectSymbols(source),
}) {
  const lines = []
  lines.push(`// ${code} ${name || ''}`.trimEnd())
  if (text) {
    for (const line of String(text).split('\n')) lines.push(`// 卡面：${line}`.trimEnd())
  }
  lines.push('//')
  lines.push('// 一张卡一个文件：这张卡的行为只在这里维护。')
  lines.push('// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。')
  if (comment.length) {
    lines.push('//')
    lines.push(...commentLines(comment))
  }
  lines.push('')
  if (symbols.matcher.length) {
    lines.push(`import { ${symbols.matcher.join(', ')} } from '../../engine/matcher.js'`)
  }
  if (symbols.shared.length) {
    lines.push(`import { ${symbols.shared.join(', ')} } from './_shared.js'`)
  }
  if (symbols.cardEffects.length) {
    lines.push(`import { ${symbols.cardEffects.join(', ')} } from '../card-effects.js'`)
  }
  if (symbols.usesEs) {
    if (!symbols.cardEffects.includes('INVESTIGATOR_ABILITIES')) {
      lines.push("import { INVESTIGATOR_ABILITIES } from '../card-effects.js'")
    }
    lines.push(`const es = INVESTIGATOR_ABILITIES['${code}']?.elderSign || {}`)
  }
  if (symbols.matcher.length || symbols.shared.length || symbols.cardEffects.length || symbols.usesEs) lines.push('')
  if (preamble) {
    lines.push(preamble.trimEnd())
    lines.push('')
  }
  lines.push(`export default ${source.trim()}`)
  lines.push('')
  return lines.join('\n')
}

export function renderIndexModule(entries) {
  const lines = [
    '// 由 tools/build-card-index.mjs 生成，不要手改。',
    '// 顺序 = 旧 card-abilities.js 的合并顺序（首次出现），用于保持注册/枚举顺序不变。',
    '',
  ]
  for (const entry of entries) lines.push(`import e${entry.code} from './${entry.code}.js'`)
  lines.push('', 'export const CARD_ENTRY_LIST = [')
  for (const entry of entries) lines.push(`  e${entry.code},`)
  lines.push(']', '')
  lines.push('export const CARD_ENTRY_BY_CODE = new Map(CARD_ENTRY_LIST.map(entry => [entry.code, entry]))')
  lines.push('')
  return lines.join('\n')
}

export function renderSharedModule() {
  return `// 卡牌行为文件共用的窄工具（只放跨卡复用的原语，不放某张卡的规则）。
//
// 这里的内容原来在 card-abilities.js 顶部；拆分后由各 entries/<code>.js 按需 import。

import { INVESTIGATOR_ABILITIES } from '../card-effects.js'

export const investigatorSign = code => INVESTIGATOR_ABILITIES[code]?.elderSign || {}

export const skillModifier = (skill, amount, condition) =>
  ({ target: \`skill:\${skill}\`, amount, ...(condition ? { condition } : {}) })

export const allSkillModifiers = (amount, condition) =>
  ['willpower', 'intellect', 'combat', 'agility'].map(skill => skillModifier(skill, amount, condition))

export const SKILL_NAMES_ZH = Object.freeze({
  willpower: '意志', intellect: '智识', combat: '战斗', agility: '敏捷',
})

export const CHAOS_SYMBOLS = ['skull', 'cultist', 'tablet', 'elderthing', 'autofail']

// 03026 / 03307 共用：选择同地点一名调查员并搜索其牌库（amount 为 'all' 时搜索整个牌库）。
// 询问与检索的 source 保持旧原语的 'noStoneUnturned'，日志与存档字段因此不变。
export function searchInvestigatorDeck(inv, api, amount, state = null) {
  const targets = api.investigatorsAt(inv.location)
  if (!targets.length) return
  const targetSeat = targets.length === 1 ? targets[0].seat
    : Number(api.choice({ kind: 'investigator', source: 'noStoneUnturned', seat: inv.seat,
      prompt: '选择要搜索牌库的调查员。',
      options: targets.map(other => ({ id: String(other.seat), label: other.name })) }))
  api.searchTop(targetSeat, {
    amount: amount === 'all' ? (state?.investigators?.[targetSeat]?.deck?.length ?? 0) : amount,
    source: 'noStoneUnturned',
  })
}

// 03038 / 03148 / 03199 / 03232 共用的「选择附属地点」：候选集合与旧实现一致
// （藏身地点可以是任一已揭示地点，其余只能附属到所在地点），询问文案逐字保留。
export function attachToChosenLocation(state, inv, api, { code, source, revealedOnly = false }) {
  const locations = revealedOnly
    ? state.locations.filter(location => location.revealed)
    : state.locations.filter(location => location.id === inv.location)
  if (!locations.length) return null
  const locationId = locations.length === 1 ? locations[0].id
    : api.choice({ kind: 'location', source, seat: inv.seat, prompt: '选择附加地点。',
      options: locations.map(location => ({ id: location.id, label: api.locationName(location.id) })) })
  return api.attachToLocation(locationId, { code, ownerSeat: inv.seat })
}

// 04274 的「创伤 2 点以上治疗 2 点」：战役创伤在 state.campaign.trauma 上。
export function healWithTrauma(state, inv, api, kind) {
  const traumaKey = kind === 'damage' ? 'physical' : 'mental'
  const targets = api.investigatorsAt(inv.location)
  if (!targets.length) return
  const chosen = targets.length === 1 ? String(targets[0].seat)
    : api.choice({ kind: 'target', source: '04274', seat: inv.seat, prompt: '选择要治疗的调查员。',
      options: targets.map(owner => ({ id: String(owner.seat), label: owner.name })) })
  const target = state.investigators[Number(chosen)] || inv
  const trauma = state.campaign?.trauma?.[target.seat]?.[traumaKey] || 0
  const amount = trauma >= 2 ? 2 : 1
  if (kind === 'damage') api.healDamage(target.seat, amount)
  else api.healHorror(target.seat, amount)
  api.info(\`\${target.name} 治疗 \${amount} 点\${kind === 'damage' ? '伤害' : '恐惧'}。\`)
}
`
}
