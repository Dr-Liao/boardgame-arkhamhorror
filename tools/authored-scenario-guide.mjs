const sections = ['intro', 'setup', 'specialRules', 'story', 'resolutions']
const required = new Set(['intro', 'setup', 'resolutions'])
const blockId = /^[a-zA-Z0-9][a-zA-Z0-9_-]*$/
const unresolvedMarkup = /@:[\w.]+|<\/?[a-z][^>]*>|\{\w+\}/i
const isRecord = value => value != null && typeof value === 'object' && !Array.isArray(value)

function text(value, path) {
  if (value === undefined) return undefined
  if (typeof value !== 'string' || !value.trim() || unresolvedMarkup.test(value)) {
    throw new TypeError(`${path} 必须是已展开的非空指南文字`)
  }
  return value.trim()
}

function validateBlocks(blocks, path) {
  if (!Array.isArray(blocks)) throw new TypeError(`${path} 必须是段落数组`)
  const ids = new Set()
  return blocks.map((block, index) => {
    if (!isRecord(block) || typeof block.id !== 'string' || !blockId.test(block.id) || ids.has(block.id)) {
      throw new TypeError(`${path}[${index}] 缺少唯一段落 ID`)
    }
    ids.add(block.id)
    const at = `${path}.${block.id}`
    const title = text(block.title, at + '.title')
    const body = text(block.text, at + '.text')
    const children = block.children === undefined ? [] : validateBlocks(block.children, at)
    if (!body && !children.length) throw new TypeError(`${at} 缺少正文`)
    return { id: block.id, ...(title ? { title } : {}), ...(body ? { text: body } : {}),
      ...(children.length ? { children } : {}) }
  })
}

const structure = blocks => blocks.map(block => ({
  id: block.id, ...(block.children ? { children: structure(block.children) } : {}),
}))

export function buildAuthoredScenarioGuide(manifest, source) {
  if (source?.id !== manifest.id || source?.campaignId !== manifest.campaignId || !isRecord(source.locales)) {
    throw new TypeError(`${manifest.id} 指南的关卡、战役或语言标识不匹配`)
  }
  // 设置面板摘要（可选）：与生成式指南的 note 同一读点（content/scenario-guides.js#scenarioSetupNote）。
  const note = source.note === undefined ? undefined : text(source.note, `${manifest.id}/note`)
  const locales = {}
  for (const language of ['zh', 'en']) {
    const locale = source.locales[language]
    if (!isRecord(locale) || Object.keys(locale).some(section => !sections.includes(section))) {
      throw new TypeError(`${manifest.id}/${language} 指南分节不合法`)
    }
    locales[language] = Object.fromEntries(sections.map(section => {
      const path = `${manifest.id}/${language}/${section}`
      const result = validateBlocks(locale[section] ?? [], path)
      if (required.has(section) && !result.length) throw new TypeError(`${path} 缺少必要分节`)
      return [section, result]
    }))
  }
  for (const section of sections) {
    if (JSON.stringify(structure(locales.zh[section])) !== JSON.stringify(structure(locales.en[section]))) {
      throw new TypeError(`${manifest.id}/${section} 的中英指南分支不一致`)
    }
  }
  const resolutionIds = new Set(locales.en.resolutions.map(block => block.id))
  for (const outcome of manifest.resolutionIds) {
    if (!resolutionIds.has(outcome)) throw new TypeError(`${manifest.id} 指南缺少结局 ${outcome}`)
  }
  return { id: manifest.id, campaignId: manifest.campaignId, sourceKind: 'authored', officialChinese: false,
    ...(note ? { note } : {}), locales }
}
