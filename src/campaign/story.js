import { STORY_TEXT } from '../../content/campaigns/nightOfTheZealot/story-text.js'
import { DUNWICH_STORY_TEXT } from '../../content/campaigns/theDunwichLegacy/story-text.js'
import { CARCOSA_STORY_TEXT } from '../../content/campaigns/thePathToCarcosa/story-text.js'
import { CARCOSA_STORY_ROLES } from '../../content/campaigns/thePathToCarcosa/story-roles.js'
import { TFA_STORY_TEXT } from '../../content/campaigns/theForgottenAge/story-text.js'
import { TFA_STORY_ROLES } from '../../content/campaigns/theForgottenAge/story-roles.js'

const CARCOSA_IDS = new Set(Object.keys(CARCOSA_STORY_TEXT.introductions))
const TFA_IDS = new Set(Object.keys(TFA_STORY_TEXT.introductions))

// 第 123 轮（第 8 批）：剧情角色 → 卡号由战役内容声明（story-roles.js），本文件不再写死卡号。
const carcosaCode = role => CARCOSA_STORY_ROLES[role] || null
const tfaCode = role => TFA_STORY_ROLES[role] || null
const interviewed = (records, role) => (records.vipsInterviewed || []).includes(carcosaCode(role))

function campaignHasInvestigator(context, code) {
  if (!code) return false
  const records = Object.values(context?.campaign?.investigators || context?.investigators || {})
  return records.some(record => record?.code === code)
}

function carcosaIntroduction(sc, records, context) {
  const source = CARCOSA_STORY_TEXT.introductions[sc.id]
  if (!source) return null
  const sections = []
  const add = (title, paragraphs) => {
    if (paragraphs?.length) sections.push({ title, paragraphs: [...paragraphs] })
  }
  if (sc.id === 'curtainCall') {
    add(CARCOSA_STORY_TEXT.prologue.epigraph.title, CARCOSA_STORY_TEXT.prologue.epigraph.paragraphs)
    add(`战役序章 · ${CARCOSA_STORY_TEXT.prologue.title}`, CARCOSA_STORY_TEXT.prologue.common)
    if (campaignHasInvestigator(context, carcosaCode('lola'))) add('萝拉的序幕', CARCOSA_STORY_TEXT.prologue.lola)
    add(source.title, source.common)
  } else if (sc.id === 'echoesOfThePast') {
    add(source.title, source.common)
    if (interviewed(records, 'sebastiensInformation')) add('塞巴斯蒂安提供的信息', source.sebastiensInformation)
  } else if (sc.id === 'theUnspeakableOath') {
    add(source.title, records.theFollowersOfTheSignHaveFoundTheWayForward
      ? source.foundTheWayForward : source.didNotFindTheWayForward)
    add(null, source.common)
    if (interviewed(records, 'constancesInformation')) add('康斯坦丝提供的信息', source.constancesInformation)
  } else if (sc.id === 'aPhantomOfTruth') {
    add(source.title, records.theKingClaimedItsVictims ? source.kingClaimedVictims : source.common)
    const logged = context?.scenarioFlags?.dreamLog
    const reached = new Set(logged || [
      'dream1',
      ...(records.theKingClaimedItsVictims ? [] : [
        ...(records.youIntrudedOnASecretMeeting ? ['dream3']
          : records.youSlayedTheMonstersAtTheDinnerParty ? ['dream4'] : []),
        'dream6',
        ...(records.thePoliceAreSuspiciousOfYou ? ['dream7'] : []),
      ]),
      'dream8',
      ...(Number(records.chasingTheStranger || 0) <= 3 ? ['dream9', 'dream13'] : ['dream10']),
      ...(interviewed(records, 'jordansInformation') ? ['jordansInformation'] : []),
    ])
    add('梦境 1', source.dreams.dream1)
    add('梦境 2', source.dream2)
    for (const key of ['dream3', 'dream4']) if (reached.has(key)) add(`梦境 ${key.slice(5)}`, source.dreams[key])
    if (reached.has('dream6')) add('梦境 6', source.dream6)
    if (reached.has('dream7')) add('梦境 7', source.dreams.dream7)
    add('梦境 8', source.dream8)
    for (const key of ['dream9', 'dream10', 'dream11', 'dream12', 'dream13']) {
      if (reached.has(key)) add(`梦境 ${key.slice(5)}`, source.dreams[key])
    }
    add('梦境惊醒', source.awakening)
    if (reached.has('jordansInformation')) add('乔丹提供的信息', source.jordansInformation)
  } else if (sc.id === 'thePallidMask') {
    add(source.title, records.youAwokeInsideTheCatacombs || records.youDidNotEscapeTheGazeOfThePhantom
      || records.youWereUnableToFindNigel ? source.awokeInside : source.enteredOnYourOwn)
    if (interviewed(records, 'harukosInformation')) add('石丸春子提供的信息', source.harukosInformation)
  } else if (sc.id === 'blackStarsRise') {
    add(source.title, source.common)
    if (interviewed(records, 'ashleighsInformation')) add('阿什莉提供的信息', source.ashleighsInformation)
  } else if (sc.id === 'dimCarcosa') {
    add(source.title, records.youOpenedThePathBelow ? source.pathBelow : source.pathAbove)
  } else add(source.title, source.common)
  return sections
}

