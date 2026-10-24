// 万象无终（TCU）交互面板 —— 第 4 步 P5。
//
// 把第 2 步的原语投影变成玩家点得到的界面：
//   · 塔罗抽牌（`pendingChoice.kind === 'pickTarot'`）——序章 / 巫异时刻的 22 张大阿卡纳选 1；
//   · 序章选人（`kind === 'storyInvestigator'`）——4 位无牌组故事调查员，未选者划掉；
//   · 闹鬼来源（`kind === 'haunted'`）——地点名与印刷能力原文，复数能力按玩家顺序结算；
//   · 战役面板——幽灵牌堆、塔罗牌组、裂口合计、看守人、遗留记忆；
//   · 地点标记——裂口计数、火盆点燃/熄灭、幽灵面；
//   · 多技能检定——阵法的 2–4 项技能合计；以及异端者的两面。
//
// 约定（路线图 §6「统一要求」）：
// - 面板只读会话（观察投影 + `pendingChoice` + `legalMoves`），不发明选项、不本地扣费；
// - 提交只发 `legalMoves` 里已有的 `choose`；没有对应动作的选项置灰并写明原因；
// - 不写死颜色与卡号，全部复用 `web/` 现有 token；窄屏单列，桌面/移动都不横向溢出；
// - 键盘可达：每个选项都是原生 button（Enter / Space 可直接触发），焦点顺序与阅读顺序一致。
//
// 界面文案走 web/i18n.js 的 t()：模块顶层只存 key，模型/渲染期再取当前语言；
// 卡名、地点名、能力原文、待决选择 prompt 等内容数据仍按服务端投影原样显示。

import { renderRulesText } from './card-text.js'
import { tableIcon } from './table-components.js'
// 序章选人要画真实卡面：卡图走现有 tableArt，按住 Alt 悬停即可放大看全卡（与牌桌/构筑一致）。
import { tableArt } from './table-art.js'
// 卡名/卡文统一走 catalog.js 的 cardDisplay*（docs/localization.md §8.7 第二步）。
import { cardDisplayName, currentLanguage } from './catalog.js'
import { t } from './i18n.js'

