// 《地球边缘》（Edge of the Earth）· 幕间 I–III（P7）。
//
// 事实源（锁定）：
//   · 参考实现 `Campaigns/EdgeOfTheEarth.hs`：
//       幕间 I（宁静夜晚）：读 restfulNight1；若已记录 `theTeamFledToTheMountains` 则查看 4 名队员，否则 3 名；
//         restfulNight2：若被划去的伙伴 ≥3 → 可选「推开门」进《致命幻景》（restfulNight3），否则直接去失落之峰。
//       幕间 II（无尽夜晚）：读 endlessNight1；`theTeamFoundAnotherWayThroughTheMountains` → 4 名检查，否则 3 名；
//         endlessNight2：若已完成《致命幻景》→ endlessNight3 门（可再进幻景），
//         否则若被划去伙伴 ≥3 → endlessNight4 门；否则直接去古老者之城。
//       幕间 III（最后一夜）：读 finalNight1；`theTeamWasGuidedToTheHiddenTunnel` → 4 名检查；
//         finalNight2：已进过幻景 → finalNight3 门，否则 finalNight4 门；两门都可再进幻景或去疯狂之心 I。
//   · 正文键：`interludeN.restfulNightX/endlessNightX/finalNightX` 与每位伙伴的
//     `<camel>IsAlive` / `<camel>IsCrossedOut`（含特殊组合键）。
//   · 升级权限：幕间节点 `upgrades: true`（引擎在 interlude 节点开升级窗；检查点不开）。
//
// approximation（已在 P7 报告登记）：参考实现让队长逐名选择「查看」哪几位队员；这里自动查看
// 前 N 名存活伙伴（N = 3 或按记录 4）并补讲所有被划去伙伴的 crossed 正文。存活伙伴每人给
// 每名调查员 +1 奖励 XP（参考实现的「曲奇的建议」奖励经验）；dyer 存活移除忒咳哩-哩弱点、
// 伙伴专属奖励卡等章节内效果留待章节内容接线。
import { registerCampaignEffectHandler } from '../../../src/campaign/content-effects.js'
import { awardExperience } from '../../../src/campaign/campaign.js'
import { initializePartners, partnerState } from '../../../src/campaign/eote-partners.js'
import { PARTNERS, PARTNER_CODES, partnerStatusEntries, storyBody, storyHeading } from './records.js'

export const INTERLUDE_HANDLER_ID = 'edgeOfTheEarthInterludes'

const text = (key, fallback) => storyBody(key) || fallback
const heading = (key, fallback) => storyHeading(key, fallback) || fallback