function carcosaFlowStory(visit, campaign) {
  if (campaign.id !== 'thePathToCarcosa') return null
  if (visit.nodeId === 'interludeOne' && visit.choice) {
    const source = CARCOSA_STORY_TEXT.interludes.interludeOne
    return { title: source.title, paragraphs: [...(source[visit.choice] || [])] }
  }
  if (visit.nodeId === 'danielSurvived') {
    const source = CARCOSA_STORY_TEXT.interludes.interludeTwo
    return { title: source.title, paragraphs: [...source.danielSurvived] }
  }
  if (visit.nodeId === 'interludeTwo') {
    const source = CARCOSA_STORY_TEXT.interludes.interludeTwo
    const status = campaign.records.danielStatus
    const lead = status === 'possessed' ? source.danielWasPossessed
      : status === 'didNotSurvive' ? source.danielDidNotSurvive : []
    const choice = visit.choice ? source[visit.choice] || [] : []
    return lead.length || choice.length ? { title: source.title, paragraphs: [...lead, ...choice] } : null
  }
  return null
}

// 失落的时代：导入正文按该次进入时的战役记录选择分支；未触发的分支不投影。
function tfaIntroduction(sc, records = {}, context = null) {
  const source = TFA_STORY_TEXT.introductions[sc.id]
  if (!source) return null
  const sections = []
  const has = key => Boolean((source.sections[key] || []).length)
  const add = (title, keys) => {
    const paragraphs = [keys].flat().flatMap(key => source.sections[key] || [])
    if (paragraphs.length) sections.push({ title: title ?? source.title, paragraphs })
  }
  const supplies = () => Object.values(context?.campaign?.supplies || context?.supplies || {})
    .flat().filter(Boolean)
  if (sc.id === 'theUntamedWilds') {
    add(source.title, ['body'])
  } else if (sc.id === 'theDoomOfEztli') {
    if (records.theInvestigatorsWereForcedToWaitForAdditionalSupplies) add(source.title, ['intro1'])
    else if (records.theInvestigatorsClearedAPathToTheEztliRuins) add(source.title, ['intro2'])
  } else if (sc.id === 'threadsOfFate') {
    add(source.title, ['intro1'])
    const alejandro = records.theInvestigatorsGaveCustodyOfTheRelicToAlejandro
      || records.alejandroRecoveredTheRelicOfAges
    const harlan = records.theInvestigatorsGaveCustodyOfTheRelicToHarlanEarnstone
    if (alejandro) add(null, ['intro2'])
    else if (harlan) add(null, ['intro3'])
    add(null, ['intro4'])
    if (harlan) add(null, ['intro5'])
    else if (!alejandro) add(null, ['intro6'])
    add(null, ['intro7'])
  } else if (sc.id === 'theBoundaryBeyond') {
    add(source.title, ['part1'])
    if (records.theInvestigatorsForgedABondWithIchtaca) add(null, ['ichtaca.ichtacasQuest'])
    else if (records.ichtacaIsInTheDark) add(null, ['ichtaca.silentJourney'])
    if (records.theInvestigatorsFoundTheMissingRelic) add(null, ['missingRelic.arcaneThrumming'])
    else if (records.theRelicIsMissing) add(null, ['missingRelic.growingConcern'])
    if (records.theInvestigatorsRescuedAlejandro) add(null, ['alejandro.alejandrosThoughts'])
    else if (records.alejandroIsMissing) add(null, ['alejandro.anEmptySeat'])
    if (!supplies().includes('gasoline')) add(null, ['gas.outOfGas'])
    add(null, ['part2'])
  } else if (sc.id === 'heartOfTheEldersPart1') {
    // 序盘导入：intro1 必有；intro2/3/4 分别只在伊塔卡、亚历山卓、探险日志随行时读。
    add(source.title, ['intro1'])
    const flags = context?.scenarioFlags || {}
    const hasCampaignCard = code => Object.values(context?.campaign?.investigators || {})
      .some(record => (record?.deck || []).includes(code))
    const ichtaca = flags.ichtacaPresent ?? hasCampaignCard(tfaCode('ichtaca'))
    const alejandro = flags.alejandroPresent ?? hasCampaignCard(tfaCode('alejandro'))
    const journal = flags.journalPresent ?? hasCampaignCard(tfaCode('journal'))
    if (ichtaca) add(null, ['intro2'])
    if (alejandro) add(null, ['intro3'])
    if (journal) add(null, ['intro4'])
  } else if (sc.id === 'theCityOfArchives') {
    add(source.title, ['intro1'])
    if (records.theInvestigatorsCooperatedWithTheYithians) add(null, ['intro2'])
    else if (records.theInvestigatorsResistedCaptivity) add(null, ['intro3'])
  } else if (sc.id === 'theDepthsOfYoth') {
    add(source.title, ['intro1.body'])
    if (records.youAreForgingYourOwnWay) add(null, ['intro1.forgingYourOwnPath'])
    else if (records.ichtacasFaithIsRestored) add(null, ['intro1.faithIsRestored'])
    else if (has('intro1.otherwise')) add(null, ['intro1.otherwise'])
    if (records.youAreForgingYourOwnWay) add(null, ['intro2'])
    else if (records.ichtacasFaithIsRestored) add(null, ['intro3', 'intro5'])
    else if (records.theRelicIsMissing) add(null, ['intro6', 'intro8'])
    if (has('intro4.body')) add(null, ['intro4.body'])
    if (records.theInvestigatorsFoundTheMissingRelic) add(null, ['intro4.foundTheMissingRelic'])
    else if (records.theRelicIsMissing) add(null, ['intro4.theRelicIsMissing'])
    if (!records.youAreForgingYourOwnWay && !records.ichtacasFaithIsRestored) add(null, ['intro7'])
  } else if (sc.id === 'shatteredAeons') {
    if (records.theBraziersAreLit) add(source.title, ['theBraziersAreLit', 'intro1'])
    else if (records.theBraziersRemainUnlit) add(source.title, ['theBraziersRemainUnlit', 'intro2'])
    else add(source.title, ['intro1'])
    add(null, ['intro3.body'])
    if (records.theInvestigatorsFoundTheMissingRelic) add(null, ['intro3.foundTheMissingRelic'])
    else if (records.theRelicIsMissing) add(null, ['intro3.theRelicIsMissing'])
    add(null, [records.theRelicIsMissing ? 'intro5' : 'intro4'])
  } else if (sc.id === 'turnBackTime') {
    if (records.theInvestigatorsWereForcedToWaitForAdditionalSupplies) add(source.title, ['intro1'])
    else if (records.theInvestigatorsClearedAPathToTheEztliRuins) add(source.title, ['intro2'])
  }
  return sections.length ? sections : null
}

