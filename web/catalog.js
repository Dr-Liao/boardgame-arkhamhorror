import { imageCandidates, createImageCache, DEFAULT_IMAGE_HOST, normalizeImageHost } from './images.js'
import { objectiveText, renderRulesText } from './card-text.js'
import { cardRuleIds, matchingRules, ruleLink } from './rulebook-data.js'
import { renderCardFilters } from './card-filters.js'

export const TYPE_LABELS = { investigator: '调查员', asset: '支援', event: '事件', skill: '技能', treachery: '诡计', enemy: '敌人', location: '地点', scenario: '剧本', agenda: '密谋', act: '场景', story: '故事', key: '钥匙', enemy_location: '敌人地点' }
// 可用性和规则验收分别展示；Core 验收不能推广到尚未验收的扩展牌。
export const EFFECT_LABELS = { unimplemented: '未实现', unverified: '有实现·未验收', partial: '部分实现', simplified: '简化实现', implemented: '已实现·未验收', verified: '已验收', 'not-applicable': '不适用' }
export const AVAILABILITY_LABELS = { 'catalog-only': '仅图鉴', simplified: '当前可玩', strict: '当前可玩（待规则审计）', disabled: '禁用' }
const availabilityLabel = card => card.availability === 'strict' && card.effectStatus === 'verified'
  ? '当前可玩' : AVAILABILITY_LABELS[card.availability] || card.availability
const CLASS_LABELS = { guardian: '守卫者', seeker: '探求者', rogue: '游荡者', mystic: '秘术师', survivor: '幸存者', neutral: '中立', mythos: '神话' }
const imageCache = createImageCache()
const responseCache = new Map()
let metadata = null
let metadataPending = null
const preferences = { host: DEFAULT_IMAGE_HOST, language: 'zh-cn', enabled: true, variant: '' }
try {
  const saved = JSON.parse(localStorage.getItem('arkham.presentation') || 'null')
  if (saved) {
    preferences.host = normalizeImageHost(saved.host)
    preferences.language = saved.language === 'en' ? 'en' : 'zh-cn'
    preferences.enabled = saved.enabled !== false
    preferences.variant = saved.variant === 'revised' ? 'revised' : ''
  }
} catch {}

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

