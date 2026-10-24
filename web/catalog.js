import { imageCandidates, createImageCache, DEFAULT_IMAGE_HOST, normalizeImageHost } from './images.js'
import { objectiveText, renderRulesText } from './card-text.js'
import { cardRuleIds, matchingRules, ruleLink } from './rulebook-data.js'
import { renderCardFilters } from './card-filters.js'
import { t } from './i18n.js'

export const TYPE_LABELS = { investigator: '调查员', asset: '支援', event: '事件', skill: '技能', treachery: '诡计', enemy: '敌人', location: '地点', scenario: '剧本', agenda: '密谋', act: '场景', story: '故事', key: '钥匙', enemy_location: '敌人地点' }
// 可用性和规则验收分别展示；Core 验收不能推广到尚未验收的扩展牌。
export const EFFECT_LABELS = { unimplemented: '未实现', unverified: '有实现，未验收', partial: '部分实现', simplified: '简化实现', implemented: '已实现，未验收', verified: '已验收', 'not-applicable': '不适用' }
export const AVAILABILITY_LABELS = { 'catalog-only': '仅图鉴', simplified: '当前可玩', strict: '当前可玩，待规则审计', disabled: '禁用' }
// 上面的常量是中文源文案（Node 侧的展示口径/旧调用方仍按中文取），界面展示走下面的函数按当前语言取。
const TYPE_LABEL_KEYS = { investigator: 'card.type.investigator', asset: 'card.type.asset', event: 'card.type.event', skill: 'card.type.skill', treachery: 'card.type.treachery', enemy: 'card.type.enemy', location: 'card.type.location', scenario: 'card.type.scenario', agenda: 'card.type.agenda', act: 'card.type.act', story: 'card.type.story', key: 'card.type.key', enemy_location: 'card.type.enemyLocation' }
const EFFECT_LABEL_KEYS = { unimplemented: 'card.effect.unimplemented', unverified: 'card.effect.unverified', partial: 'card.effect.partial', simplified: 'card.effect.simplified', implemented: 'card.effect.implemented', verified: 'card.effect.verified', 'not-applicable': 'card.effect.notApplicable' }
const AVAILABILITY_LABEL_KEYS = { 'catalog-only': 'card.availability.catalogOnly', simplified: 'card.availability.simplified', strict: 'card.availability.strict', disabled: 'card.availability.disabled' }
export function typeLabel(value) {
  return TYPE_LABEL_KEYS[value] ? t(TYPE_LABEL_KEYS[value]) : (TYPE_LABELS[value] || value)
}
export function effectLabel(value) {
  return EFFECT_LABEL_KEYS[value] ? t(EFFECT_LABEL_KEYS[value]) : (EFFECT_LABELS[value] || value)
}
export function availabilityLabel(card) {
  return card.availability === 'strict' && card.effectStatus === 'verified'
    ? t('card.availability.playable') : (AVAILABILITY_LABEL_KEYS[card.availability] ? t(AVAILABILITY_LABEL_KEYS[card.availability]) : card.availability)
}
const localizedLabels = (labels, keys) => Object.fromEntries(Object.keys(labels).map(value => [value, keys[value] ? t(keys[value]) : labels[value]]))
const CLASS_LABELS = { guardian: '守卫者', seeker: '探求者', rogue: '游荡者', mystic: '秘术师', survivor: '幸存者', neutral: '中立', mythos: '神话' }
const imageCache = createImageCache()
const responseCache = new Map()
let metadata = null
let metadataPending = null
const LEGACY_IMAGE_HOST = 'https://assets.arkhamhorror.app'
const preferences = { host: DEFAULT_IMAGE_HOST, language: 'zh-cn', followHall: true, enabled: true, variant: '' }
try {
  const saved = JSON.parse(localStorage.getItem('arkham.presentation') || 'null')
  if (saved) {
    const host = normalizeImageHost(saved.host)
    preferences.host = !host || host === LEGACY_IMAGE_HOST ? DEFAULT_IMAGE_HOST : host
    preferences.language = saved.language === 'en' ? 'en' : 'zh-cn'
    // §8.5 迁移：旧数据没有 followHall。旧值 language === 'en' 视为玩家显式选过英文，
    // 置 followHall:false，避免升级后突然被大厅语言改回中文；其它情况默认跟随大厅。
    preferences.followHall = typeof saved.followHall === 'boolean' ? saved.followHall : saved.language !== 'en'
    preferences.enabled = saved.enabled !== false
    preferences.variant = saved.variant === 'revised' ? 'revised' : ''
    if (host === LEGACY_IMAGE_HOST) savePreferences({})
  }
} catch {}