function tfaFlowStory(visit, campaign) {
  if (campaign.id !== 'theForgottenAge') return null
  const nodes = {
    prologue: TFA_STORY_TEXT.prologue,
    interludeOne: TFA_STORY_TEXT.interludes.interludeOne,
    interludeTwo: TFA_STORY_TEXT.interludes.interludeTwo,
    interludeThree: TFA_STORY_TEXT.interludes.interludeThree,
    interludeFour: TFA_STORY_TEXT.interludes.interludeFour,
    interludeFive: TFA_STORY_TEXT.interludes.interludeFive,
    resupplyPoint: TFA_STORY_TEXT.interludes.resupplyPoint,
    epilogue: TFA_STORY_TEXT.epilogue,
  }
  const source = nodes[visit.nodeId]
  if (!source) return null
  // 幕间的分支由结算过程逐段写入 storySections，纪事只展示实际到达的段落，
  // 不再把互斥分支一次性展开（审计 §3.9 C 第 4 项）。
  const reached = campaign.storySections?.[visit.nodeId]
  if (Array.isArray(reached) && reached.length) return { title: source.title, paragraphs: [...reached] }
  const paragraphs = Object.values(source.sections).flat()
  return paragraphs.length ? { title: source.title, paragraphs } : null
}

function dunwichIntroduction(sc, records) {
  const source = DUNWICH_STORY_TEXT.introductions[sc.id]
  if (!source) return null
  const opening = ['extracurricularActivity', 'theHouseAlwaysWins'].includes(sc.id)
    && (!records.openingScenario || records.openingScenario === sc.id)
  const sections = [
    ...(opening ? [{ title: DUNWICH_STORY_TEXT.prologue.title, paragraphs: [...DUNWICH_STORY_TEXT.prologue.paragraphs] }] : []),
    { title: source.title || sc.name, paragraphs: [...source.common] },
  ]
  let branch = null
  if (sc.id === 'theMiskatonicMuseum') branch = records.drHenryArmitageWasKidnapped
    ? source.armitageKidnapped : records.theInvestigatorsRescuedDrHenryArmitage ? source.armitageRescued : null
  else if (sc.id === 'undimensionedAndUnseen') branch = records.youCalmedTheTownsfolk
    ? source.calmed : records.youWarnedTheTownsfolk ? source.warned : null
  else if (sc.id === 'whereDoomAwaits' && records.naomiHasTheInvestigatorsBacks) branch = source.naomi
  if (branch?.length) sections.push({ title: '此前调查的影响', paragraphs: [...branch] })
  return sections
}

