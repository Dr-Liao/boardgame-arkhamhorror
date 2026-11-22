import { INVESTIGATORS } from '../cards/cards-data.js'

// Alternate fronts have independent physical identities and share their deck options and signatures by family.
// 批次 4：一个原版调查员可以拥有多个替代印刷/平行版本（例：Jenny 02003 → 90084 平行 + 98001 小说），
// 因此 `alternates` 是数组；`advanced` 为全族替换签名并集，`advancedByAlternate` 覆盖具体版本的替换集，
// `always` 为该调查员的「必带附加签名」（如 Wendy 90038 Tidal Memento、Jim 90052 The Beyond）。
const familySpecs = [
  { original: '01002', alternates: ['90001'], advanced: ['90002', '90003'] },
  { original: '01003', alternates: ['90008'], advanced: ['90009', '90010'], retainTraits: ['Fortune', 'Gambit'] },
  { original: '01004', alternates: ['90017'], advanced: ['90018', '90019'], retainTraits: ['Spell'] },
  { original: '01001', alternates: ['90024', '98004'],
    advanced: ['90030', '90031', '98005', '98006'],
    advancedByAlternate: { 90024: ['90030', '90031'], 98004: ['98005', '98006'] },
    startingXpByAlternate: { 90024: 5 },
    directives: ['90025', '90026', '90027', '90028', '90029'], directivesFor: ['90024'] },
  // 批次 4：四个调查员挑战的平行套件。
  { original: '01005', alternates: ['90037'], advanced: ['90039', '90040'], always: ['90038'] },
  { original: '02005', alternates: ['90046'], advanced: ['90047', '90048'] },
  { original: '02004', alternates: ['90049'], advanced: ['90050', '90051'], always: ['90052'] },
  { original: '02001', alternates: ['90059'], advanced: ['90060', '90061'] },
  { original: '08007', alternates: ['90062'], advanced: ['90063', '90064'] },
  { original: '02002', alternates: ['90078'], advanced: ['90079', '90080'] },
  { original: '04004', alternates: ['90081'], advanced: ['90082', '90083'] },
  { original: '02003', alternates: ['90084', '98001'],
    advanced: ['90085', '90086', '98002', '98003'],
    advancedByAlternate: { 90084: ['90085', '90086'], 98001: ['98002', '98003'] } },
  { original: '03006', alternates: ['90087'], advanced: ['90088', '90089', '90090', '90091', '90092', '90093'] },
  // 批次 4：书籍/纪念印刷的替换签名（在对应印刷调查员上选择 advanced 即替换原签名）。
  { original: '08004', alternates: ['98007'], advanced: ['98008', '98009'] },
  { original: '05001', alternates: ['98010'], advanced: ['98011', '98012'] },
  { original: '07005', alternates: ['98013'], advanced: ['98014', '98015'] },
  { original: '07004', alternates: ['98016'], advanced: ['98017', '98018'] },
  { original: '11014', alternates: ['98019'], advanced: ['98020', '98021'] },
  { original: '05006', alternates: ['99001'], advanced: ['99002', '99003'] },
]

const unique = values => [...new Set(values)]
const advancedFor = spec => alternate => spec.advancedByAlternate?.[alternate] || spec.advanced || []
const normalize = spec => ({
  original: spec.original,
  alternates: [...spec.alternates],
  alternate: spec.alternates[0],
  advanced: unique(spec.alternates.flatMap(advancedFor(spec))),
  always: [...(spec.always || [])],
  retainTraits: [...(spec.retainTraits || [])],
  directives: [...(spec.directives || [])],
  startingXpByAlternate: { ...(spec.startingXpByAlternate || {}) },
  advancedFor: advancedFor(spec),
})
const families = familySpecs.map(normalize)