// 幕间数据：检查人数上限的额外条件记录、伙伴文本键名、专属剧情记录。
export const INTERLUDE_DATA = Object.freeze({
  interlude1: Object.freeze({
    number: 1, title: '幕间 I：宁静夜晚',
    openingKey: 'interlude1.restfulNight1',
    night2Key: 'interlude1.restfulNight2',
    doorKey: 'interlude1.restfulNight3',
    extraCheckRecord: 'theTeamFledToTheMountains',
    xpLabelKey: 'interlude1.xp.cookiesAdvice',
    partnerKeys: Object.freeze({
      dyer: 'williamDyer', danforth: 'danforth', kensler: 'kensler', sinha: 'sinha',
      cookie: 'cookie', claypool: 'claypool', ellsworth: 'ellsworth', takada: 'takada', ashevak: 'ashevak',
    }),
    specialAlive: Object.freeze({ claypool: Object.freeze({ whenRecord: 'ellsworth', key: 'claypoolIsAliveEllsworth' }) }),
    onAliveRecords: Object.freeze({ kensler: 'drKenslerIsSharingHerResearchWithYou' }),
  }),
  interlude2: Object.freeze({
    number: 2, title: '幕间 II：无尽夜晚',
    openingKey: 'interlude2.endlessNight1',
    night2Key: 'interlude2.endlessNight2',
    doorKey: 'interlude2.endlessNight3',
    altDoorKey: 'interlude2.endlessNight4',
    extraCheckRecord: 'theTeamFoundAnotherWayThroughTheMountains',
    xpLabelKey: 'interlude2.xp.cookiesAdvice',
    partnerKeys: Object.freeze({
      dyer: 'williamDyer', danforth: 'danforth', kensler: 'kensler', sinha: 'sinha',
      cookie: 'cookie', claypool: 'claypool', ellsworth: 'ellsworth', takada: 'takada', ashevak: 'ashevak',
    }),
    specialAlive: Object.freeze({
      kensler: Object.freeze({ whenRecord: 'drKenslerIsSharingHerResearchWithYou', key: 'kenslerIsAliveAndSharingResearch' }),
      ellsworth: Object.freeze({ whenRecord: 'claypool', key: 'ellsworthIsAliveClaypool' }),
    }),
    onAliveRecords: Object.freeze({}),
  }),
  interlude3: Object.freeze({
    number: 3, title: '幕间 III：最后一夜',
    openingKey: 'interlude3.finalNight1',
    night2Key: 'interlude3.finalNight2',
    doorKey: 'interlude3.finalNight3',
    altDoorKey: 'interlude3.finalNight4',
    extraCheckRecord: 'theTeamWasGuidedToTheHiddenTunnel',
    xpLabelKey: 'interlude3.xp.cookiesAdvice',
    partnerKeys: Object.freeze({
      dyer: 'williamDyer', danforth: 'danforth', kensler: 'kensler', sinha: 'sinha',
      cookie: 'cookie', claypool: 'claypool', ellsworth: 'ellsworth', takada: 'takada', ashevak: 'ashevak',
    }),
    specialAlive: Object.freeze({
      kensler: Object.freeze({ whenRecord: 'drKenslerIsOnTheVergeOfUnderstanding', key: 'kenslerIsAliveAndOnTheVergeOfUnderstanding' }),
    }),
    onAliveRecords: Object.freeze({}),
  }),
})

// ---------------------------------------------------------------------------
// 幕间子图
// ---------------------------------------------------------------------------