function dunwichFlowStory(nodeId, campaign) {
  if (campaign.id !== 'theDunwichLegacy') return null
  if (nodeId === 'armitageKidnapped' || nodeId === 'armitageRescued') return DUNWICH_STORY_TEXT.interludes[nodeId]
  if (nodeId === 'survivors') {
    const source = DUNWICH_STORY_TEXT.interludes.survivors
    const sacrificed = new Set(campaign.records.sacrificedToYogSothoth || [])
    return { title: source.title, paragraphs: [...source.common,
      ...Object.entries(source.people).filter(([code]) => !sacrificed.has(code)).flatMap(([, paragraphs]) => paragraphs)] }
  }
  if (nodeId === 'epilogue') {
    if (campaign.records.youCalmedTheTownsfolk) return DUNWICH_STORY_TEXT.epilogues.calmed
    if (campaign.records.youWarnedTheTownsfolk) return DUNWICH_STORY_TEXT.epilogues.warned
  }
  return null
}

// Build a reader's journal from reached branches only. Never send a resolution map.
export function introduction(sc, records = {}, context = null) {
  const sections = []
  if (sc.id === 'theGathering') sections.push({ title: '战役序章 · ' + STORY_TEXT.prologue.title, paragraphs: [...STORY_TEXT.prologue.paragraphs] })
  const dunwich = dunwichIntroduction(sc, records)
  const carcosa = carcosaIntroduction(sc, records, context)
  const tfa = tfaIntroduction(sc, records, context)
  if (dunwich) sections.push(...dunwich)
  else if (carcosa) sections.push(...carcosa)
  else if (tfa) sections.push(...tfa)
  else {
    const narrative = sc.id === 'theMidnightMasks'
      ? [...STORY_TEXT.theMidnightMasks[records.litaForcedOthers ? 'others' : 'survivors'], ...STORY_TEXT.theMidnightMasks.common]
      : STORY_TEXT[sc.id] || [sc.intro].filter(Boolean)
    sections.push({ title: sc.name, paragraphs: [...narrative] })
  }
  const paragraphs = []
  if (sc.id === 'theMidnightMasks') {
    if (Object.hasOwn(records, 'houseBurned')) paragraphs.push(records.houseBurned
      ? '你的家已在大火中毁去。小队从河岸城重新出发，追查城中的异教徒。'
      : '你的家得以保留。你们在这里整理上一夜的线索，准备展开追查。')
    if (records.ghoulPriestAlive) paragraphs.push('食尸鬼祭司仍然活着。昨夜的威胁没有结束，它可能再次出现在调查途中。')
  }
  if (sc.id === 'theDevourerBelow') {
    if (records.pastMidnight) paragraphs.push('午夜已经过去。你们匆忙奔向森林，每个人都必须随机弃掉两张起始手牌。')
    if (Array.isArray(records.cultistsEscaped)) paragraphs.push(records.cultistsEscaped.length
      ? `有 ${records.cultistsEscaped.length} 名异教徒逃脱了追查。仪式已经加快，开局额外放置 ${Math.floor((records.cultistsEscaped.length + 1) / 2)} 点毁灭。`
      : '所有异教徒都已被查明。你们掌握了线索，仪式不会因逃脱的异教徒而加速。')
    if (records.ghoulPriestAlive) paragraphs.push('食尸鬼祭司尚未被消灭，它的阴影仍笼罩着这次调查。')
  }
  if (paragraphs.length) sections.push({ title: '此前调查的影响', paragraphs })
  return { version: 3, title: sc.name, sections, paragraphs: sections.flatMap(s => s.paragraphs), code: sc.acts?.[0]?.originalCode || sc.acts?.[0]?.code }
}

