// N2 卡图解析规则（纯函数，Node 与浏览器共用；不访问文件系统、不发起请求）。
//
// 规则来源：参考项目 frontend/src/arkham/{cardArt,helpers,artVariants}.ts（只读）。
// 迁移的是解析规则本身，不是「卡号 + b」的猜测：
//   1. 优先使用目录中 ArkhamDB 记录的真实美术编号（imagesrc / backimagesrc）；
//   2. 其次使用关联面（linked_card 双向索引）；
//   3. 最后才按类型套用参考项目的面向规则，并标注候选来源；
//   4. 通用卡背是无独立美术的一面，单独标记，便于前端用文字／样式回退。
// 候选有序且有限；任何候选都只代表「可拼出的路径」，不代表远程实际存在。

export const GENERIC_BACKS = Object.freeze({
  encounter: 'backs/back_encounter.webp',
  player: 'backs/back_player.webp',
})

// 修订核心版遭遇卡重印号（1604–1682）沿用原版美术，除非该卡显式声明了替代美术。
const REVISED_CORE_ENCOUNTER = Object.freeze({ min: 1604, max: 1682, offset: 500 })

/* 显式声明的替代美术。目录（ArkhamDB 结构）没有 artVariants 字段，这些映射来自只读参考源
 * backend/arkham-api/library/Arkham/{Treachery,Enemy,Agenda,Location}/CardDefs/NightOfTheZealot/*.hs
 * 的 cdArtVariants／cdBackArtVariants。背面变体按参考的索引方式挂在「去掉 a/c/e/g 后加 b」的面上。
 * 只登记这 7 张卡的 8 个面，不按编号规律推断其他变体。 */
export const DECLARED_ART_VARIANTS = Object.freeze({
  '01115b': Object.freeze({ revised: '01615b' }),
  '01145b': Object.freeze({ revised: '01645b' }),
  '01149': Object.freeze({ revised: '01649' }),
  '01149b': Object.freeze({ revised: '01649b' }),
  '01153': Object.freeze({ revised: '01653' }),
  '01157': Object.freeze({ revised: '01657' }),
  '01158': Object.freeze({ revised: '01658' }),
  '01174': Object.freeze({ revised: '01674' }),
})
// 声明出来的变体本身就落在重印号区间内，必须排除在回映射之外，否则 01658 会被改写回 01158。
const DECLARED_VARIANT_ARTS = new Set(Object.values(DECLARED_ART_VARIANTS).flatMap(Object.values))
const ART_PATTERN = /^[0-9]{3,6}[a-z]{0,2}$/
const GENERIC_BACK_TYPES = new Set(['enemy', 'story', 'treachery', 'scenario', 'location', 'key', 'enemy_location'])
const OWN_BACK_TYPES = new Set(['act', 'agenda', 'scenario', 'investigator'])