export const INTERLUDE_NODES = Object.freeze({
  // 幕间 I
  interlude1: {
    type: 'interlude',
    title: INTERLUDE_DATA.interlude1.title,
    textKey: INTERLUDE_DATA.interlude1.openingKey,
    text: text(INTERLUDE_DATA.interlude1.openingKey, '你们最终安全了，开始评估当前的处境。'),
    upgrades: true,
    effects: [{ type: 'registered', handler: INTERLUDE_HANDLER_ID, event: 'interlude1' }],
    next: 'interlude1Route',
  },
  interlude1Route: {
    type: 'stepReturn',
    title: INTERLUDE_DATA.interlude1.title,
    rules: [
      {
        id: 'threeOrMoreCrossedOut',
        when: { record: 'eoteEliminatedPartners', atLeast: 3 },
        next: 'interlude1Night2Door',
      },
    ],
    next: 'interlude1Night2',
  },
  interlude1Night2: {
    type: 'story',
    title: heading('interlude1.restfulNight2', INTERLUDE_DATA.interlude1.title),
    textKey: 'interlude1.restfulNight2',
    text: text('interlude1.restfulNight2', '营地一片寂静，队员们一个接一个地进入了沉睡。'),
    next: 'toTheForbiddenPeaks',
  },
  interlude1Night2Door: {
    type: 'story',
    title: heading('interlude1.restfulNight2', INTERLUDE_DATA.interlude1.title),
    textKey: 'interlude1.restfulNight2',
    text: text('interlude1.restfulNight2', '营地一片寂静……但你总觉得有什么在等着你。'),
    next: 'interlude1DoorChoice',
  },
  interlude1DoorChoice: {
    type: 'choice',
    title: heading('interlude1.restfulNight3', INTERLUDE_DATA.interlude1.title),
    textKey: 'interlude1.restfulNight3',
    text: text('interlude1.restfulNight3', '你猛然惊醒：营地深处出现了一扇本不该存在的门。'),
    prompt: '要推开那扇门吗？',
    options: [
      { id: 'open', label: text('label.openTheDoorAndVenture', '推开门走进去'), next: 'fatalMirage' },
      { id: 'ignore', label: text('label.ignoreTheDoor', '无视那扇门'), next: 'toTheForbiddenPeaks' },
    ],
  },

  // 幕间 II
  interlude2: {
    type: 'interlude',
    title: INTERLUDE_DATA.interlude2.title,
    textKey: INTERLUDE_DATA.interlude2.openingKey,
    text: text(INTERLUDE_DATA.interlude2.openingKey, '又是一个难以入眠的夜晚。'),
    upgrades: true,
    effects: [{ type: 'registered', handler: INTERLUDE_HANDLER_ID, event: 'interlude2' }],
    next: 'interlude2Route',
  },
  interlude2Route: {
    type: 'stepReturn',
    title: INTERLUDE_DATA.interlude2.title,
    rules: [
      {
        id: 'alreadyEnteredMirage',
        when: { completedStep: 'fatalMirage' },
        next: 'interlude2Night2Door',
      },
      {
        id: 'threeOrMoreCrossedOut',
        when: { record: 'eoteEliminatedPartners', atLeast: 3 },
        next: 'interlude2Night2AltDoor',
      },
    ],
    next: 'interlude2Night2',
  },
  interlude2Night2: {
    type: 'story',
    title: heading('interlude2.endlessNight2', INTERLUDE_DATA.interlude2.title),
    textKey: 'interlude2.endlessNight2',
    text: text('interlude2.endlessNight2', '黑夜仿佛没有尽头。'),
    next: 'cityOfTheElderThings',
  },
  interlude2Night2Door: {
    type: 'story',
    title: heading('interlude2.endlessNight2', INTERLUDE_DATA.interlude2.title),
    textKey: 'interlude2.endlessNight2',
    text: text('interlude2.endlessNight2', '黑夜仿佛没有尽头……而那扇门又出现了。'),
    next: 'interlude2Night3Choice',
  },
  interlude2Night2AltDoor: {
    type: 'story',
    title: heading('interlude2.endlessNight2', INTERLUDE_DATA.interlude2.title),
    textKey: 'interlude2.endlessNight2',
    text: text('interlude2.endlessNight2', '太多同伴被划去了名字，黑夜变得格外沉重。'),
    next: 'interlude2Night4Choice',
  },
  interlude2Night3Choice: {
    type: 'choice',
    title: heading('interlude2.endlessNight3', INTERLUDE_DATA.interlude2.title),
    textKey: 'interlude2.endlessNight3',
    text: text('interlude2.endlessNight3', '门再次出现，门后传来熟悉的低语。'),
    prompt: '要再次推开门吗？',
    options: [
      { id: 'open', label: text('label.openTheDoorAndVentureOnceMore', '推开门再次走进去'), next: 'fatalMirage' },
      { id: 'ignore', label: text('label.ignoreTheDoor', '无视那扇门'), next: 'cityOfTheElderThings' },
    ],
  },
  interlude2Night4Choice: {
    type: 'choice',
    title: heading('interlude2.endlessNight4', INTERLUDE_DATA.interlude2.title),
    textKey: 'interlude2.endlessNight4',
    text: text('interlude2.endlessNight4', '门静静地立在那里，等候着你。'),
    prompt: '要推开门吗？',
    options: [
      { id: 'open', label: text('label.openTheDoorAndVenture', '推开门走进去'), next: 'fatalMirage' },
      { id: 'ignore', label: text('label.ignoreTheDoor', '无视那扇门'), next: 'cityOfTheElderThings' },
    ],
  },

  // 幕间 III
  interlude3: {
    type: 'interlude',
    title: INTERLUDE_DATA.interlude3.title,
    textKey: INTERLUDE_DATA.interlude3.openingKey,
    text: text(INTERLUDE_DATA.interlude3.openingKey, '最后一夜，所有人都无法入睡。'),
    upgrades: true,
    effects: [{ type: 'registered', handler: INTERLUDE_HANDLER_ID, event: 'interlude3' }],
    next: 'interlude3Route',
  },
  interlude3Route: {
    type: 'stepReturn',
    title: INTERLUDE_DATA.interlude3.title,
    rules: [
      {
        id: 'alreadyEnteredMirage',
        when: { completedStep: 'fatalMirage' },
        next: 'interlude3Night2Door',
      },
    ],
    next: 'interlude3Night2',
  },
  interlude3Night2: {
    type: 'story',
    title: heading('interlude3.finalNight2', INTERLUDE_DATA.interlude3.title),
    textKey: 'interlude3.finalNight2',
    text: text('interlude3.finalNight2', '最后一夜的故事，即将走向终点。'),
    next: 'interlude3Night4Choice',
  },
  interlude3Night2Door: {
    type: 'story',
    title: heading('interlude3.finalNight2', INTERLUDE_DATA.interlude3.title),
    textKey: 'interlude3.finalNight2',
    text: text('interlude3.finalNight2', '最后一夜，那扇门又一次出现。'),
    next: 'interlude3Night3Choice',
  },
  interlude3Night3Choice: {
    type: 'choice',
    title: heading('interlude3.finalNight3', INTERLUDE_DATA.interlude3.title),
    textKey: 'interlude3.finalNight3',
    text: text('interlude3.finalNight3', '门后的低语比任何一次都更清晰。'),
    prompt: '要再次推开门吗？',
    options: [
      { id: 'open', label: text('label.openTheDoorAndVentureOnceMore', '推开门再次走进去'), next: 'fatalMirage' },
      { id: 'ignore', label: text('label.ignoreTheDoor', '无视那扇门'), next: 'theHeartOfMadnessPart1' },
    ],
  },
  interlude3Night4Choice: {
    type: 'choice',
    title: heading('interlude3.finalNight4', INTERLUDE_DATA.interlude3.title),
    textKey: 'interlude3.finalNight4',
    text: text('interlude3.finalNight4', '门就立在那里，仿佛一直在等你。'),
    prompt: '要推开门吗？',
    options: [
      { id: 'open', label: text('label.openTheDoorAndVenture', '推开门走进去'), next: 'fatalMirage' },
      { id: 'ignore', label: text('label.ignoreTheDoor', '无视那扇门'), next: 'theHeartOfMadnessPart1' },
    ],
  },
})