// ---------------------------------------------------------------------------
// 卡牌语言（docs/localization.md §8.5）
//
// 大厅 locale（zh-CN / en / en-US / 其它）→ 游戏卡牌语言（'zh-cn' | 'en'）。
// 大厅 zh-CN 对应游戏 zh-cn；en 及其地区变体对应 en；其它语言按 Mod 的
// defaultLocale（zh-CN）处理。卡牌语言默认跟随大厅，玩家在游戏内显式改过才覆盖。
// ---------------------------------------------------------------------------

/** 大厅 locale → 游戏卡牌语言；空值返回 Mod 默认语言。 */
export function cardLanguage(locale) {
  const tag = String(locale ?? '').trim().toLowerCase()
  return tag === 'en' || tag.startsWith('en-') ? 'en' : 'zh-cn'
}

// 大厅当前语言的映射结果；'' 表示旧大厅没有 host.locale，此时回退玩家自己的卡牌语言偏好。
let hallLanguage = ''

/** createUI 时同步大厅语言（host.locale.resolved）；跟随大厅时同时更新卡牌语言偏好。 */
export function setHostLocale(locale) {
  hallLanguage = typeof locale === 'string' && locale.trim() ? cardLanguage(locale) : ''
  if (hallLanguage && preferences.followHall) savePreferences({ language: hallLanguage })
  return currentLanguage()
}

/** 当前生效的卡牌语言：跟随大厅且已知大厅语言时用大厅映射，否则用玩家偏好。 */
export function currentLanguage() {
  return preferences.followHall && hallLanguage ? hallLanguage : preferences.language
}

function displayLanguage(locale) {
  return typeof locale === 'string' && locale.trim() ? cardLanguage(locale) : currentLanguage()
}

/**
 * 卡牌显示名的唯一入口（§8.7 第二步）。
 * en：优先 nameEn（引擎/构筑投影把英文名放在这里），否则基础 name（目录数据基础字段是英文）；
 * zh-CN：nameZh || name，逐字段回退；其它 locale 按 defaultLocale（zh-CN）处理。
 */
export function cardDisplayName(card, locale) {
  if (!card) return ''
  const language = displayLanguage(locale)
  const english = card.nameEn || card.name || card.nameZh || ''
  return language === 'en' ? english : (card.nameZh || card.name || english)
}

/** 卡牌规则文本：zh-CN 用 textZh||text，en 用基础英文字段（text 缺失时回退 textZh）。 */
export function cardDisplayText(card, locale) {
  if (!card) return ''
  return displayLanguage(locale) === 'en'
    ? (card.text || card.textZh || '')
    : (card.textZh || card.text || '')
}

/** 卡牌风味文本，回退规则同 cardDisplayText。 */
export function cardDisplayFlavor(card, locale) {
  if (!card) return ''
  return displayLanguage(locale) === 'en'
    ? (card.flavor || card.flavorZh || '')
    : (card.flavorZh || card.flavor || '')
}

/** 卡牌副标题（调查员称号等），回退规则同 cardDisplayName。 */
export function cardDisplaySubname(card, locale) {
  if (!card) return ''
  return displayLanguage(locale) === 'en'
    ? (card.subname || card.subnameZh || '')
    : (card.subnameZh || card.subname || '')
}

/** 卡牌特性：逐项回退到另一种语言，避免空数组时显示空白。 */
export function cardDisplayTraits(card, locale) {
  const traits = Array.isArray(card?.traits) ? card.traits : []
  const traitsZh = Array.isArray(card?.traitsZh) ? card.traitsZh : []
  return displayLanguage(locale) === 'en'
    ? (traits.length ? traits : traitsZh)
    : (traitsZh.length ? traitsZh : traits)
}