// Upgrade old summary-only journals using records from the time of that visit.
function savedIntroduction(snapshot, sc, records, context = null) {
  if (snapshot?.version !== 3) return introduction(sc, records, context)
  // Some development saves received the current version marker while still
  // containing the former one-line Dunwich summary. Treat content, rather
  // than the marker alone, as the compatibility boundary.
  if (DUNWICH_STORY_TEXT.introductions[sc.id]) {
    const prose = Array.isArray(snapshot.paragraphs) ? snapshot.paragraphs.join('').trim() : ''
    if (prose.length <= String(sc.intro || '').trim().length + 20) return introduction(sc, records, context)
  }
  if (CARCOSA_IDS.has(sc.id)) {
    const prose = Array.isArray(snapshot.paragraphs) ? snapshot.paragraphs.join('').trim() : ''
    if (prose.length <= String(sc.intro || '').trim().length + 20) return introduction(sc, records, context)
  }
  if (TFA_IDS.has(sc.id)) {
    const prose = Array.isArray(snapshot.paragraphs) ? snapshot.paragraphs.join('').trim() : ''
    if (prose.length <= String(sc.intro || '').trim().length + 20) return introduction(sc, records, context)
  }
  return snapshot
}

function reachedResolutionBranch(sc, key, context) {
  if (key !== 'noResolution') return key
  if (sc.id === 'theHouseAlwaysWins') return 'r1'
  if (sc.id === 'theEssexCountyExpress') return 'r2'
  if (sc.id === 'undimensionedAndUnseen') return 'r1'
  if (sc.id === 'whereDoomAwaits') return 'r2'
  if (sc.id === 'lostInTimeAndSpace') {
    if (Number.isInteger(context?.actIndex)) return context.actIndex === 3 ? 'r2' : 'r4'
    if (context?.recordsAfter) {
      return context.recordsAfter.yogSothothToreApartTheBarrierBetweenWorldsAndBecameOneWithAllReality ? 'r4' : 'r2'
    }
  }
  if (sc.id === 'theLastKing') return (context?.investigators || []).some(inv => inv.resigned) ? 'r1' : 'r2'
  if (sc.id === 'echoesOfThePast') return 'r4'
  if (sc.id === 'blackStarsRise') return 'r3'
  if (sc.id === 'dimCarcosa') {
    const records = context?.records || context?.recordsAfter || {}
    return Number(records.conviction || 0) >= Number(records.doubt || 0) ? 'r4' : 'r5'
  }
  if (sc.id === 'theUnspeakableOath') return 'r1'
  return key
}