// ---------------------------------------------------------------------------
// 幕间效果处理器
// ---------------------------------------------------------------------------

const logLine = (log, line) => { if (typeof log === 'function') log(line) }

function appendStory (state, line) {
  const visit = state?.campaign?.flow?.history?.at?.(-1)
  if (visit) visit.storyText = [visit.storyText, line].filter(Boolean).join('\n\n')
}

function ensurePartners (state) {
  if (state?.campaign?.eote?.partners) return
  initializePartners(state, {
    partners: PARTNERS.map(partner => ({ code: partner.code, damage: 0, horror: 0 })),
    resoluteForms: PARTNERS.map(partner => [partner.code, partner.resolute]),
  })
}

function rosterEntries (state) {
  return PARTNER_CODES.map(code => partnerState(state, code)).filter(Boolean)
}

function syncPartnerMirror (state) {
  const campaign = state?.campaign
  if (!campaign?.records) return
  const roster = rosterEntries(state)
  campaign.records.eotePartnerStatuses = partnerStatusEntries(roster)
  campaign.records.eoteEliminatedPartners = roster.filter(entry => entry.status === 'eliminated').length
}

/** 伙伴存活/划去正文键：含特殊组合键（肯斯勒研究线、埃尔斯沃思与克莱普尔）。 */
function partnerStoryKey (interlude, partner, state) {
  const data = INTERLUDE_DATA[interlude]
  const def = PARTNERS.find(item => item.code === partner.code)
  const base = def ? data.partnerKeys[def.key] : null
  if (!base) return null
  const alive = partner.status === 'safe' || partner.status === 'resolute'
  const records = state?.campaign?.records || {}
  const roster = rosterEntries(state)
  const aliveByKey = key => {
    const def = PARTNERS.find(item => item.key === key)
    const entry = def ? roster.find(item => item.code === def.code) : null
    return Boolean(entry && (entry.status === 'safe' || entry.status === 'resolute'))
  }
  if (alive) {
    const special = data.specialAlive[def.key]
    if (special) {
      const conditionMet = Object.hasOwn(records, special.whenRecord)
        ? records[special.whenRecord] === true
        : aliveByKey(special.whenRecord)
      if (conditionMet) return `interlude${data.number}.${special.key}`
    }
    return `interlude${data.number}.${base}IsAlive`
  }
  return `interlude${data.number}.${base}IsCrossedOut`
}