export function normalizeArt(value) {
  if (typeof value !== 'string') return null
  const art = value.trim().replace(/^c/, '').replace(/^.*\//, '').replace(/\.[a-z0-9]+$/i, '').toLowerCase()
  return ART_PATTERN.test(art) ? art : null
}

export function artPath(art) {
  return `cards/${art}.avif`
}

export function reprintedArt(art) {
  const match = /^(\d+)([a-z]*)$/.exec(art || '')
  if (!match || DECLARED_VARIANT_ARTS.has(art)) return art
  const number = Number(match[1])
  if (number < REVISED_CORE_ENCOUNTER.min || number > REVISED_CORE_ENCOUNTER.max) return art
  return String(number - REVISED_CORE_ENCOUNTER.offset).padStart(match[1].length, '0') + match[2]
}

function dropFaceSuffix(art) {
  return art.replace(/a$/, '')
}

// 参考项目在正面美术以 b 结尾、且关联面正是去掉 b 的编号时，认定该卡自身美术是背面。
function isBackPrimary({ doubleSided, art, otherSide }) {
  return !!(doubleSided && otherSide && /b$/.test(art) && otherSide === dropFaceSuffix(art.replace(/b$/, '')))
}

function push(candidates, art, source, { localizedArts } = {}) {
  const normalized = normalizeArt(art)
  if (!normalized) return candidates
  const resolved = reprintedArt(normalized)
  const path = artPath(resolved)
  if (candidates.some(candidate => candidate.path === path)) return candidates
  candidates.push({
    path,
    art: resolved,
    localized: !!(localizedArts && localizedArts.has(path)),
    source: resolved === normalized ? source : source + '+revised-core-reprint',
  })
  return candidates
}

function genericBack(type, card) {
  // 参考项目按类型区分遭遇卡背与玩家卡背；遭遇组内的资产／事件用遭遇组字段判定，不按名称猜。
  return GENERIC_BACK_TYPES.has(type) || (card && typeof card.encounterCode === 'string' && card.encounterCode) ? GENERIC_BACKS.encounter : GENERIC_BACKS.player
}

// 替代美术按「打印出来的美术编号」登记，不按实体或卡号推断；同一面没有声明就没有变体。
function declaredVariants(candidates, context) {
  const variants = {}
  for (const candidate of candidates) {
    for (const [key, art] of Object.entries(DECLARED_ART_VARIANTS[candidate.art] || {})) {
      if (Object.hasOwn(variants, key)) continue
      const built = push([], art, 'declared-variant-' + key, context)
      if (built.length) variants[key] = built[0]
    }
  }
  return variants
}

/**
 * 依据一张卡的目录记录解析正反面候选。
 * @param card 规范化目录记录（需要 code/type/doubleSided/imagesrc/backimagesrc/关联编号）
 * @param options.localizedArts 已知存在中文图片的路径集合（来自参考语言清单，不代表远程可达）
 * @param options.linkedFronts code → 该卡另一面正面美术 的双向索引
 */
export function buildImageDescriptor(card, { localizedArts, linkedFronts } = {}) {
  if (!card || typeof card.code !== 'string') return null
  const type = typeof card.type === 'string' ? card.type : ''
  const doubleSided = !!card.doubleSided
  const declaredFront = normalizeArt(card.imagesrc)
  const declaredBack = normalizeArt(card.backimagesrc)
  const art = declaredFront || normalizeArt(card.code) || null
  if (!art) return null
  const linkedCode = [card.linkedCardCode, card.linkedToCode, linkedFronts && linkedFronts.get(card.code)].find(value => typeof value === 'string' && value)
  const otherSide = normalizeArt(linkedCode)
  const context = { localizedArts }

  const front = []
  if (isBackPrimary({ doubleSided, art, otherSide })) push(front, otherSide, 'linked-face', context)
  else if (type === 'location' && doubleSided) {
    // The shipped English and Chinese art follows the catalog: imagesrc is
    // revealed, backimagesrc is unrevealed. Never fall back to the other face.
    push(front, art, declaredFront ? 'arkhamdb-imagesrc' : 'card-code', context)
  } else push(front, art, declaredFront ? 'arkhamdb-imagesrc' : 'card-code', context)
  // 参考项目的 altFrontImage：部分卡的正面只按 a 面发布（实测 03221 仅有 03221a）。
  // 作为末位兜底候选，仅在前面的候选失败后才会被请求。
  if (/\d$/.test(front[0]?.art || '')) push(front, `${front[0].art}a`, 'reference-alt-front', context)
  // 反向情况：权威编号带 a 面，但资产主机只按裸编号发布该面（实测 09544a／09659a）。
  if (declaredFront && /\da$/.test(declaredFront)) push(front, dropFaceSuffix(declaredFront), 'bare-code-fallback', context)
  push(front, card.duplicateOfCode, 'duplicate-of', context)

  const back = []
  if (isBackPrimary({ doubleSided, art, otherSide })) push(back, art, 'own-face', context)
  else if (type === 'location') {
    if (declaredBack) push(back, declaredBack, 'arkhamdb-backimagesrc', context)
    else if (otherSide) push(back, otherSide, 'linked-face', context)
    else if (doubleSided) push(back, `${dropFaceSuffix(art)}b`, 'reference-own-back', context)
  }
  else if (declaredBack) push(back, declaredBack, 'arkhamdb-backimagesrc', context)
  else if (otherSide) push(back, otherSide, 'linked-face', context)
  else if (OWN_BACK_TYPES.has(type) || doubleSided) push(back, `${dropFaceSuffix(art)}b`, 'reference-own-back', context)
  // 与正面同理：关联面若记为 a 面而资产主机按裸编号发布，补一次回退（实测 09544b 的另一面）。
  if (back.length && /\da$/.test(back[0].art || '')) push(back, dropFaceSuffix(back[0].art), 'bare-code-fallback', context)

  const backKind = back.length ? 'art' : 'generic-back'
  const backFile = genericBack(type, card)
  return {
    code: card.code,
    art: front[0]?.art || art,
    doubleSided,
    hasBackArt: backKind === 'art',
    front: { kind: 'art', candidates: front, variants: declaredVariants(front, context) },
    back: backKind === 'art'
      ? { kind: 'art', candidates: back, variants: declaredVariants(back, context) }
      : { kind: 'generic-back', candidates: [{ path: backFile, art: null, localized: false, source: 'generic-back' }], variants: {} },
  }
}

/** 显式美术编号（实例指定或替代美术）优先，但格式非法时不猜配。 */
export function withExplicitArt(descriptor, artId, { localizedArts } = {}) {
  const art = normalizeArt(artId)
  if (!descriptor || !art) return descriptor
  const candidates = push([], art, 'explicit-art', { localizedArts })
  if (!candidates.length) return descriptor
  return { ...descriptor, art, front: { ...descriptor.front, candidates: [...candidates, ...descriptor.front.candidates] } }
}