function defeatedPrelude(sc, key, context) {
  const defeated = key === 'noResolution' || (context?.investigators || []).some(inv => inv.defeated)
  if (!defeated) return []
  if (sc.id === 'theEssexCountyExpress') {
    return DUNWICH_STORY_TEXT.resolutions.theEssexCountyExpress.noResolution.slice(0, -1)
  }
  if (sc.id === 'lostInTimeAndSpace') {
    return DUNWICH_STORY_TEXT.resolutions.lostInTimeAndSpace.noResolution.slice(0, -2)
  }
  return []
}

export function resolutionStory(sc, key, snapshot = null, context = null) {
  // Midnight Masks explicitly routes all-resigned/defeated to resolution 1.
  const routed = sc.id === 'theMidnightMasks' && key === 'noResolution' ? 'r1' : key
  let branch = reachedResolutionBranch(sc, routed, context)
  const savedBranch = snapshot?.version === 3 && key === 'noResolution'
    ? snapshot.title?.match(/^结局 (\d+)$/)?.[1]
    : null
  if (savedBranch) branch = `r${savedBranch}`
  const title = /^r\d+$/.test(branch) ? '结局 ' + branch.slice(1) : '未达成结局'
  const prelude = branch === 'noResolution' ? [] : defeatedPrelude(sc, key, context)
  const snapshotHasPrelude = !prelude.length
    || prelude.every(paragraph => snapshot?.paragraphs?.includes(paragraph))
  if (snapshot?.version === 3 && snapshot.title === title && snapshotHasPrelude) return snapshot
  let paragraphs = DUNWICH_STORY_TEXT.resolutions?.[sc.id]?.[branch]
    || STORY_TEXT.resolutions?.[sc.id]?.[branch]
    || CARCOSA_STORY_TEXT.resolutions?.[sc.id]?.[branch]
    || TFA_STORY_TEXT.resolutions?.[sc.id]?.[branch]
    || snapshot?.paragraphs || [sc.resolutions?.[key]].filter(Boolean)
  if (prelude.length) paragraphs = [...prelude, ...paragraphs]
  if (sc.id === 'theUnspeakableOath') {
    const defeated = (context?.investigators || []).some(inv => inv.defeated)
    if (key === 'noResolution' || defeated) {
      paragraphs = [...(CARCOSA_STORY_TEXT.resolutions.theUnspeakableOath.noResolution || []), ...paragraphs]
    }
  }
  return { version: 3, title, paragraphs: [...paragraphs] }
}