// 本 Mod 的只读接口由大厅按通用契约挂在 /api/mods/<id>/ 下。
const API_ROOT = '/api/mods/arkhamhorror/'

async function request(path) {
  if (responseCache.has(path)) return responseCache.get(path)
  const pending = (async () => {
    const response = await fetch(API_ROOT + path, { signal: AbortSignal.timeout(10000) })
    const value = await response.json()
    if (!response.ok || !value.ok) throw new Error(value.error || '目录加载失败')
    return value
  })()
  responseCache.set(path, pending)
  try {
    const value = await pending
    if (responseCache.size > 160) responseCache.delete(responseCache.keys().next().value)
    return value
  } catch (error) {
    responseCache.delete(path)
    throw error
  }
}

export async function getCatalogMetadata() {
  if (metadata) return metadata
  if (!metadataPending) metadataPending = request('catalog/meta').then(value => (metadata = value)).finally(() => { metadataPending = null })
  return metadataPending
}

export async function getCardPresentation(code) {
  const meta = await getCatalogMetadata()
  return request('cards/' + encodeURIComponent(code) + '?v=' + encodeURIComponent(meta.resourceVersion))
}

export function cardFaceText(card, linkedCard, side, language = currentLanguage()) {
  const back = side === 'back'
  const associated = back && linkedCard
  const source = associated || card
  const prefix = back && !associated ? 'back' : ''
  const field = name => prefix ? prefix + name[0].toUpperCase() + name.slice(1) : name
  // 逐字段回退：en 用基础英文字段（缺失时才退中文），其它语言用中文叠加字段（缺失退基础字段）。
  const choose = name => {
    const base = source[field(name)]
    const zh = source[field(name) + 'Zh']
    return language === 'en' ? (base || zh || '') : (zh || base || '')
  }
  if (!back) return { ...source, nameZh: language === 'en' ? '' : source.nameZh, textZh: language === 'en' ? '' : source.textZh, flavorZh: language === 'en' ? '' : source.flavorZh, subnameZh: language === 'en' ? '' : source.subnameZh, traitsZh: language === 'en' ? null : source.traitsZh }
  return {
    code: source.code, type: associated ? source.type : 'card_back', klass: source.klass,
    name: choose('name') || t('card.back.name', { name: cardDisplayName(card, language) }),
    text: choose('text') || t('card.back.generic'),
    flavor: choose('flavor'),
    ...(associated ? { health: source.health, fight: source.fight, evade: source.evade, damage: source.damage, horror: source.horror, traits: source.traits } : {}),
  }
}

function savePreferences(next) {
  Object.assign(preferences, next)
  try { localStorage.setItem('arkham.presentation', JSON.stringify(preferences)) } catch {}
}

export function renderImage(h, descriptor, side = 'front', { compact = false, artId } = {}) {
  const holder = h('figure', { className: 'ah-art' + (compact ? ' ah-art-compact' : ''), 'data-image-state': 'pending' })
  const status = h('figcaption', { className: 'ah-art-status', 'aria-live': compact ? 'off' : 'polite' })
  holder.append(status)
  const fallback = () => {
    holder.dataset.imageState = 'text-fallback'
    status.textContent = preferences.enabled ? t('image.unavailable') : t('image.textMode')
  }
  if (!descriptor || !preferences.enabled) { fallback(); return holder }
  let candidates
  try { candidates = imageCandidates(descriptor, { side, host: preferences.host, language: currentLanguage(), artId, variant: preferences.variant }) } catch { fallback(); return holder }
  const img = h('img', { alt: side === 'back' ? t('card.face.back') : t('card.face.front'), decoding: 'async', referrerpolicy: 'no-referrer' })
  holder.prepend(img)
  let timer
  let current
  let active = false
  const attempt = () => {
    clearTimeout(timer)
    current = imageCache.next(candidates)
    if (!current) { img.removeAttribute('src'); img.hidden = true; fallback(); return }
    holder.dataset.imageState = 'loading'
    status.textContent = t('image.loading')
    img.hidden = false
    img.src = current.url
    timer = setTimeout(() => fail(), 8000)
  }
  const fail = () => {
    clearTimeout(timer)
    if (!current) return
    imageCache.fail(current.url)
    if (!holder.isConnected) return
    attempt()
  }
  img.addEventListener('error', fail)
  img.addEventListener('load', () => {
    clearTimeout(timer)
    if (!current || !img.naturalWidth) return
    imageCache.succeed(current.url)
    holder.dataset.imageState = 'displayable'
    holder.classList.toggle('ah-art-landscape', img.naturalWidth > img.naturalHeight)
    status.textContent = current.source?.startsWith('declared-variant')
      ? t('image.revised')
      : current.language === 'zh' ? t('image.zh') : current.language === 'en' ? t('image.en') : t('image.back')
  })
  const start = () => { if (!active) { active = true; attempt() } }
  if (compact && typeof IntersectionObserver !== 'undefined') {
    const observer = new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting)) { observer.disconnect(); start() }
    }, { rootMargin: '100px' })
    observer.observe(holder)
    setTimeout(() => { if (!holder.isConnected) observer.disconnect() }, 1000)
  } else queueMicrotask(start)
  return holder
}

