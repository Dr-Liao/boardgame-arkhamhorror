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

import { renderRulesText } from './card-text.js'
import { tableIcon } from './table-components.js'
// 序章选人要画真实卡面：卡图走现有 tableArt，按住 Alt 悬停即可放大看全卡（与牌桌/构筑一致）。
import { tableArt } from './table-art.js'
// 卡名/卡文统一走 catalog.js 的 cardDisplay*（docs/localization.md §8.7 第二步）。
import { cardDisplayName, currentLanguage } from './catalog.js'

const SKILL_LABELS = Object.freeze({ willpower: '意志', intellect: '智识', combat: '战斗', agility: '敏捷' })
const SKILL_ICONS = Object.freeze({ willpower: 'star', intellect: 'book', combat: 'sword', agility: 'leaf' })
const ROMAN = ['0', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII', 'XIII', 'XIV', 'XV', 'XVI', 'XVII', 'XVIII', 'XIX', 'XX', 'XXI']

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
  const candidates = (choice.options || []).map(option => ({
    optionId: String(option.id),
    arcana: option.arcana ?? Number(option.id),
    orientation: option.orientation === 'reverse' ? 'reverse' : 'upright',
    orientationLabel: option.orientation === 'reverse' ? '逆位' : '正位',
    roman: romanNumeral(option.arcana ?? option.id),
    nameZh: option.nameZh || option.label || `大阿卡纳 ${option.id}`,
    nameEn: option.nameEn || null,
    move: moves.get(String(option.id)) || null,
  }))
  const candidateArcanas = new Set(candidates.map(item => item.arcana))
  return {
    kind: 'pickTarot',
    choice,
    seat: choice.seat,
    investigator: (st.investigators || []).find(inv => inv.seat === choice.seat) || null,
    prompt: choice.prompt || '选择一张要结算的塔罗牌。',
    remaining: Number(tarot.deck ?? 0),
    discarded: Number((tarot.discarded || []).length),
    // 「已抽出」只列这次选择之前的牌：候选牌本身已经在下面的网格里，不重复陈列。
    drawn: (tarot.drawn || []).filter(entry => !candidateArcanas.has(entry.arcana)).map(entry => ({
      ...entry,
      orientationLabel: entry.orientation === 'reverse' ? '逆位' : '正位',
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
    prompt: choice.prompt || '选择你本次冒险使用的故事调查员。',
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
    locationName: location?.name || '你所在地点',
    abilityText: choice.source?.text || null,
    order: choice.source?.order === true,
    times: Number(choice.source?.times || 1),
    prompt: choice.prompt || '选择下一条要结算的闹鬼能力。',
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
  const hunted = (watcher?.huntedSeats || []).map(seat => (state.investigators || []).find(inv => inv.seat === seat)?.name || `座位 ${Number(seat) + 1}`)
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
  if (breaches > 0) badges.push({ kind: 'breach', label: '裂口', value: breaches, title: `此地点有 ${breaches} 个裂口（骷髅标记读取裂口 + 毁灭）` })
  if (entry?.flags?.brazier != null) {
    badges.push({
      kind: 'brazier', label: entry.flags.brazier ? '火盆点燃' : '火盆熄灭',
      value: null, title: entry.flags.brazier ? '此地点火盆已点燃' : '此地点火盆已熄灭',
    })
  }
  if (location?.spectral === true) badges.push({ kind: 'spectral', label: '幽灵地点', value: null, title: '此地点有幽灵面' })
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
    label: unfinished ? '未了之事面' : side === 'enemy' ? '敌人面' : null,
    sides: faces ? faces.length : null,
    cannotBeDefeated: enemy.cannotBeDefeated === true,
    title: [unfinished ? '当前为未了之事面' : '当前为敌人面',
      faces ? `共 ${faces.length} 面` : null,
      enemy.cannotBeDefeated ? '不能以任何方式被击败（只能用放逐离场）' : null].filter(Boolean).join(' · '),
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
    skills: skills.map(id => ({ id, label: SKILL_LABELS[id] || id, icon: SKILL_ICONS[id] || 'star' })),
    label: skills.map(id => SKILL_LABELS[id] || id).join('+'),
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
const skipButton = (h, model, { onSubmit, disabled, busy, label = '跳过本次选择' }) => {
  if (!model.choice?.canSkip || !model.skipMove) return null
  return h('div', { className: 'ah-tcu-actions' }, h('button', {
    type: 'button', className: 'ah-tcu-option is-secondary', 'data-option-id': 'skip',
    disabled: !!busy || !!disabled, title: label,
    onclick: () => { if (!disabled && !busy) onSubmit(model.skipMove) },
  }, label))
}

// 塔罗抽牌面板：候选牌一格一张（宽屏自适应、窄屏两列），正位/逆位与编号都写清楚。
export function renderTarotPicker(h, model, { onSubmit = () => {}, disabled = false, busy = false } = {}) {
  if (!model) return null
  const name = model.investigator?.name || '该调查员'
  const interactive = !disabled
  return h('section', {
    className: 'ah-choice ah-tcu-panel ah-tarot-picker', role: 'region', 'aria-label': '塔罗抽牌',
    'data-choice-id': model.choice.id, 'data-choice-kind': 'pickTarot', 'data-choice-seat': model.seat,
    'aria-busy': String(!!busy),
  },
    h('header', { className: 'ah-tcu-head' },
      h('div', {},
        h('small', { className: 'ah-office-eyebrow' }, '塔罗牌组 · 大阿卡纳'),
        h('h2', {}, '选择一张塔罗牌'),
        h('p', { className: 'ah-tcu-lead' }, tableIcon('tarot'), h('span', {}, renderRulesText(h, model.prompt, { links: false })))),
      h('div', { className: 'ah-tcu-purse', role: 'status', 'aria-label': `牌库剩余 ${model.remaining} 张` },
        h('span', {}, '牌库剩余'), h('b', {}, String(model.remaining)))),
    h('p', { className: 'ah-tcu-note', role: 'status' },
      `为${name}结算：选出要结算的那一张，其余牌会放回牌库底。`),
    h('ul', { className: 'ah-tarot-grid', 'aria-label': '候选塔罗牌' },
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
          ? `结算「${cardDisplayName(candidate)}」（${candidate.orientationLabel}）`
          : `「${cardDisplayName(candidate)}」当前不可选（服务端未提供该选项的动作）`,
        onclick: () => candidate.move && onSubmit(candidate.move),
      })))),
    model.drawn.length
      ? h('div', { className: 'ah-tarot-history', role: 'group', 'aria-label': '已抽出的塔罗牌' },
        h('small', {}, '已抽出'),
        ...model.drawn.map(entry => h('span', { className: 'ah-tarot-chip' },
          `${cardDisplayName(entry) || `大阿卡纳 ${entry.arcana}`}·${entry.orientationLabel}`)))
      : null,
    skipButton(h, model, { onSubmit, disabled, busy }))
}

// 序章选人：一张卡 = 一位故事调查员。
// 卡面图与「详情」按钮缺一不可——故事调查员都不进构筑、没有牌组，玩家只能靠卡面
// 判断职业/属性/能力；卡面图沿用 tableArt，按住 Alt 悬停即与原版卡一样放大，
// 「详情」调用宿主注入的 inspectCard 打开完整人物档案（卡面＋卡背设置）。
export function renderStoryInvestigatorPicker(h, model, { onSubmit = () => {}, disabled = false, busy = false, inspectCard = null } = {}) {
  if (!model) return null
  const name = model.investigator?.name || '该调查员'
  const interactive = !disabled
  const canInspect = typeof inspectCard === 'function'
  const skillRow = stats => ['willpower', 'intellect', 'combat', 'agility'].map(skill =>
    h('span', { key: skill, className: 'ah-story-stat', 'data-skill': skill },
      tableIcon(SKILL_ICONS[skill]), String(stats[skill] ?? '—')))
  const candidateCard = candidate => {
    // busy 时同样置灰：与塔罗/闹鬼面板一致，避免提交中重复点选。
    const unavailable = !interactive || !candidate.move || busy
    const classLabel = candidate.classLabel || '调查员'
    const vitals = [candidate.health != null ? `生命 ${candidate.health}` : null,
      candidate.sanity != null ? `理智 ${candidate.sanity}` : null].filter(Boolean).join('，')
    // 读屏用户听不到卡面上的四维/生命理智，把可见数值并入可访问名；数值缺失时只报名字。
    const actionLabel = candidate.move
      ? `选择 ${candidate.name}（${classLabel}${vitals ? '，' + vitals : ''}）`
      : `${candidate.name} 当前不可选`
    return h('li', { className: 'ah-story-cell', 'data-story-code': candidate.code },
      h('button', {
        type: 'button',
        className: 'ah-tcu-option ah-story-choice' + (unavailable ? ' is-unavailable' : ''),
        'data-option-id': candidate.optionId,
        disabled: unavailable,
        title: candidate.move
          ? `选择 ${candidate.name} 作为你的故事调查员（按住 Alt 悬停卡面可放大）`
          : `${candidate.name} 当前不可选（服务端未提供对应的选择动作）`,
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
            ? h('span', { className: 'ah-story-vitals' }, `生命 ${candidate.health ?? '—'} · 理智 ${candidate.sanity ?? '—'}`)
            : null)),
      canInspect
        ? h('button', {
          type: 'button', className: 'ah-story-detail', 'data-story-detail': candidate.code,
          'aria-label': `查看 ${candidate.name} 的完整人物档案`,
          title: `查看 ${candidate.name} 的完整人物档案`,
          onclick: () => inspectCard(candidate.code),
        }, tableIcon('book'), h('span', {}, '详情'))
        : null)
  }
  return h('section', {
    className: 'ah-choice ah-tcu-panel ah-story-picker', role: 'region', 'aria-label': '选择故事调查员',
    'data-choice-id': model.choice.id, 'data-choice-kind': 'storyInvestigator', 'data-choice-seat': model.seat,
    'aria-busy': String(!!busy),
  },
    h('header', { className: 'ah-tcu-head' },
      h('div', {},
        h('small', { className: 'ah-office-eyebrow' }, '序章 · 暮色庄园失踪事件'),
        h('h2', {}, '选择故事调查员'),
        h('p', { className: 'ah-tcu-lead' }, tableIcon('ally'), h('span', {}, renderRulesText(h, model.prompt, { links: false })))),
      h('div', { className: 'ah-tcu-purse', role: 'status', 'aria-label': `剩余 ${model.remainingCount} 位候选` },
        h('span', {}, '剩余候选'), h('b', {}, String(model.remainingCount)))),
    h('p', { className: 'ah-tcu-note', role: 'status' },
      `${name}：故事调查员没有牌组，不能抽牌或换起始手牌；没被选中的会在序章里被划掉。`),
    model.candidates.length ? h('p', { className: 'ah-tcu-note is-muted' },
      canInspect
        ? '点卡牌选择；按住 Alt 悬停卡面可放大查看卡牌与规则文字，点「详情」查看完整人物档案。'
        : '点卡牌选择；按住 Alt 悬停卡面可放大查看卡牌与规则文字。') : null,
    h('ul', { className: 'ah-story-grid', 'aria-label': '可选的故事调查员' },
      model.candidates.map(candidateCard)),
    model.alreadyChosen.length
      ? h('p', { className: 'ah-tcu-note' }, `已选：${model.alreadyChosen.map(entry => `座位 ${entry.seat + 1} ${entry.name}`).join('、')}`)
      : null,
    model.collapsed.length ? h('p', { className: 'ah-tcu-note is-muted' }, `将被划掉：${model.collapsed.length} 位`) : null,
    skipButton(h, model, { onSubmit, disabled, busy }))
}

// 闹鬼：先说明「哪条能力、在哪个地点」，再给出可结算的条目。
export function renderHauntedChoice(h, model, { onSubmit = () => {}, disabled = false, busy = false } = {}) {
  if (!model) return null
  const interactive = !disabled
  return h('section', {
    className: 'ah-choice ah-tcu-panel ah-haunted-panel', role: 'region', 'aria-label': '结算闹鬼能力',
    'data-choice-id': model.choice.id, 'data-choice-kind': 'haunted', 'data-choice-seat': model.seat,
    'data-haunted-location': model.location?.id || null,
    'aria-busy': String(!!busy),
  },
    h('header', { className: 'ah-tcu-head' },
      h('div', {},
        h('small', { className: 'ah-office-eyebrow' }, '闹鬼 · Haunted'),
        h('h2', {}, model.locationName),
        h('p', { className: 'ah-tcu-lead' }, tableIcon('eye'), h('span', {}, renderRulesText(h, model.prompt, { links: false })))),
      h('div', { className: 'ah-tcu-purse', role: 'status', 'aria-label': `待结算 ${model.options.length} 条能力` },
        h('span', {}, '待结算'), h('b', {}, String(model.options.length)))),
    model.abilityText ? h('blockquote', { className: 'ah-haunted-source' }, model.abilityText) : null,
    model.times > 1 ? h('p', { className: 'ah-tcu-note' }, `本地点要结算 ${model.times} 次闹鬼能力。`) : null,
    h('ol', { className: 'ah-haunted-list', 'aria-label': '可结算的闹鬼能力' },
      model.options.map(item => h('li', {}, moveButton(h, {
        optionId: item.optionId,
        disabled: !interactive || !item.move,
        busy,
        label: h('span', { className: 'ah-haunted-row' },
          h('span', { className: 'ah-haunted-index', 'aria-hidden': 'true' }, String(item.order)),
          h('span', { className: 'ah-haunted-text' }, renderRulesText(h, item.text, { links: false }))),
        title: item.move ? `结算：${item.text}` : '这条能力当前没有合法目标，稍后会自动跳过',
        onclick: () => item.move && onSubmit(item.move),
      })))),
    h('p', { className: 'ah-tcu-note is-muted' }, '多条闹鬼能力由你决定结算顺序；没有合法目标的能力会被跳过。'),
    skipButton(h, model, { onSubmit, disabled, busy }))
}

// 牌桌战役面板：幽灵牌堆、塔罗牌组、裂口、火盆、看守人、遗留记忆。
export function renderTcuCampaignPanel(h, model) {
  if (!model) return null
  const rows = []
  if (model.spectral) rows.push(['幽灵牌堆', `${model.spectral.deck} 张 · 弃牌 ${model.spectral.discard} 张`, 'eye'])
  if (model.tarot) rows.push(['塔罗牌组', `${model.tarot.deck} 张 · 已抽 ${model.tarot.drawn.length} 张`, 'tarot'])
  if (model.breaches) rows.push(['裂口合计', `${model.breaches} 个（${model.breachLocations} 处地点）`, 'doom'])
  if (model.braziers.length) {
    const lit = model.braziers.filter(item => item.lit).length
    rows.push(['火盆', `点燃 ${lit} / 熄灭 ${model.braziers.length - lit}`, 'star'])
  }
  if (model.storyInvestigators) rows.push(['故事调查员', model.storyInvestigators.chosen.map(entry => entry.name).join('、') || '未选', 'ally'])
  return h('div', { className: 'ah-campaign-tcu', role: 'group', 'aria-label': '万象无终剧本状态' },
    h('h4', {}, tableIcon('tarot'), '剧本状态'),
    rows.length
      ? h('ul', {}, rows.map(([label, value, icon]) => h('li', {},
        h('span', {}, tableIcon(icon), label), h('strong', {}, value))))
      : null,
    model.watcher
      ? h('p', { className: 'ah-tcu-watcher' },
        tableIcon('eye'),
        `看守人：${model.watcher.hunted.length ? `在追捕 ${model.watcher.hunted.join('、')}` : '尚未盯上任何人'}`
        + (model.watcher.taken.length ? `；已带走 ${model.watcher.taken.join('、')}` : ''))
      : null,
    model.mementos.length
      ? h('div', { className: 'ah-tcu-mementos', role: 'group', 'aria-label': '遗留记忆' },
        h('small', {}, `遗留记忆 ${model.mementos.length} 条`),
        h('ul', {}, model.mementos.map(item => h('li', { 'data-memento': item.id }, item.label))))
      : null)
}