export function campaignStory(state, registry, observerSeat = null) {
  const campaign = state.campaign, entries = [], history = campaign.flow?.history || []
  for (const result of campaign.scenarioResults || []) {
    const sc = registry.getScenarioData(result.scenarioId)
    if (!sc) continue
    const id = result.visitId || `${result.scenarioId}:${result.scenarioIndex}`
    const order = history.findIndex(v => `${v.nodeId}:${v.visit}` === result.visitId)
    const base = order < 0 ? (result.scenarioIndex || 0)*3 : order*3
    entries.push({ _order:base, id: id + ':intro', kind: 'intro', scenarioId: sc.id, visitId: id,
      ...savedIntroduction(result.introStory, sc, result.recordsBefore, { investigators: result.investigators }) })
    const story = resolutionStory(sc, result.storyResolution || result.resolution, result.story, {
      records: result.recordsBefore,
      recordsAfter: result.recordsAfter,
      investigators: result.investigators,
    })
    entries.push({ id: id + ':result', kind: 'result', scenarioId: sc.id, visitId: id, title: sc.name,
      paragraphs: story.paragraphs, resolutionTitle: story.title,
      _order:base+1, resolution: result.resolution, victory: result.victory, rounds: result.rounds,
      investigators: (result.investigators || []).map(({seat,code,xpAwarded,traumaBefore,traumaAfter,status}) => ({seat,code,xpAwarded,traumaBefore,traumaAfter,status})),
      records: Object.fromEntries(Object.entries(result.recordsAfter || {}).filter(([key,value]) => JSON.stringify(value) !== JSON.stringify(result.recordsBefore?.[key]))) })
  }
  // Flow text is recorded when a node is actually entered, including a paused choice.
  for (const [index, visit] of (campaign.flow?.history || []).entries()) {
    // The Dunwich prologue is folded into the chosen first scenario so it is
    // available before the route choice and never appears twice afterward.
    if (campaign.id === 'theDunwichLegacy' && visit.nodeId === 'prologue') continue
    if (campaign.id === 'thePathToCarcosa' && ['prologue', 'possessedEpilogue'].includes(visit.nodeId)) continue
    const expanded = dunwichFlowStory(visit.nodeId, campaign) || carcosaFlowStory(visit, campaign)
      || tfaFlowStory(visit, campaign)
    if (expanded || visit.storyText) entries.push({ _order:index*3-1, id: `flow:${index}`, kind: 'interlude',
      nodeId: visit.nodeId,
      title: expanded?.title || visit.storyTitle || '调查纪事', paragraphs: expanded?.paragraphs || [visit.storyText] })
  }
  const observerId = Number.isInteger(observerSeat)
    ? [...Object.values(campaign.investigators || {}), ...(campaign.retired || [])]
      .find(record => record.seat === observerSeat)?.id
    : null
  if (observerId) {
    for (const [index, story] of (campaign.privateStories || []).entries()) {
      if (!story.audienceInvestigatorIds?.includes(observerId)) continue
      entries.push({
        _order: history.length * 3 + index,
        id: `private:${story.id}:${index}`,
        kind: 'interlude',
        title: story.title || '秘密故事',
        paragraphs: String(story.text || '').split(/\n{2,}/).filter(Boolean),
      })
    }
  }
  entries.sort((a,b)=>a._order-b._order)
  entries.forEach(entry=>{delete entry._order})
  const id = state.hubSelectedScenarioId || state.scenario?.id
  const restNode = registry.getCampaign(campaign.id)?.flow?.nodes?.[campaign.flow?.nodeId]
  const nextNode = registry.getCampaign(campaign.id)?.flow?.nodes?.[restNode?.next]
  const upcomingIntro = state.uiState === 'interlude' && ['interlude', 'checkpoint'].includes(restNode?.type)
    && nextNode?.type === 'scenario' && nextNode.scenarioId === id
  let current = null
  if (id && !campaign.finished && !campaign.failed && (upcomingIntro || !['scenarioResult','campaignResult','interlude'].includes(state.uiState))) {
    const sc = registry.getScenarioData(id)
    if (sc) {
      const snapshot = ['inScenario',undefined].includes(state.uiState) && state.scenario?.id === id ? state.scenarioIntro : null
      current = { id: `current:${id}`, kind: 'intro', scenarioId: id,
        ...savedIntroduction(snapshot, sc, campaign.records, state) }
      entries.push(current)
    }
  }
  return { entries, currentId: current?.id || entries.at(-1)?.id || null }
}
