import { INVESTIGATORS } from '../cards/cards-data.js'

// Alternate fronts have independent physical identities and share their deck options and signatures by family.
const families = [
  { original: '01002', alternate: '90001', advanced: ['90002', '90003'] },
  { original: '01003', alternate: '90008', advanced: ['90009', '90010'], retainTraits: ['Fortune', 'Gambit'] },
  { original: '01004', alternate: '90017', advanced: ['90018', '90019'], retainTraits: ['Spell'] },
  { original: '01001', alternate: '90024', advanced: ['90030', '90031'], startingXp: 5,
    directives: ['90025', '90026', '90027', '90028', '90029'] },
]
const byFace = new Map(families.flatMap(family => [[family.original, family], [family.alternate, family]]))

export const alternateInvestigatorCodes = Object.freeze(families.map(family => family.alternate))
export const alternateDependencies = Object.freeze(families.flatMap(family => [...family.advanced, ...(family.directives || [])]))
export const alternateSignatureRequirements = Object.freeze(Object.fromEntries(families.map(family => [
  family.alternate, Object.freeze([...INVESTIGATORS[family.original].deckRequirements.signatureCards]),
])))

export function alternateInvestigatorFamily(code) { return byFace.get(code) || null }

export function alternateBuildFor(code, supplied = null, { partial = false } = {}) {
  const family = alternateInvestigatorFamily(code)
  if (!family) {
    if (supplied != null) throw new Error('这位调查员没有可配置的平行版本')
    return null
  }
  if (supplied != null && (typeof supplied !== 'object' || Array.isArray(supplied))) throw new Error('调查员构筑配置无效')
  const { back = code, signatures = 'standard', directives = code === family.alternate ? family.directives?.slice(0, 3) || [] : [] } = supplied || {}
  if (![family.original, family.alternate].includes(back)) throw new Error('须选同一调查员的构筑背面')
  if (!['standard', 'advanced', 'both'].includes(signatures)) throw new Error('签名套件无效')
  const offered = code === family.alternate ? family.directives || [] : []
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
  const family = byFace.get(face.code)
  if (!family || ![family.original, family.alternate].includes(backCode)) return face
  const back = INVESTIGATORS[backCode]
  return { ...face, deckOptions: back.deckOptions, deckRequirements: back.deckRequirements }
}

export function investigatorBackExperience(subject) {
  const code = subject?.investigatorBuild?.back ?? subject?.code
  const family = byFace.get(code)
  return family?.alternate === code ? family.startingXp || 0 : 0
}

export function retainedUpgradeTraits(subject) {
  const code = subject?.investigatorBuild?.back ?? subject?.code
  const family = byFace.get(code)
  return family?.alternate === code ? family.retainTraits || [] : []
}
