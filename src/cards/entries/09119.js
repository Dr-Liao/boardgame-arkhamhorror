// 09119 超自然发射器（Hyperphysical Shotcaster）· 中立资产 · 0 经验 · 定制 · 手槽 · 使用（4 以太）
// 卡面：定制。使用（4 以太）。如果超自然发射器上没有以太，将其弃掉。
//       [action] 花费 1 以太：结算超自然发射器当前形态的具象能力。
//       [fast] 横置超自然发射器：改变它的形态（你在其升级卡上解锁的形态之一）。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 读点：
//   · 定制：条目 customizationOptions 注册到 tsk-customizable 原语；已勾选读 customizationChecked
//     （与 09021 同一读法）；「以太连接」在 entersPlay 里 api.addUses(+2)；
//   · 「当前形态」用一条 untilLeavesPlay 的持续效果（label `shotcaster:form:<形态>`，sourceInstanceId=本卡）
//     记账——不新造卡实例字段；形态切换时追加新效果，读取最后一条；
//   · 五个形态的具象能力分别走 api.fight / api.investigate / api.evade / api.startTest /
//     api.playCardFromHandFree 与 api.cardsInPlayTreacheries + api.discardCardInPlay。
// approximation: ①「当前形态」用持续效果记账（缺实例级形态字段）；②定位变换的位移在躲避检定之后结算
//   （印刷为之前或之后均可）；③「注能配置」的 +2 只加在本次具象检定的技能值上。
import { customizationChecked } from '../../engine/tsk-customizable.js'
import { ALL_CARDS } from '../../cards/cards-data.js'

const code = '09119'
const FORM_LABEL = 'shotcaster:form:'
const FORMS = [
  { name: 'Railshooter', label: '轨道射击' },
  { name: 'Telescanner', label: '电信扫描' },
  { name: 'Translocator', label: '定位变换' },
  { name: 'Realitycollapser', label: '现实崩解' },
  { name: 'Matterweaver', label: '物质操控' },
]
const SKILLS = [['willpower', '意志'], ['intellect', '智力'], ['combat', '战斗'], ['agility', '敏捷']]

const checkedOf = (state, inv) => customizationChecked(state, inv?.seat ?? state.currentSeat, code)
const hasOption = (state, inv, index) => checkedOf(state, inv).includes(index)
const isEmpowered = (state, inv) => hasOption(state, inv, 6)
const currentForm = (state, source) => {
  const rows = (state.effects || []).filter(effect => effect.sourceInstanceId === source?.id
    && String(effect.label || '').startsWith(FORM_LABEL))
  const last = rows[rows.length - 1]
  return last ? String(last.label).slice(FORM_LABEL.length) : null
}
const setForm = (inv, source, api, form) => {
  api.addEffect({
    duration: 'untilLeavesPlay', sourceCode: code, sourceInstanceId: source?.id,
    controllerSeat: inv.seat, label: `${FORM_LABEL}${form}`, modifiers: [],
  })
  api.info(`🔫 「超自然发射器」：形态变为「${FORMS.find(item => item.name === form)?.label || form}」。`)
}
const chooseSkill = (inv, api) => {
  const answer = api.choice({
    kind: 'effect', source: code, seat: inv.seat,
    prompt: '「超自然发射器」：选择本次检定使用的技能。',
    options: SKILLS.map(([id, label]) => ({ id, label })),
  })
  return SKILLS.some(([id]) => id === answer) ? answer : 'willpower'
}
const skillBonusOf = (state, inv) => isEmpowered(state, inv) ? 2 : 0