const PRELOAD_CONCURRENCY = 4
const PRELOAD_TIMEOUT_MS = 20000
let preloadRun = null

/** 该面在本地图库清单中已有可直接展示的文件时不预热；中文偏好下仅有英文本地图而中文图存在时仍预热中文。 */
function faceIsLocal(face, wantsLocalized) {
  const candidates = face?.candidates || []
  if (wantsLocalized && candidates.some(candidate => candidate.localLocalized)) return true
  if (wantsLocalized && candidates.some(candidate => candidate.localized)) return false
  return candidates.some(candidate => candidate.local)
}

function preloadOne(candidates, signal) {
  return new Promise(resolve => {
    const attempt = () => {
      const current = signal.aborted ? null : imageCache.next(candidates)
      if (!current || imageCache.state(current.url) === 'displayable') { resolve(); return }
      const img = new Image()
      img.decoding = 'async'
      img.referrerPolicy = 'no-referrer'
      img.fetchPriority = 'low'
      const done = ok => {
        clearTimeout(timer)
        signal.removeEventListener('abort', abort)
        img.onload = img.onerror = null
        if (ok === null) { resolve(); return }
        if (ok) { imageCache.succeed(current.url); resolve() } else { imageCache.fail(current.url); attempt() }
      }
      const abort = () => { img.src = ''; done(null) }
      // 超时不记失败：服务端可能仍在下载，交给正式渲染再试。
      const timer = setTimeout(() => done(null), PRELOAD_TIMEOUT_MS)
      signal.addEventListener('abort', abort, { once: true })
      img.onload = () => done(img.naturalWidth > 0)
      img.onerror = () => done(false)
      img.src = current.url
    }
    attempt()
  })
}

/**
 * 局外整备时预热下一关的全部卡图（剧本、密谋、场景、地点、遭遇）。
 * 默认 CDN 下经同源 ?cache=cdn 请求，由大厅落盘到本地图库；自定义主机则预热浏览器缓存。
 * 同一关卡与偏好只执行一次；切换关卡会取消上一轮尚未开始的请求。
 */
export function preloadScenarioImages(scenarioId) {
  if (!scenarioId || !preferences.enabled || typeof Image === 'undefined') return
  const language = currentLanguage()
  const key = JSON.stringify([scenarioId, preferences.host, language, preferences.variant])
  if (preloadRun?.key === key) return
  preloadRun?.controller.abort()
  const controller = new AbortController()
  preloadRun = { key, controller }
  const { signal } = controller
  ;(async () => {
    const meta = await getCatalogMetadata()
    const manifest = await request('scenarios/' + encodeURIComponent(scenarioId) + '/images?v=' + encodeURIComponent(meta.resourceVersion))
    const wantsLocalized = language !== 'en'
    const queue = []
    const seen = new Set()
    for (const { images } of manifest.cards || []) {
      for (const side of ['front', 'back']) {
        if (faceIsLocal(images?.[side], wantsLocalized)) continue
        let candidates
        try { candidates = imageCandidates(images, { side, host: preferences.host, language, variant: preferences.variant }) } catch { continue }
        if (!candidates.length || seen.has(candidates[0].url)) continue
        seen.add(candidates[0].url)
        queue.push(candidates)
      }
    }
    const worker = async () => {
      while (queue.length && !signal.aborted) await preloadOne(queue.shift(), signal)
    }
    await Promise.all(Array.from({ length: PRELOAD_CONCURRENCY }, worker))
  })().catch(() => { if (preloadRun?.controller === controller) preloadRun = null })
}

