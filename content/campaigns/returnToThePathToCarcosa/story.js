// 「重返卡尔克萨之路」章节导入正文（中英剧情正文沿用基础战役的同一份内容）。
//
// 基础战役的叙事正文由 `src/campaign/story.js` 的 `carcosaIntroduction()` 按**基础章节 id**
// 投影；重返章节的 id 是 `returnToXxx`，因此那套分支不会命中。章节 behavior 的
// `introduction` 钩子（引擎读点：`src/engine/setup.js` → `introduction()`）是内容层的
// 正规扩展点：这里把基础章节的正文按同一份 `CARCOSA_STORY_TEXT` 重新投影，保证
// 基础/重返两套战役的导入正文只有一处事实源，且分支条件（访谈记录、梦境日志、
// 上关结局）与基础章节完全一致。
import { CARCOSA_STORY_TEXT } from '../thePathToCarcosa/story-text.js'
import { CARCOSA_STORY_ROLES } from '../thePathToCarcosa/story-roles.js'

const code = role => CARCOSA_STORY_ROLES[role] || null
const interviewed = (records, role) => (records.vipsInterviewed || []).includes(code(role))
const splitParagraphs = text => String(text || '').split(/\n{2,}/).map(part => part.trim()).filter(Boolean)

function campaignHasInvestigator(context, investigatorCode) {
  if (!investigatorCode) return false
  const records = Object.values(context?.campaign?.investigators || context?.investigators || {})
  return records.some(record => record?.code === investigatorCode)
}

function sectionsFor(baseId, records, context) {
  const source = CARCOSA_STORY_TEXT.introductions[baseId]
  if (!source) return null
  const sections = []
  const add = (title, paragraphs) => {
    if (paragraphs?.length) sections.push({ title, paragraphs: [...paragraphs] })
  }
  if (baseId === 'curtainCall') {
    add(CARCOSA_STORY_TEXT.prologue.epigraph.title, CARCOSA_STORY_TEXT.prologue.epigraph.paragraphs)
    add(`战役序章 · ${CARCOSA_STORY_TEXT.prologue.title}`, CARCOSA_STORY_TEXT.prologue.common)
    if (campaignHasInvestigator(context, code('lola'))) add('萝拉的序幕', CARCOSA_STORY_TEXT.prologue.lola)
    add(source.title, source.common)
  } else if (baseId === 'echoesOfThePast') {
    add(source.title, source.common)
    if (interviewed(records, 'sebastiensInformation')) add('塞巴斯蒂安提供的信息', source.sebastiensInformation)
  } else if (baseId === 'theUnspeakableOath') {
    add(source.title, records.theFollowersOfTheSignHaveFoundTheWayForward
      ? source.foundTheWayForward : source.didNotFindTheWayForward)
    add(null, source.common)
    if (interviewed(records, 'constancesInformation')) add('康斯坦丝提供的信息', source.constancesInformation)
  } else if (baseId === 'aPhantomOfTruth') {
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
  } else if (baseId === 'thePallidMask') {
    add(source.title, records.youAwokeInsideTheCatacombs || records.youDidNotEscapeTheGazeOfThePhantom
      || records.youWereUnableToFindNigel ? source.awokeInside : source.enteredOnYourOwn)
    if (interviewed(records, 'harukosInformation')) add('石丸春子提供的信息', source.harukosInformation)
  } else if (baseId === 'blackStarsRise') {
    add(source.title, source.common)
    if (interviewed(records, 'ashleighsInformation')) add('阿什莉提供的信息', source.ashleighsInformation)
  } else if (baseId === 'dimCarcosa') {
    add(source.title, records.youOpenedThePathBelow ? source.pathBelow : source.pathAbove)
  } else add(source.title, source.common)
  return sections
}

// 章节 behavior.introduction：签名与基础战役读点一致（(sc, records, context)）。
export function returnToIntroduction(baseId, extraSections = []) {
  return function introduction(sc, records = {}, context = null) {
    const sections = sectionsFor(baseId, records, context) || []
    if (extraSections.length) sections.push(...extraSections)
    if (!sections.length) sections.push({ title: sc.name, paragraphs: splitParagraphs(sc.intro) })
    return {
      version: 3, title: sc.name, sections,
      paragraphs: sections.flatMap(section => section.paragraphs),
      code: sc.acts?.[0]?.originalCode || sc.acts?.[0]?.code,
    }
  }
}

// 结局正文（`resolutionStory` 对重返章节 id 没有基础分支，走章节 `resolutions[key]`
// 的兜底路径；这里给出一段与基础结局等长的可读正文，完整剧情见指南）。
export function resolutionText(baseId, key) {
  const branch = CARCOSA_STORY_TEXT.resolutions?.[baseId]?.[key]
  return branch ? branch.join('\n\n') : null
}