const manifest = ({ state, inv, source, api }) => {
  const form = currentForm(state, source)
  if (!form) { api.info('「超自然发射器」：尚未选择形态。'); return }
  const bonus = skillBonusOf(state, inv)
  if (form === 'Railshooter') {
    const candidates = (state.enemies || []).filter(enemy => !enemy.defeated && enemy.location === inv.location)
    if (!candidates.length) { api.info('「超自然发射器」：本地点没有可攻击的敌人。'); return }
    const enemyId = candidates.length === 1 ? candidates[0].id : api.choice({
      kind: 'target', source: code, seat: inv.seat, prompt: '轨道射击：选择攻击目标。',
      options: candidates.map(enemy => ({ id: enemy.id, label: enemy.name })),
    })
    const skill = chooseSkill(inv, api)
    api.fight(inv.seat, enemyId, { assetId: source?.id, sourceCode: code, skill, combatBonus: bonus, damageBonus: 1 })
    return
  }
  if (form === 'Telescanner') {
    const skill = chooseSkill(inv, api)
    api.investigate(inv.seat, {
      assetId: source?.id, sourceCode: code, skill, bonus, noClueDiscovery: true,
      onInvestigateSuccess: () => {
        const targets = (state.locations || []).filter(location => location.revealed && (location.clues || 0) > 0)
        if (!targets.length) { api.info('「超自然发射器」：没有可发现线索的已揭示地点。'); return }
        const locationId = targets.length === 1 ? targets[0].id : api.choice({
          kind: 'location', source: code, seat: inv.seat, prompt: '电信扫描：选择发现线索的已揭示地点。',
          options: targets.map(location => ({ id: location.id, label: api.locName(location.id) })),
        })
        if (locationId) api.discoverClue(inv.seat, 1, locationId)
      },
    })
    return
  }
  if (form === 'Translocator') {
    const here = state.locations.find(location => location.id === inv.location)
    const connections = here?.connections || []
    const engaged = (state.enemies || []).filter(enemy => !enemy.defeated && enemy.engagedSeat === inv.seat)
    if (engaged.length) {
      const enemyId = engaged.length === 1 ? engaged[0].id : api.choice({
        kind: 'target', source: code, seat: inv.seat, prompt: '定位变换：选择要躲避的敌人。',
        options: engaged.map(enemy => ({ id: enemy.id, label: enemy.name })),
      })
      api.evade(inv.seat, { enemyId, assetId: source?.id, sourceCode: code, skill: chooseSkill(inv, api), bonus })
    }
    const options = [{ id: 'skip', label: '不移动任何人' }]
    for (const locationId of connections) {
      options.push({ id: `self:${locationId}`, label: `将你移动到「${api.locName(locationId)}」` })
      for (const enemy of (state.enemies || []).filter(item => !item.defeated && item.elite !== true && item.location === inv.location)) {
        options.push({ id: `enemyOut:${enemy.id}:${locationId}`, label: `将「${enemy.name}」移动到「${api.locName(locationId)}」` })
      }
      for (const enemy of (state.enemies || []).filter(item => !item.defeated && item.elite !== true && item.location === locationId)) {
        options.push({ id: `enemyIn:${enemy.id}`, label: `将「${enemy.name}」从「${api.locName(locationId)}」移动到此处` })
      }
      for (const owner of state.investigators.filter(item => !item.defeated && !item.resigned && item.seat !== inv.seat && item.location === locationId)) {
        options.push({ id: `investigatorIn:${owner.seat}`, label: `将 ${owner.name} 从「${api.locName(locationId)}」移动到此处` })
      }
    }
    if (options.length === 1) return
    const answer = api.choice({ kind: 'effect', source: code, seat: inv.seat, prompt: '定位变换：是否移动一名调查员或非精英敌人？', options })
    if (!answer || answer === 'skip') return
    const [kind, first, second] = String(answer).split(':')
    if (kind === 'self') api.moveInvestigator(inv.seat, first)
    else if (kind === 'enemyOut') api.moveEnemy(first, second)
    else if (kind === 'enemyIn') api.moveEnemy(first, inv.location)
    else if (kind === 'investigatorIn') api.moveInvestigator(Number(first), inv.location)
    return
  }
  if (form === 'Realitycollapser') {
    const skill = chooseSkill(inv, api)
    api.startTest({
      seat: inv.seat, skill, difficulty: 3, skillBonus: bonus,
      resolve: result => {
        if (!result?.success) return
        const targets = api.cardsInPlayTreacheries().filter(entry => {
          const subtype = ALL_CARDS[entry.code]?.subtype
          if (subtype === 'weakness' || subtype === 'basicweakness') return false
          if (entry.hostType === 'enemy' && entry.host?.elite === true) return false
          return true
        })
        if (!targets.length) { api.info('「超自然发射器」：场上没有可弃掉的非弱点诡计。'); return }
        const index = targets.length === 1 ? 0 : Number(api.choice({
          kind: 'card', source: code, seat: inv.seat, prompt: '现实崩解：选择从场上弃掉的非弱点诡计。',
          options: targets.map((entry, at) => ({ id: String(at), cardCode: entry.code, label: api.cardName(entry.code) })),
        }))
        const target = targets[Number.isFinite(index) ? index : 0]
        if (target) api.discardCardInPlay(target)
      },
    })
    return
  }
  if (form === 'Matterweaver') {
    const handAssets = [...new Set((inv.hand || []).filter(cardCode => ALL_CARDS[cardCode]?.type === 'asset'))]
    if (!handAssets.length) { api.info('「超自然发射器」：手牌里没有支援。'); return }
    const chosen = handAssets.length === 1 ? handAssets[0] : api.choice({
      kind: 'card', source: code, seat: inv.seat, prompt: '物质操控：选择手牌中的一张支援。',
      options: handAssets.map(cardCode => ({ id: cardCode, cardCode, label: `${api.cardName(cardCode)}（费用 ${Math.max(0, Number(ALL_CARDS[cardCode]?.cost) || 0)}）` })),
    })
    if (!chosen) return
    const difficulty = Math.max(0, Number(ALL_CARDS[chosen]?.cost) || 0)
    api.startTest({
      seat: inv.seat, skill: chooseSkill(inv, api), difficulty, skillBonus: bonus,
      resolve: result => {
        if (!result?.success) return
        if (api.playCardFromHandFree(inv.seat, chosen)) {
          api.info(`🌀 「超自然发射器」：${inv.name} 无需费用打出「${api.cardName(chosen)}」。`)
        }
      },
    })
  }
}