export function renderPresentationSettings(h, onChange) {
  const host = h('input', { className: 'bg-input', value: preferences.host, placeholder: DEFAULT_IMAGE_HOST, 'aria-label': t('presentation.host.label'), autocomplete: 'off' })
  const message = h('div', { className: 'ah-resource-note', role: 'status' })
  const language = h('select', { className: 'bg-select', 'aria-label': t('presentation.language.label'), onchange: event => {
    // 玩家在游戏内显式选择卡牌语言 = 不再跟随大厅（§8.5）。
    savePreferences({ language: event.target.value, followHall: false }); onChange()
  } },
    h('option', { value: 'zh-cn' }, t('locale.zh-CN')), h('option', { value: 'en' }, t('locale.en')))
  language.value = preferences.language
  const languageRow = h('div', { className: 'ah-settings-row' }, language,
    h('label', { className: 'ah-text-mode' }, h('input', { type: 'checkbox', checked: preferences.followHall, onchange: event => {
      const followHall = !!event.target.checked
      savePreferences({ followHall, ...(followHall && hallLanguage ? { language: hallLanguage } : {}) }); onChange()
    } }), t('presentation.language.follow')))
  const variant = h('select', { className: 'bg-select', 'aria-label': t('presentation.variant.label'), onchange: event => { savePreferences({ variant: event.target.value }); onChange() } },
    h('option', { value: '' }, t('presentation.variant.original')), h('option', { value: 'revised' }, t('presentation.variant.revised')))
  variant.value = preferences.variant
  return h('details', { className: 'ah-presentation-settings' },
    h('summary', null, t('presentation.settings.title')),
    h('p', { className: 'ah-resource-note' }, t('presentation.settings.note')),
    h('div', { className: 'ah-settings-row' }, host, h('button', { className: 'bg-btn secondary', onclick: () => {
      try { savePreferences({ host: normalizeImageHost(host.value) }); onChange() } catch { message.textContent = t('presentation.host.invalid') }
    } }, t('presentation.host.apply'))),
    languageRow,
    variant,
    h('label', { className: 'ah-text-mode' }, h('input', { type: 'checkbox', checked: !preferences.enabled, onchange: event => { savePreferences({ enabled: !event.target.checked }); onChange() } }), t('presentation.textMode')),
    message)
}

// 详情面板用目录卡文排版，但生命／伤害／有效战斗等结算值必须取场上实例：
// 否则「实验体」这类带每调查员加值的敌人会一直显示印刷的 7 点，和桌面上的 10 点对不上。
const RUNTIME_CARD_FIELDS = ['health', 'sanity', 'damageTaken', 'damage', 'horror', 'fight', 'evade', 'effectiveFight', 'effectiveEvade', 'exhausted']
function runtimeCardStats(def) {
  if (!def) return null
  const stats = Object.fromEntries(RUNTIME_CARD_FIELDS
    .filter(field => def[field] !== undefined)
    .map(field => [field, def[field]]))
  return Object.keys(stats).length ? stats : null
}