function alivePartners (state) {
  return rosterEntries(state).filter(entry => entry.status === 'safe' || entry.status === 'resolute')
}

function crossedPartners (state) {
  return rosterEntries(state).filter(entry => entry.status === 'eliminated' || entry.status === 'mia')
}

function awardBonusXp (state, amount, log) {
  const campaign = state?.campaign
  if (!campaign || amount <= 0) return 0
  let awarded = 0
  for (const record of Object.values(campaign.investigators || {})) {
    if (!record || record.status === 'killed' || record.status === 'insane') continue
    awardExperience(campaign, record.seat, amount)
    awarded += amount
  }
  campaign.records.eoteInterludeXp = (Number(campaign.records.eoteInterludeXp) || 0) + amount
  if (awarded) logLine(log, `✨ 幕间奖励经验：每名调查员 +${amount} 经验值（「${text('interlude1.xp.cookiesAdvice', '曲奇的建议')}」）。`)
  return awarded
}

function runInterlude (state, interludeId, log) {
  ensurePartners(state)
  const data = INTERLUDE_DATA[interludeId]
  if (!data) throw new Error(`未知幕间：${String(interludeId)}`)
  const records = state.campaign.records
  syncPartnerMirror(state)
  const limit = 3 + (records[data.extraCheckRecord] === true ? 1 : 0)
  const checked = alivePartners(state).slice(0, limit)
  const crossed = crossedPartners(state)
  records.eoteCheckedPartners = checked.map(entry => entry.code)
  for (const partner of checked) {
    const partnerDef = PARTNERS.find(item => item.code === partner.code)
    const key = partnerStoryKey(interludeId, partner, state)
    const body = key ? storyBody(key) : ''
    const name = partnerDef?.name || partner.code
    if (body) {
      appendStory(state, body)
      logLine(log, `【${name}】${body}`)
    } else {
      logLine(log, `【${name}】仍与队伍同行。`)
    }
    const recordKey = data.onAliveRecords?.[partnerDef?.key]
    if (recordKey) {
      records[recordKey] = true
      logLine(log, `📔 记录：${recordKey}。`)
    }
  }
  for (const partner of crossed) {
    const partnerDef = PARTNERS.find(item => item.code === partner.code)
    const key = partnerStoryKey(interludeId, partner, state)
    const body = key ? storyBody(key) : ''
    if (body) {
      appendStory(state, body)
      logLine(log, `【${partnerDef?.name || partner.code}】${body}`)
    }
  }
  // 参考实现：每查看一位存活队员，每名调查员获得 1 点奖励经验。
  awardBonusXp(state, checked.length, log)
  logLine(log, `🌙 幕间：已查看 ${checked.length}/${limit} 名存活队员，被划去 ${crossed.length} 名。`)
}

export function runInterludeEffect (state, effect, log) {
  if (effect.event === 'interlude1') return runInterlude(state, 'interlude1', log)
  if (effect.event === 'interlude2') return runInterlude(state, 'interlude2', log)
  if (effect.event === 'interlude3') return runInterlude(state, 'interlude3', log)
  throw new Error(`未知幕间效果：${String(effect.event)}`)
}

registerCampaignEffectHandler(INTERLUDE_HANDLER_ID, runInterludeEffect)