export function cardFaceText(card, linkedCard, side, language = preferences.language) {
  const back = side === 'back'
  const associated = back && linkedCard
  const source = associated || card
  const prefix = back && !associated ? 'back' : ''
  const field = name => prefix ? prefix + name[0].toUpperCase() + name.slice(1) : name
  const choose = name => language === 'en' ? source[field(name)] || '' : source[field(name) + 'Zh'] || source[field(name)] || ''
  if (!back) return { ...source, nameZh: language === 'en' ? '' : source.nameZh, textZh: language === 'en' ? '' : source.textZh, flavorZh: language === 'en' ? '' : source.flavorZh, subnameZh: language === 'en' ? '' : source.subnameZh, traitsZh: language === 'en' ? null : source.traitsZh }
  return {
    code: source.code, type: associated ? source.type : 'card_back', klass: source.klass,
    name: choose('name') || ((card.nameZh || card.name) + ' · 背面'),
    text: choose('text') || '通用卡背或此面没有独立卡文。',
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
    status.textContent = preferences.enabled ? '卡图不可用 · 文字仍可读' : '纯文字模式'
  }
  if (!descriptor || !preferences.enabled) { fallback(); return holder }
  let candidates
  try { candidates = imageCandidates(descriptor, { side, host: preferences.host, language: preferences.language, artId, variant: preferences.variant }) } catch { fallback(); return holder }
  const img = h('img', { alt: side === 'back' ? '卡牌背面' : '卡牌正面', decoding: 'async', referrerpolicy: 'no-referrer' })
  holder.prepend(img)
  let timer
  let current
  let active = false
  const attempt = () => {
    clearTimeout(timer)
    current = imageCache.next(candidates)
    if (!current) { img.removeAttribute('src'); img.hidden = true; fallback(); return }
    holder.dataset.imageState = 'loading'
    status.textContent = '正在加载卡图…'
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
      ? '替代美术（修订版）'
      : current.language === 'zh' ? '中文卡图' : current.language === 'en' ? '英文卡图（中文缺图时回退）' : '卡背'
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
  const key = JSON.stringify([scenarioId, preferences.host, preferences.language, preferences.variant])
  if (preloadRun?.key === key) return
  preloadRun?.controller.abort()
  const controller = new AbortController()
  preloadRun = { key, controller }
  const { signal } = controller
  ;(async () => {
    const meta = await getCatalogMetadata()
    const manifest = await request('scenarios/' + encodeURIComponent(scenarioId) + '/images?v=' + encodeURIComponent(meta.resourceVersion))
    const wantsLocalized = preferences.language !== 'en'
    const queue = []
    const seen = new Set()
    for (const { images } of manifest.cards || []) {
      for (const side of ['front', 'back']) {
        if (faceIsLocal(images?.[side], wantsLocalized)) continue
        let candidates
        try { candidates = imageCandidates(images, { side, host: preferences.host, language: preferences.language, variant: preferences.variant }) } catch { continue }
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
  const host = h('input', { className: 'bg-input', value: preferences.host, placeholder: 'https://assets.arkhamhorror.app', 'aria-label': '卡图主机', autocomplete: 'off' })
  const message = h('div', { className: 'ah-resource-note', role: 'status' })
  const language = h('select', { className: 'bg-select', 'aria-label': '卡文与图片语言', onchange: event => { savePreferences({ language: event.target.value }); onChange() } },
    h('option', { value: 'zh-cn' }, '简体中文（允许回退）'), h('option', { value: 'en' }, 'English'))
  language.value = preferences.language
  const variant = h('select', { className: 'bg-select', 'aria-label': '美术版本', onchange: event => { savePreferences({ variant: event.target.value }); onChange() } },
    h('option', { value: '' }, '原版美术'), h('option', { value: 'revised' }, '修订版替代美术（仅少数已声明的卡）'))
  variant.value = preferences.variant
  return h('details', { className: 'ah-presentation-settings' },
    h('summary', null, '图片与语言设置'),
    h('p', { className: 'ah-resource-note' }, '默认 CDN 卡图首次显示后会缓存到本地资源目录；自定义主机仍由浏览器直接加载。设置不改变规则或可用卡池。'),
    h('div', { className: 'ah-settings-row' }, host, h('button', { className: 'bg-btn secondary', onclick: () => {
      try { savePreferences({ host: normalizeImageHost(host.value) }); onChange() } catch { message.textContent = '请输入不带账号、查询参数或片段的 HTTP(S) 主机地址。' }
    } }, '应用主机')),
    language,
    variant,
    h('label', { className: 'ah-text-mode' }, h('input', { type: 'checkbox', checked: !preferences.enabled, onchange: event => { savePreferences({ enabled: !event.target.checked }); onChange() } }), '纯文字模式（不请求远程图片）'),
    message)
}

export function renderDetailContent(h, detail, renderTextCard, onChange, gameState) {
  const entry = detail.entry
  const card = entry?.card || detail.def
  const side = detail.side || 'front'
  const linked = entry?.linkedCard
  const labels = [availabilityLabel(card), EFFECT_LABELS[card.effectStatus] || card.effectStatus].filter(Boolean)
  const notes = [...new Set([...(entry?.differenceNotes || card.differenceNotes || []), detail.def.identityReason].filter(Boolean))]
  const face = cardFaceText(card, linked, side)
  const objective = objectiveText(detail.def.objective, gameState)
  const backAllowed = !detail.runtime || card.type === 'investigator' || (!card.doubleSided && !card.linkedCardCode && !card.linkedToCode && !['location', 'act', 'agenda', 'scenario', 'story'].includes(card.type))
  return h('div', { className: 'ah-detail-content' },
    h('div', { className: 'ah-detail-toolbar' },
      h('button', { className: 'bg-btn secondary', 'aria-pressed': String(side === 'front'), onclick: () => { detail.side = 'front'; onChange() } }, '正面'),
      h('button', { className: 'bg-btn secondary', disabled: !backAllowed, 'aria-pressed': String(side === 'back'), onclick: () => { detail.side = 'back'; onChange() } }, '背面'),
      h('span', { className: 'ah-resource-note' }, '编号 ' + (card.code || detail.code || '未映射'))),
    h('div', { className: 'ah-detail-kicker' }, detail.runtime ? '调查档案 · ' + (TYPE_LABELS[card.type] || '卡牌') : '馆藏档案 · ' + (TYPE_LABELS[card.type] || '卡牌')),
    h('div', { className: 'ah-detail-layout' },
      renderImage(h, entry?.images || card.images, side, { artId: detail.def.artId }),
      h('div', null, renderTextCard(face),
        h('nav', {className:'ah-card-rule-links','aria-label':'相关规则'},
          [...new Set([...cardRuleIds(detail.def), ...matchingRules([face.text,face.textZh,face.slot,face.slots?.join(' '),face.keywords?.join?.(' ')].filter(Boolean).join(' ')).map(r=>r.id)])]
            .slice(0,10).map(id=>ruleLink(h,id)),
          ruleLink(h,'round','打开规则书')),
        detail.runtime && objective ? h('section', { className: 'ah-runtime-text' }, h('h3', null, '当前目标'), h('p', null, renderRulesText(h, objective))) : null,
        h('details', { className: 'ah-detail-meta' }, h('summary', {}, '卡牌资料与规则说明'),
          h('div', { className: 'ah-status-badges' }, labels.map(label => h('span', { className: 'ah-kw' }, label))),
          h('p', { className: 'ah-resource-note' }, detail.runtime ? '本局按已实现规则结算；卡面供查阅，查看背面不会推进剧情。' : '目录收录不等于可用卡池。'),
          notes.map(note => h('p', { className: 'ah-difference-note' }, note))))),
    detail.loading ? h('p', { className: 'ah-resource-note', role: 'status' }, '正在读取卡牌资料…') : null,
    detail.error ? h('p', { className: 'ah-difference-note', role: 'status' }, detail.error + '；保留已知文字，不影响对局。') : null,
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
      h('option', { value: '' }, '全部' + label),
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
        h('section', { className: 'bg-modal ah-catalog-modal', role: 'dialog', 'aria-modal': 'true', 'aria-label': '诡镇全卡图鉴', onclick: event => event.stopPropagation(), onkeydown: event => { if (event.key === 'Escape') close() } },
          h('header', { className: 'ah-catalog-head' }, h('div', null, h('h2', null, '诡镇全卡图鉴'), h('p', { className: 'ah-resource-note' }, '目录收录不等于可玩。构筑仍仅开放获准卡池；图鉴含剧情及背面信息。')), h('button', { className: 'bg-btn secondary', onclick: close, 'aria-label': '关闭图鉴' }, '关闭')),
          renderCardFilters(h,{scope:'catalog',filters:state.filters,count:result?.total||0,searchLabel:'卡号或名称',
            options:{...metadata,typeLabels:TYPE_LABELS},onChange:filters=>{state.filters=filters;state.offset=0;load()}}),
          h('div', { className: 'ah-catalog-filters' }, h('button',{className:'bg-btn',onclick:()=>{state.offset=0;load()}},'检索'),choose('effectStatus', '实现状态', metadata?.effectStatuses, EFFECT_LABELS), choose('availability', '可用性', metadata?.availabilityStatuses, AVAILABILITY_LABELS)),
          renderPresentationSettings(h, onChange),
          h('div', { className: 'ah-catalog-summary', role: 'status' }, state.loading ? '正在加载目录…' : state.error || ('找到 ' + (result?.total || 0) + ' 张 · 每页 ' + state.limit + ' 张')),
          state.error ? h('button', { className: 'bg-btn secondary', onclick: load }, '重新加载') : null,
          h('div', { className: 'ah-catalog-grid', 'aria-busy': String(state.loading) }, !state.error ? (result?.cards || []).map(card =>
            h('button', { className: 'ah-catalog-card', disabled:state.loading, onclick: () => openCard(card), 'aria-label': (card.nameZh || card.name) + ' ' + card.code,
              'data-zoom-code': card.code, 'data-zoom-name': card.nameZh || card.name },
              renderImage(h, card.images, 'front', { compact: true }),
              h('span', { className: 'ah-catalog-card-name' }, card.nameZh || card.name),
              h('span', { className: 'ah-catalog-card-meta' }, card.code + ' · ' + (TYPE_LABELS[card.type] || card.type)),
              h('span', { className: 'ah-catalog-card-meta' }, (EFFECT_LABELS[card.effectStatus] || card.effectStatus) + ' · ' + availabilityLabel(card)))) : null),
          !state.loading && !state.error && result?.total === 0 ? h('p', { className: 'bg-empty' }, '没有匹配的卡牌。请放宽筛选条件。') : null,
          h('footer', { className: 'ah-catalog-pagination' },
            h('button', { className: 'bg-btn secondary', disabled: state.loading || state.offset === 0, onclick: () => { state.offset = Math.max(0, state.offset - state.limit); load() } }, '上一页'),
            h('span', null, '第 ' + (Math.floor(state.offset / state.limit) + 1) + ' 页'),
            h('button', { className: 'bg-btn secondary', disabled: state.loading || !result || state.offset + state.limit >= result.total, onclick: () => { state.offset += state.limit; load() } }, '下一页'))))
    },
  }
}