export function renderDetailContent(h, detail, renderTextCard, onChange, gameState) {
  const entry = detail.entry
  const side = detail.side || 'front'
  const base = entry?.card || detail.def
  const runtime = detail.runtime && side === 'front' ? runtimeCardStats(detail.def) : null
  const card = runtime ? { ...base, ...runtime } : base
  const linked = entry?.linkedCard
  const labels = [availabilityLabel(card), effectLabel(card.effectStatus)].filter(Boolean)
  const notes = [...new Set([...(entry?.differenceNotes || card.differenceNotes || []), detail.def.identityReason].filter(Boolean))]
  const face = cardFaceText(card, linked, side)
  const objective = objectiveText(detail.def.objective, gameState)
  const backAllowed = !detail.runtime || card.type === 'investigator' || (!card.doubleSided && !card.linkedCardCode && !card.linkedToCode && !['location', 'act', 'agenda', 'scenario', 'story'].includes(card.type))
  return h('div', { className: 'ah-detail-content' },
    h('div', { className: 'ah-detail-toolbar' },
      h('button', { className: 'bg-btn secondary', 'aria-pressed': String(side === 'front'), onclick: () => { detail.side = 'front'; onChange() } }, t('detail.front')),
      h('button', { className: 'bg-btn secondary', disabled: !backAllowed, 'aria-pressed': String(side === 'back'), onclick: () => { detail.side = 'back'; onChange() } }, t('detail.back')),
      h('span', { className: 'ah-resource-note' }, t('detail.code', { code: card.code || detail.code || t('detail.unmapped') }))),
    h('div', { className: 'ah-detail-kicker' }, typeLabel(card.type) || t('detail.type.card')),
    h('div', { className: 'ah-detail-layout' },
      renderImage(h, entry?.images || card.images, side, { artId: detail.def.artId }),
      h('div', null, renderTextCard(face),
        h('nav', {className:'ah-card-rule-links','aria-label':t('detail.rules.links')},
          // 卡号级映射优先：`card` 是已加载的卡面（含 text/textZh/traits/slot），只传 `detail.def`
          // 会让 `^04`/`^05` 这类「按卡文判定」的条目丢失，只剩通用条目占满 10 个名额。
          [...new Set([...cardRuleIds({ ...detail.def, ...card }), ...matchingRules([face.text,face.textZh,face.slot,face.slots?.join(' '),face.keywords?.join?.(' ')].filter(Boolean).join(' ')).map(r=>r.id)])]
            .slice(0,10).map(id=>ruleLink(h,id)),
          ruleLink(h,'round',t('detail.rulebook.open'))),
        detail.runtime && objective ? h('section', { className: 'ah-runtime-text' }, h('h3', null, t('detail.objective')), h('p', null, renderRulesText(h, objective))) : null,
        h('details', { className: 'ah-detail-meta' }, h('summary', {}, t('detail.meta.title')),
          h('div', { className: 'ah-status-badges' }, labels.map(label => h('span', { className: 'ah-kw' }, label))),
          h('p', { className: 'ah-resource-note' }, detail.runtime ? t('detail.meta.runtime') : t('detail.meta.catalog')),
          notes.map(note => h('p', { className: 'ah-difference-note' }, note))))),
    detail.loading ? h('p', { className: 'ah-resource-note', role: 'status' }, t('detail.loading')) : null,
    detail.error ? h('p', { className: 'ah-difference-note', role: 'status' }, t('detail.error', { error: detail.error })) : null,
    renderPresentationSettings(h, onChange))
}