export default {
  code,
  uses: 4,
  usesType: 'aether',
  discardWhenEmpty: true,
  note: 'approximation: 当前形态用 untilLeavesPlay 持续效果记账（缺实例级形态字段）；定位变换的位移在躲避检定后结算；注能配置只加在具象检定的技能值上。',
  customizationOptions: [
    { name: 'Railshooter', checks: 2, text: 'Hyperphysical Shotcaster has this form: "Manifest - Fight. Fight with any skill. This attack deals +1 damage."' },
    { name: 'Telescanner', checks: 2, text: 'Hyperphysical Shotcaster has this form: "Manifest - Investigate. Investigate with any skill. If you succeed, discover a clue at any revealed location instead of your location."' },
    { name: 'Translocator', checks: 2, text: 'Hyperphysical Shotcaster has this form: "Manifest - Evade. Attempt to evade with any skill. Before or after this attempt, you may move an investigator or a non-[[Elite]] enemy at your location to a connecting location, or vice versa."' },
    { name: 'Realitycollapser', checks: 2, text: 'Hyperphysical Shotcaster has this form: "Manifest - Test any skill (3). If you succeed, discard from play a non-weakness treachery that is not attached to an [[Elite]] enemy."' },
    { name: 'Matterweaver', checks: 2, text: 'Hyperphysical Shotcaster has this form: "Manifest - Choose an asset in your hand and test any skill (X), where X is that asset\'s cost. If you succeed, play that asset at no cost."' },
    { name: 'Aetheric Link', checks: 4, text: 'Hyperphysical Shotcaster enters play with 2 additional aether.' },
    { name: 'Empowered Configuration', checks: 4, text: 'While using a Manifest ability, you get +2 skill value.' },
  ],
  abilities: [
    {
      kind: 'entersPlay',
      label: '以太连接：入场时额外 +2 以太',
      resolve: ({ state, inv, source, api }) => {
        if (!source || !hasOption(state, inv, 5)) return
        api.addUses(source, 2)
        api.info('🔮 「超自然发射器」：以太连接使其带有额外 2 以太。')
      },
    },
    {
      kind: 'action',
      label: '花费 1 以太：结算当前形态的具象能力',
      cost: { action: true, uses: 1 },
      criteria: [({ state, source }) => Boolean(currentForm(state, source))],
      resolve: manifest,
    },
    {
      kind: 'action',
      label: '[fast] 横置：改变形态（已解锁的形态）',
      cost: { action: false, exhaust: true },
      criteria: [({ state, inv }) => checkedOf(state, inv).filter(index => index < FORMS.length).length > 0],
      resolve: ({ state, inv, source, api }) => {
        const unlocked = [...new Set(checkedOf(state, inv).filter(index => index < FORMS.length))]
        const current = currentForm(state, source)
        const options = unlocked.filter(index => FORMS[index].name !== current)
          .map(index => ({ id: String(index), label: FORMS[index].label }))
        if (!options.length) { api.info('「超自然发射器」：没有其它已解锁的形态。'); return }
        const answer = api.choice({
          kind: 'effect', source: code, seat: inv.seat, prompt: '「超自然发射器」：选择新形态。', options,
        })
        const index = Number(answer)
        if (!Number.isInteger(index) || !FORMS[index]) return
        setForm(inv, source, api, FORMS[index].name)
      },
    },
  ],
  modifiers: [],
}