const byAlternate = new Map(families.flatMap(family => family.alternates.map(alternate => [alternate, family])))
const byOriginal = new Map()
for (const family of families) {
  const existing = byOriginal.get(family.original)
  if (!existing) { byOriginal.set(family.original, { ...family }); continue }
  existing.alternates.push(...family.alternates)
  existing.advanced = unique([...existing.advanced, ...family.advanced])
  existing.always = unique([...existing.always, ...family.always])
  existing.retainTraits = unique([...existing.retainTraits, ...family.retainTraits])
  existing.directives = unique([...existing.directives, ...family.directives])
  existing.startingXpByAlternate = { ...existing.startingXpByAlternate, ...family.startingXpByAlternate }
  const previous = existing.advancedFor
  existing.advancedFor = alternate => family.alternates.includes(alternate)
    ? family.advancedFor(alternate) : previous(alternate)
}

export const alternateInvestigatorCodes = Object.freeze(families.flatMap(family => family.alternates))
export const alternateDependencies = Object.freeze(unique(families.flatMap(family =>
  [...family.advanced, ...family.always, ...family.directives])))
export const alternateSignatureRequirements = Object.freeze(Object.fromEntries(families.flatMap(family =>
  family.alternates.map(alternate => [alternate, Object.freeze([
    // 平行/印刷调查员自己的 deckRequirements 是权威（如 Jim 90049 额外含永久 90052）；
    // 缺数据时退回原版签名清单。
    ...(INVESTIGATORS[alternate]?.deckRequirements?.signatureCards
      || INVESTIGATORS[family.original].deckRequirements.signatureCards),
  ])]))))

export function alternateInvestigatorFamily(code) {
  return byAlternate.get(code) || byOriginal.get(code) || null
}

export function alternateBuildFor(code, supplied = null, { partial = false } = {}) {
  const family = alternateInvestigatorFamily(code)
  if (!family) {
    if (supplied != null) throw new Error('这位调查员没有可配置的平行版本')
    return null
  }
  if (supplied != null && (typeof supplied !== 'object' || Array.isArray(supplied))) throw new Error('调查员构筑配置无效')
  const allowedBacks = unique([family.original, ...family.alternates])
  const directiveAlts = family.directives.length
    ? (familySpecs.find(spec => spec.original === family.original)?.directivesFor || []) : []
  const offered = directiveAlts.includes(code) ? family.directives : []
  const defaultDirectives = offered.length ? offered.slice(0, 3) : []
  const { back = code, signatures = 'standard', directives = defaultDirectives } = supplied || {}
  if (!allowedBacks.includes(back)) throw new Error('须选同一调查员的构筑背面')
  if (!['standard', 'advanced', 'both'].includes(signatures)) throw new Error('签名套件无效')
  if (!Array.isArray(directives) || new Set(directives).size !== directives.length || directives.some(item => !offered.includes(item))
    || (offered.length ? partial ? directives.length > 3 : directives.length !== 3 : directives.length !== 0)) {
    throw new Error('请从可用准则中选择三张不同的牌')
  }
  return { back, signatures, directives: offered.filter(item => directives.includes(item)) }
}

export function investigatorDeckDefinition(subject, supplied = subject?.investigatorBuild) {
  const face = INVESTIGATORS[subject?.code]
  const backCode = supplied?.back
  if (!face || !backCode || face.code === backCode) return face || subject
  const family = alternateInvestigatorFamily(face.code)
  if (!family || !unique([family.original, ...family.alternates]).includes(backCode)) return face
  const back = INVESTIGATORS[backCode]
  return { ...face, deckOptions: back.deckOptions, deckRequirements: back.deckRequirements }
}

export function investigatorBackExperience(subject) {
  const code = subject?.investigatorBuild?.back ?? subject?.code
  const family = alternateInvestigatorFamily(code)
  return family?.startingXpByAlternate?.[code] || 0
}

export function retainedUpgradeTraits(subject) {
  const code = subject?.investigatorBuild?.back ?? subject?.code
  const family = alternateInvestigatorFamily(code)
  return family && family.alternates.includes(code) ? family.retainTraits || [] : []
}