export function createCatalogUI({ h, onChange, openCard }) {
  const state = { open: false, loading: false, error: '', filters: {}, offset: 0, limit: 24, result: null, sequence: 0 }
  const repaint = () => {
    const modal=document.querySelector('.ah-catalog-modal'),scroll=modal?.scrollTop||0
    const active=document.activeElement,key=active?.dataset.focusKey,cursor=active?.selectionStart
    onChange()
    queueMicrotask(()=>{
      const next=document.querySelector('.ah-catalog-modal');if(!next)return
      next.scrollTop=scroll
      if(key){const target=[...next.querySelectorAll('[data-focus-key]')].find(el=>el.dataset.focusKey===key);target?.focus({preventScroll:true});if(cursor!=null)target?.setSelectionRange?.(cursor,cursor)}
    })
  }
  async function load() {
    const sequence = ++state.sequence
    state.loading = true; state.error = ''; repaint()
    try {
      const meta = await getCatalogMetadata()
      const {search,pack,...filters}=state.filters
      const query = new URLSearchParams({ ...filters, q:search||'', packCode:pack||'', offset: String(state.offset), limit: String(state.limit), v: meta.resourceVersion })
      const result = await request('catalog?' + query)
      if (sequence !== state.sequence) return
      state.result = result
    } catch (error) {
      if (sequence !== state.sequence) return
      state.error = error.message
    }
    if (sequence === state.sequence) { state.loading = false; repaint() }
  }
  const choose = (key, label, values, labels = {}) => {
    const select = h('select', { className: 'bg-select', 'aria-label': label, 'data-focus-key':`catalog:${key}`, onchange: event => { state.filters[key] = event.target.value; state.offset = 0; load() } },
      h('option', { value: '' }, t('catalog.allOption', { label })),
      (values || []).map(value => { const code = typeof value === 'string' ? value : value.code || value.value; return h('option', { value: code }, labels[code] || value.name || code) }))
    select.value = state.filters[key]
    return select
  }
  return {
    get isOpen() { return state.open },
    open() { state.open = true; load() },
    close() { state.open = false; state.sequence++; state.loading = false; onChange() },
    render() {
      const close = () => { state.open = false; state.sequence++; onChange() }
      const result = state.result
      return h('div', { className: 'bg-backdrop ah-catalog-backdrop' },
        h('section', { className: 'bg-modal ah-catalog-modal', role: 'dialog', 'aria-modal': 'true', 'aria-label': t('catalog.title'), onclick: event => event.stopPropagation(), onkeydown: event => { if (event.key === 'Escape') close() } },
          h('header', { className: 'ah-catalog-head' }, h('div', null, h('h2', null, t('catalog.title')), h('p', { className: 'ah-resource-note' }, t('catalog.note'))), h('button', { className: 'bg-btn secondary', onclick: close, 'aria-label': t('catalog.close') }, t('catalog.closeAction'))),
          renderCardFilters(h,{scope:'catalog',filters:state.filters,count:result?.total||0,searchLabel:t('catalog.searchLabel'),
            options:{...metadata,typeLabels:localizedLabels(TYPE_LABELS, TYPE_LABEL_KEYS)},onChange:filters=>{state.filters=filters;state.offset=0;load()}}),
          h('div', { className: 'ah-catalog-filters' }, h('button',{className:'bg-btn',onclick:()=>{state.offset=0;load()}},t('catalog.search')),choose('effectStatus', t('catalog.effectStatus'), metadata?.effectStatuses, localizedLabels(EFFECT_LABELS, EFFECT_LABEL_KEYS)), choose('availability', t('catalog.availability'), metadata?.availabilityStatuses, localizedLabels(AVAILABILITY_LABELS, AVAILABILITY_LABEL_KEYS))),
          renderPresentationSettings(h, onChange),
          h('div', { className: 'ah-catalog-summary', role: 'status' }, state.loading ? t('catalog.loading') : state.error || t('catalog.summary', { total: result?.total || 0, limit: state.limit })),
          state.error ? h('button', { className: 'bg-btn secondary', onclick: load }, t('catalog.reload')) : null,
          h('div', { className: 'ah-catalog-grid', 'aria-busy': String(state.loading) }, !state.error ? (result?.cards || []).map(card => {
            const name = cardDisplayName(card)
            return h('button', { className: 'ah-catalog-card', disabled:state.loading, onclick: () => openCard(card), 'aria-label': name + ' ' + card.code,
              'data-zoom-code': card.code, 'data-zoom-name': name },
              renderImage(h, card.images, 'front', { compact: true }),
              h('span', { className: 'ah-catalog-card-name' }, name),
              h('span', { className: 'ah-catalog-card-meta' }, card.code + ' · ' + typeLabel(card.type)),
              h('span', { className: 'ah-catalog-card-meta' }, effectLabel(card.effectStatus) + ' · ' + availabilityLabel(card)))
          }) : null),
          !state.loading && !state.error && result?.total === 0 ? h('p', { className: 'bg-empty' }, t('catalog.empty')) : null,
          h('footer', { className: 'ah-catalog-pagination' },
            h('button', { className: 'bg-btn secondary', disabled: state.loading || state.offset === 0, onclick: () => { state.offset = Math.max(0, state.offset - state.limit); load() } }, t('catalog.prev')),
            h('span', null, t('catalog.page', { page: Math.floor(state.offset / state.limit) + 1 })),
            h('button', { className: 'bg-btn secondary', disabled: state.loading || !result || state.offset + state.limit >= result.total, onclick: () => { state.offset += state.limit; load() } }, t('catalog.next')))))
    },
  }
}