const SKILL_LABELS = Object.freeze({ willpower: 'situation.skill.willpower', intellect: 'situation.skill.intellect', combat: 'situation.skill.combat', agility: 'situation.skill.agility' })
const SKILL_ICONS = Object.freeze({ willpower: 'star', intellect: 'book', combat: 'sword', agility: 'leaf' })
const ROMAN = ['0', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII', 'XIII', 'XIV', 'XV', 'XVI', 'XVII', 'XVIII', 'XIX', 'XX', 'XXI']

const skillLabel = id => SKILL_LABELS[id] ? t(SKILL_LABELS[id]) : id
const skillList = skill => Array.isArray(skill) ? skill : skill ? [skill] : []
export const romanNumeral = arcana => ROMAN[Number(arcana)] || String(arcana)

// 当前会话里属于这条待决选择的合法动作，按 optionId 建索引。
function movesByOption(state, choiceId) {
  const map = new Map()
  for (const move of state?.legalMoves || []) {
    if (move.action === 'choose' && move.choiceId === choiceId) map.set(String(move.optionId), move)
  }
  return map
}

function scenarioLocations(state) {
  return Array.isArray(state?.locations) ? state.locations : []
}

// ---------------------------------------------------------------- 模型

// 塔罗抽牌：牌库里抽 N 张选 1。候选牌来自服务端选项，正逆位与名字都已经带下来。
export function tarotPickerModel(session) {
  const st = session?.state
  const choice = st?.pendingChoice
  if (!choice || choice.kind !== 'pickTarot') return null
  const moves = movesByOption(st, choice.id)
  const tarot = st.tarot || { deck: 0, drawn: [], discarded: [] }
  const orientationLabel = orientation => orientation === 'reverse' ? t('tcu.orientation.reverse') : t('tcu.orientation.upright')
  const candidates = (choice.options || []).map(option => ({
    optionId: String(option.id),
    arcana: option.arcana ?? Number(option.id),
    orientation: option.orientation === 'reverse' ? 'reverse' : 'upright',
    orientationLabel: orientationLabel(option.orientation),
    roman: romanNumeral(option.arcana ?? option.id),
    nameZh: option.nameZh || option.label || t('tcu.arcana.fallback', { id: option.id }),
    nameEn: option.nameEn || null,
    move: moves.get(String(option.id)) || null,
  }))
  const candidateArcanas = new Set(candidates.map(item => item.arcana))
  return {
    kind: 'pickTarot',
    choice,
    seat: choice.seat,
    investigator: (st.investigators || []).find(inv => inv.seat === choice.seat) || null,
    prompt: choice.prompt || t('tcu.tarot.prompt'),
    remaining: Number(tarot.deck ?? 0),
    discarded: Number((tarot.discarded || []).length),
    // 「已抽出」只列这次选择之前的牌：候选牌本身已经在下面的网格里，不重复陈列。
    drawn: (tarot.drawn || []).filter(entry => !candidateArcanas.has(entry.arcana)).map(entry => ({
      ...entry,
      orientationLabel: orientationLabel(entry.orientation),
      roman: romanNumeral(entry.arcana),
    })),
    candidates,
    selectable: candidates.filter(item => item.move).length,
    skipMove: moves.get('skip') || null,
  }
}

// 序章选人：每座位各选一次，未选者划掉；选项自带职业、属性、生命/理智。
export function storyInvestigatorPickerModel(session) {
  const st = session?.state
  const choice = st?.pendingChoice
  if (!choice || choice.kind !== 'storyInvestigator') return null
  const moves = movesByOption(st, choice.id)
  const picked = st.storyInvestigators?.chosen || []
  const candidates = (choice.options || []).map(option => ({
    optionId: String(option.id),
    // 选项 id 就是故事调查员的卡号（05046–05049）；优先用 cardCode，界面据此画卡面与开关联档案。
    code: String(option.cardCode || option.id),
    name: option.name || option.label || String(option.id),
    subtitle: option.subtitle || null,
    klass: option.klass || null,
    classLabel: option.classLabel || null,
    stats: option.stats || null,
    health: option.health ?? null,
    sanity: option.sanity ?? null,
    move: moves.get(String(option.id)) || null,
  }))
  return {
    kind: 'storyInvestigator',
    choice,
    seat: choice.seat,
    investigator: (st.investigators || []).find(inv => inv.seat === choice.seat) || null,
    prompt: choice.prompt || t('tcu.story.prompt'),
    seatCount: choice.source?.seatCount ?? null,
    remainingCount: (choice.options || []).length,
    candidates,
    alreadyChosen: picked.map(entry => ({ seat: entry.seat, code: entry.code, name: entry.name })),
    collapsed: st.storyInvestigators?.crossedOut || [],
    selectable: candidates.filter(item => item.move).length,
    skipMove: moves.get('skip') || null,
  }
}

// 闹鬼结算：地点 + 印刷能力；选项是「下一条结算哪条能力」或「这条能力二选一」。
export function hauntedChoiceModel(session) {
  const st = session?.state
  const choice = st?.pendingChoice
  if (!choice || choice.kind !== 'haunted') return null
  const locationId = choice.source?.locationId || null
  const location = scenarioLocations(st).find(item => item.id === locationId) || null
  const moves = movesByOption(st, choice.id)
  return {
    kind: 'haunted',
    choice,
    seat: choice.seat,
    location,
    locationName: location?.name || t('tcu.haunted.locationFallback'),
    abilityText: choice.source?.text || null,
    order: choice.source?.order === true,
    times: Number(choice.source?.times || 1),
    prompt: choice.prompt || t('tcu.haunted.prompt'),
    options: (choice.options || []).map((option, index) => ({
      optionId: String(option.id),
      order: index + 1,
      text: option.text || option.label || String(option.id),
      label: option.label || option.text || String(option.id),
      abilityIndex: option.abilityIndex ?? null,
      move: moves.get(String(option.id)) || null,
    })),
    selectable: (choice.options || []).filter(option => moves.has(String(option.id))).length,
    skipMove: moves.get('skip') || null,
  }
}

// 牌桌 / 档案页的万象无终公开状态。字段缺失就整块不出现，旧战役不受影响。
export function tcuCampaignModel(state) {
  if (!state) return null
  const spectral = state.spectral || null
  const tarot = state.tarot || null
  const watcher = state.watcher || null
  const mementos = Array.isArray(state.mementos) ? state.mementos : []
  const labels = state.campaign?.mementoLabels || {}
  const locations = state.locationStates || {}
  const breaches = Object.values(locations).reduce((sum, entry) => sum + Number(entry?.breaches || 0), 0)
  const braziers = Object.entries(locations)
    .filter(([, entry]) => entry?.flags?.brazier != null)
    .map(([id, entry]) => ({
      id, lit: entry.flags.brazier === true,
      name: (state.locations || []).find(location => location.id === id)?.name || id,
    }))
  const nameOfCode = code => cardDisplayName(state.cards?.[code]) || cardDisplayName(state.investigatorDefs?.[code])
    || (state.investigators || []).find(inv => inv.code === code)?.name || code
  const taken = (watcher?.taken || []).map(code => nameOfCode(code))
  const hunted = (watcher?.huntedSeats || []).map(seat => (state.investigators || []).find(inv => inv.seat === seat)?.name || t('situation.seat', { number: Number(seat) + 1 }))
  const story = state.storyInvestigators || null
  const hasAny = spectral || tarot || watcher || mementos.length || breaches || braziers.length || story
  if (!hasAny) return null
  return {
    spectral: spectral ? { deck: Number(spectral.deck ?? 0), discard: Number((spectral.discard || []).length) } : null,
    tarot: tarot ? { deck: Number(tarot.deck ?? 0), drawn: tarot.drawn || [], discarded: Number((tarot.discarded || []).length) } : null,
    breaches,
    breachLocations: Object.entries(locations).filter(([, entry]) => Number(entry?.breaches || 0) > 0).length,
    braziers,
    watcher: watcher ? { hunted, taken } : null,
    mementos: mementos.map(id => ({ id, label: labels[id] || id })),
    storyInvestigators: story ? { chosen: story.chosen || [], crossedOut: story.crossedOut || [] } : null,
  }
}

// 地点标记：裂口计数、火盆状态、幽灵面。返回数据，由牌桌用自己的徽标组件渲染。
export function locationTcuBadges(state, locationId) {
  const entry = state?.locationStates?.[locationId] || null
  const location = scenarioLocations(state).find(item => item.id === locationId) || null
  const badges = []
  const breaches = Number(entry?.breaches || 0)
  if (breaches > 0) badges.push({ kind: 'breach', label: t('tcu.badge.breach'), value: breaches, title: t('tcu.badge.breachTitle', { count: breaches }) })
  if (entry?.flags?.brazier != null) {
    badges.push({
      kind: 'brazier', label: entry.flags.brazier ? t('tcu.badge.brazierLit') : t('tcu.badge.brazierOut'),
      value: null, title: entry.flags.brazier ? t('tcu.badge.brazierLitTitle') : t('tcu.badge.brazierOutTitle'),
    })
  }
  if (location?.spectral === true) badges.push({ kind: 'spectral', label: t('tcu.badge.spectral'), value: null, title: t('tcu.badge.spectralTitle') })
  return badges
}

// 异端者：当前面与「不能以任何方式被击败」。翻面/放逐的具体动作仍来自 legalMoves。
export function enemyFaceBadge(enemy) {
  if (!enemy) return null
  const faces = Array.isArray(enemy.faces) ? enemy.faces : null
  const side = enemy.side || null
  if (!faces && !side && !enemy.cannotBeDefeated) return null
  const unfinished = side === 'unfinishedBusiness'
  return {
    label: unfinished ? t('tcu.enemy.unfinishedFace') : side === 'enemy' ? t('tcu.enemy.enemyFace') : null,
    sides: faces ? faces.length : null,
    cannotBeDefeated: enemy.cannotBeDefeated === true,
    title: [unfinished ? t('tcu.enemy.unfinishedTitle') : t('tcu.enemy.enemyTitle'),
      faces ? t('tcu.enemy.faces', { count: faces.length }) : null,
      enemy.cannotBeDefeated ? t('tcu.enemy.cannotBeDefeated') : null].filter(Boolean).join(' · '),
  }
}

// 阵法：把 `skillTest.skill`（单技能字符串或 2–4 项数组）统一成展示模型。
export function multiSkillTestInfo(state) {
  const test = state?.skillTest
  if (!test) return null
  const skills = skillList(test.skill)
  if (!skills.length) return null
  const value = test.value ?? test.baseValue ?? null
  const base = test.printedValue ?? test.baseValue ?? value
  const delta = Number.isFinite(value) && Number.isFinite(base) ? value - base : 0
  return {
    skills: skills.map(id => ({ id, label: skillLabel(id), icon: SKILL_ICONS[id] || 'star' })),
    label: skills.map(skillLabel).join('+'),
    multi: skills.length > 1,
    base, value, delta, difficulty: test.difficulty ?? null,
    actionKind: test.actionKind || null,
    committed: (test.committed || []).length,
  }
}

// ---------------------------------------------------------------- 渲染

const moveButton = (h, { optionId, disabled, busy, title, label, onclick, extra = '' }) => h('button', {
  type: 'button', className: 'ah-tcu-option' + extra,
  'data-option-id': optionId, title, 'aria-label': title,
  disabled: !!busy || !!disabled,
  onclick,
}, label)

// 可跳过的选择才给取消按钮（`canSkip` + `legalMoves` 里的 skip）：面板不发明「取消」。
const skipButton = (h, model, { onSubmit, disabled, busy, label = null }) => {
  if (!model.choice?.canSkip || !model.skipMove) return null
  const text = label ?? t('tcu.skip')
  return h('div', { className: 'ah-tcu-actions' }, h('button', {
    type: 'button', className: 'ah-tcu-option is-secondary', 'data-option-id': 'skip',
    disabled: !!busy || !!disabled, title: text,
    onclick: () => { if (!disabled && !busy) onSubmit(model.skipMove) },
  }, text))
}

// 塔罗抽牌面板：候选牌一格一张（宽屏自适应、窄屏两列），正位/逆位与编号都写清楚。
export function renderTarotPicker(h, model, { onSubmit = () => {}, disabled = false, busy = false } = {}) {
  if (!model) return null
  const name = model.investigator?.name || t('tcu.investigator.fallback')
  const interactive = !disabled
  return h('section', {
    className: 'ah-choice ah-tcu-panel ah-tarot-picker', role: 'region', 'aria-label': t('tcu.tarot.pickerAria'),
    'data-choice-id': model.choice.id, 'data-choice-kind': 'pickTarot', 'data-choice-seat': model.seat,
    'aria-busy': String(!!busy),
  },
    h('header', { className: 'ah-tcu-head' },
      h('div', {},
        h('small', { className: 'ah-office-eyebrow' }, t('tcu.tarot.eyebrow')),
        h('h2', {}, t('tcu.tarot.title')),
        h('p', { className: 'ah-tcu-lead' }, tableIcon('tarot'), h('span', {}, renderRulesText(h, model.prompt, { links: false })))),
      h('div', { className: 'ah-tcu-purse', role: 'status', 'aria-label': t('tcu.tarot.remainingAria', { count: model.remaining }) },
        h('span', {}, t('tcu.tarot.remaining')), h('b', {}, String(model.remaining)))),
    h('p', { className: 'ah-tcu-note', role: 'status' },
      t('tcu.tarot.note', { name })),
    h('ul', { className: 'ah-tarot-grid', 'aria-label': t('tcu.tarot.gridAria') },
      model.candidates.map(candidate => h('li', {}, moveButton(h, {
        optionId: candidate.optionId,
        disabled: !interactive || !candidate.move,
        busy,
        label: h('span', { className: 'ah-tarot-face' + (candidate.orientation === 'reverse' ? ' is-reverse' : '') },
          h('span', { className: 'ah-tarot-sigil', 'aria-hidden': 'true' }, candidate.roman),
          h('strong', {}, cardDisplayName(candidate)),
          h('small', {}, `${candidate.roman} · ${candidate.orientationLabel}`),
          currentLanguage() === 'en' ? null : (candidate.nameEn ? h('em', {}, candidate.nameEn) : null),
        ),
        title: candidate.move
          ? t('tcu.tarot.optionTitle', { name: cardDisplayName(candidate), orientation: candidate.orientationLabel })
          : t('tcu.tarot.optionUnavailable', { name: cardDisplayName(candidate) }),
        onclick: () => candidate.move && onSubmit(candidate.move),
      })))),
    model.drawn.length
      ? h('div', { className: 'ah-tarot-history', role: 'group', 'aria-label': t('tcu.tarot.historyAria') },
        h('small', {}, t('tcu.tarot.drawn')),
        ...model.drawn.map(entry => h('span', { className: 'ah-tarot-chip' },
          t('tcu.tarot.chip', { name: cardDisplayName(entry) || t('tcu.arcana.fallback', { id: entry.arcana }), orientation: entry.orientationLabel }))))
      : null,
    skipButton(h, model, { onSubmit, disabled, busy }))
}

// 序章选人：一张卡 = 一位故事调查员。
// 卡面图与「详情」按钮缺一不可——故事调查员都不进构筑、没有牌组，玩家只能靠卡面
// 判断职业/属性/能力；卡面图沿用 tableArt，按住 Alt 悬停即与原版卡一样放大，
// 「详情」调用宿主注入的 inspectCard 打开完整人物档案（卡面＋卡背设置）。
export function renderStoryInvestigatorPicker(h, model, { onSubmit = () => {}, disabled = false, busy = false, inspectCard = null } = {}) {
  if (!model) return null
  const name = model.investigator?.name || t('tcu.investigator.fallback')
  const interactive = !disabled
  const canInspect = typeof inspectCard === 'function'
  const skillRow = stats => ['willpower', 'intellect', 'combat', 'agility'].map(skill =>
    h('span', { key: skill, className: 'ah-story-stat', 'data-skill': skill },
      tableIcon(SKILL_ICONS[skill]), String(stats[skill] ?? '—')))
  const candidateCard = candidate => {
    // busy 时同样置灰：与塔罗/闹鬼面板一致，避免提交中重复点选。
    const unavailable = !interactive || !candidate.move || busy
    const classLabel = candidate.classLabel || t('card.type.investigator')
    const vitals = [candidate.health != null ? t('tcu.story.vitalsHealth', { health: candidate.health }) : null,
      candidate.sanity != null ? t('tcu.story.vitalsSanity', { sanity: candidate.sanity }) : null].filter(Boolean).join(t('tcu.vitalsSeparator'))
    // 读屏用户听不到卡面上的四维/生命理智，把可见数值并入可访问名；数值缺失时只报名字。
    const actionLabel = candidate.move
      ? (vitals
        ? t('tcu.story.optionAriaVitals', { name: candidate.name, class: classLabel, vitals })
        : t('tcu.story.optionAria', { name: candidate.name, class: classLabel }))
      : t('tcu.story.optionUnavailableAria', { name: candidate.name })
    return h('li', { className: 'ah-story-cell', 'data-story-code': candidate.code },
      h('button', {
        type: 'button',
        className: 'ah-tcu-option ah-story-choice' + (unavailable ? ' is-unavailable' : ''),
        'data-option-id': candidate.optionId,
        disabled: unavailable,
        title: candidate.move
          ? t('tcu.story.optionTitle', { name: candidate.name })
          : t('tcu.story.optionUnavailableTitle', { name: candidate.name }),
        'aria-label': actionLabel,
        onclick: () => candidate.move && onSubmit(candidate.move),
      },
        h('span', { className: 'ah-story-art' }, tableArt(h, candidate.code, candidate.name, { landscape: true })),
        h('span', { className: 'ah-story-face' },
          h('span', { className: 'ah-story-class' }, classLabel),
          h('strong', {}, candidate.name),
          candidate.subtitle ? h('small', {}, candidate.subtitle) : null,
          // 属性/生命理智来自观察投影；旧存档或旧会话缺这些字段时不伪造数值。
          candidate.stats ? h('span', { className: 'ah-story-stats' }, skillRow(candidate.stats)) : null,
          candidate.health != null || candidate.sanity != null
            ? h('span', { className: 'ah-story-vitals' }, t('tcu.story.vitalsShort', { health: candidate.health ?? '—', sanity: candidate.sanity ?? '—' }))
            : null)),
      canInspect
        ? h('button', {
          type: 'button', className: 'ah-story-detail', 'data-story-detail': candidate.code,
          'aria-label': t('tcu.story.inspectAria', { name: candidate.name }),
          title: t('tcu.story.inspectAria', { name: candidate.name }),
          onclick: () => inspectCard(candidate.code),
        }, tableIcon('book'), h('span', {}, t('tcu.story.inspect')))
        : null)
  }
  return h('section', {
    className: 'ah-choice ah-tcu-panel ah-story-picker', role: 'region', 'aria-label': t('tcu.story.pickerAria'),
    'data-choice-id': model.choice.id, 'data-choice-kind': 'storyInvestigator', 'data-choice-seat': model.seat,
    'aria-busy': String(!!busy),
  },
    h('header', { className: 'ah-tcu-head' },
      h('div', {},
        h('small', { className: 'ah-office-eyebrow' }, t('tcu.story.eyebrow')),
        h('h2', {}, t('tcu.story.title')),
        h('p', { className: 'ah-tcu-lead' }, tableIcon('ally'), h('span', {}, renderRulesText(h, model.prompt, { links: false })))),
      h('div', { className: 'ah-tcu-purse', role: 'status', 'aria-label': t('tcu.story.remainingAria', { count: model.remainingCount }) },
        h('span', {}, t('tcu.story.remaining')), h('b', {}, String(model.remainingCount)))),
    h('p', { className: 'ah-tcu-note', role: 'status' },
      t('tcu.story.note', { name })),
    model.candidates.length ? h('p', { className: 'ah-tcu-note is-muted' },
      canInspect
        ? t('tcu.story.hintInspect')
        : t('tcu.story.hint')) : null,
    h('ul', { className: 'ah-story-grid', 'aria-label': t('tcu.story.gridAria') },
      model.candidates.map(candidateCard)),
    model.alreadyChosen.length
      ? h('p', { className: 'ah-tcu-note' }, t('tcu.story.chosen', {
        list: model.alreadyChosen.map(entry => `${t('situation.seat', { number: entry.seat + 1 })} ${entry.name}`).join(t('tcu.listSeparator')),
      }))
      : null,
    model.collapsed.length ? h('p', { className: 'ah-tcu-note is-muted' }, t('tcu.story.crossedOut', { count: model.collapsed.length })) : null,
    skipButton(h, model, { onSubmit, disabled, busy }))
}

// 闹鬼：先说明「哪条能力、在哪个地点」，再给出可结算的条目。
export function renderHauntedChoice(h, model, { onSubmit = () => {}, disabled = false, busy = false } = {}) {
  if (!model) return null
  const interactive = !disabled
  return h('section', {
    className: 'ah-choice ah-tcu-panel ah-haunted-panel', role: 'region', 'aria-label': t('tcu.haunted.panelAria'),
    'data-choice-id': model.choice.id, 'data-choice-kind': 'haunted', 'data-choice-seat': model.seat,
    'data-haunted-location': model.location?.id || null,
    'aria-busy': String(!!busy),
  },
    h('header', { className: 'ah-tcu-head' },
      h('div', {},
        h('small', { className: 'ah-office-eyebrow' }, t('tcu.haunted.eyebrow')),
        h('h2', {}, model.locationName),
        h('p', { className: 'ah-tcu-lead' }, tableIcon('eye'), h('span', {}, renderRulesText(h, model.prompt, { links: false })))),
      h('div', { className: 'ah-tcu-purse', role: 'status', 'aria-label': t('tcu.haunted.waitingAria', { count: model.options.length }) },
        h('span', {}, t('tcu.haunted.waiting')), h('b', {}, String(model.options.length)))),
    model.abilityText ? h('blockquote', { className: 'ah-haunted-source' }, model.abilityText) : null,
    model.times > 1 ? h('p', { className: 'ah-tcu-note' }, t('tcu.haunted.times', { count: model.times })) : null,
    h('ol', { className: 'ah-haunted-list', 'aria-label': t('tcu.haunted.listAria') },
      model.options.map(item => h('li', {}, moveButton(h, {
        optionId: item.optionId,
        disabled: !interactive || !item.move,
        busy,
        label: h('span', { className: 'ah-haunted-row' },
          h('span', { className: 'ah-haunted-index', 'aria-hidden': 'true' }, String(item.order)),
          h('span', { className: 'ah-haunted-text' }, renderRulesText(h, item.text, { links: false }))),
        title: item.move ? t('tcu.haunted.optionTitle', { text: item.text }) : t('tcu.haunted.optionUnavailable'),
        onclick: () => item.move && onSubmit(item.move),
      })))),
    h('p', { className: 'ah-tcu-note is-muted' }, t('tcu.haunted.note')),
    skipButton(h, model, { onSubmit, disabled, busy }))
}

// 牌桌战役面板：幽灵牌堆、塔罗牌组、裂口、火盆、看守人、遗留记忆。
export function renderTcuCampaignPanel(h, model) {
  if (!model) return null
  const rows = []
  if (model.spectral) rows.push([t('tcu.campaign.spectral'), t('tcu.campaign.spectralValue', { deck: model.spectral.deck, discard: model.spectral.discard }), 'eye'])
  if (model.tarot) rows.push([t('tcu.campaign.tarot'), t('tcu.campaign.tarotValue', { deck: model.tarot.deck, drawn: model.tarot.drawn.length }), 'tarot'])
  if (model.breaches) rows.push([t('tcu.campaign.breaches'), t('tcu.campaign.breachesValue', { count: model.breaches, locations: model.breachLocations }), 'doom'])
  if (model.braziers.length) {
    const lit = model.braziers.filter(item => item.lit).length
    rows.push([t('tcu.campaign.braziers'), t('tcu.campaign.braziersValue', { lit, out: model.braziers.length - lit }), 'star'])
  }
  if (model.storyInvestigators) rows.push([t('tcu.campaign.storyInvestigators'),
    model.storyInvestigators.chosen.map(entry => entry.name).join(t('tcu.listSeparator')) || t('tcu.campaign.notSelected'), 'ally'])
  const hunted = model.watcher
    ? (model.watcher.hunted.length ? t('tcu.campaign.hunted', { names: model.watcher.hunted.join(t('tcu.listSeparator')) }) : t('tcu.campaign.nobody'))
      + (model.watcher.taken.length ? t('tcu.campaign.taken', { names: model.watcher.taken.join(t('tcu.listSeparator')) }) : '')
    : null
  return h('div', { className: 'ah-campaign-tcu', role: 'group', 'aria-label': t('tcu.campaign.aria') },
    h('h4', {}, tableIcon('tarot'), t('tcu.campaign.title')),
    rows.length
      ? h('ul', {}, rows.map(([label, value, icon]) => h('li', {},
        h('span', {}, tableIcon(icon), label), h('strong', {}, value))))
      : null,
    model.watcher
      ? h('p', { className: 'ah-tcu-watcher' },
        tableIcon('eye'),
        t('tcu.campaign.watcher', { detail: hunted }))
      : null,
    model.mementos.length
      ? h('div', { className: 'ah-tcu-mementos', role: 'group', 'aria-label': t('tcu.campaign.mementosAria') },
        h('small', {}, t('tcu.campaign.mementos', { count: model.mementos.length })),
        h('ul', {}, model.mementos.map(item => h('li', { 'data-memento': item.id }, item.label))))
      : null)
}
