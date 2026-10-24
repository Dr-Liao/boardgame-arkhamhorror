// 万象无终（The Circle Undone）· 三段幕间（幕间二/三/四）的叙事与结算数据。
//
// 正文的唯一事实源是 P9 生成物 `story-text.js`（由 tools/import-tcu-story.mjs 从随仓库保存的
// 中文参考资源生成）；本文件只描述「读哪一段、按什么顺序、结算什么」，不复制正文、不读参考资源。
//
// 幕间一《失者名录》不是独立流程节点（路线图 §2.1 / §7.6）：它在《死亡门前》结算时按失踪人口
// 的 trail 记录逐个阅读，因此本文件只提供 `interludeOneNarrative` 供该章 behavior 读取。
import { TCU_STORY_TEXT } from './story-text.js'

const interlude = name => TCU_STORY_TEXT.interludes?.[name] || { title: name, sections: {}, labels: {} }

// 取若干来源段落的可读文本（段间空行）；缺失的键直接跳过，不抛错。
export function interludeText(name, ...keys) {
  const source = interlude(name)
  return keys
    .flatMap(key => source.sections?.[key] || [])
    .filter(Boolean)
    .join('\n\n')
}

export function interludeSection(name, key) {
  return [...(interlude(name).sections?.[key] || [])]
}

export function interludeTitle(name) {
  return interlude(name).title || name
}

export function interludeLabels(name) {
  return { ...(interlude(name).labels || {}) }
}

// ---------------------------------------------------------------------------
// 幕间一《失者名录》（A Record of Those Lost）
// ---------------------------------------------------------------------------
// 来源是 atDeathsDoorstep.json 顶层的 interlude1：instructions + 4 位失踪者的独立段落。
// 参考实现按「该失踪者未被划掉，且其最后出现地点已无线索」逐个阅读；P8 已在幕 1b 写 trail 记录，
// P9 把对应人物的正文补给该记录（见 scenarios/atDeathsDoorstep/behavior.js）。
export const interludeOneTitle = () => interludeTitle('interludeOne')
export const interludeOneInstructions = () => interludeText('interludeOne', 'instructions')
export function interludeOneNarrative(person) {
  return interludeText('interludeOne', person)
}

// ---------------------------------------------------------------------------
// 幕间二《进步的代价》（The Price of Progress）
// ---------------------------------------------------------------------------
// 参考实现 Campaigns/TheCircleUndone.hs:94-151：
//   · 开场：有调查员带「银暮秘社」特性读 1，否则读 2；随后读 3。
//   · 分支（按《死亡门前》结局 1 时 Josef/银暮秘社的所在区域）：4=约瑟夫消失 / 5=救出约瑟夫 / 6=约瑟夫安然无恙。
//   · 5/6 之后是秘社邀请的三选一（拒绝/同意/撒谎），对应正文 7/8/9。
const interludeTwo = name => interludeText('interludeTwo', name)
export const interludeTwoOpening = Object.freeze({
  silverTwilight: interludeTwo('thePriceOfProgress1'),
  ordinary: interludeTwo('thePriceOfProgress2'),
  common: interludeTwo('thePriceOfProgress3'),
})
export const interludeTwoBranch = Object.freeze({
  gone: { text: interludeTwo('thePriceOfProgress4') },
  rescued: { text: interludeTwo('thePriceOfProgress5') },
  alive: { text: interludeTwo('thePriceOfProgress6') },
})
export const interludeTwoResponse = Object.freeze({
  refuse: { text: interludeTwo('thePriceOfProgress7') },
  agree: { text: interludeTwo('thePriceOfProgress8') },
  lie: { text: interludeTwo('thePriceOfProgress9') },
})
export const interludeTwoLabels = () => interludeLabels('interludeTwo')
export const interludeTwoHuntedText = () => interludeTwo('youAreBeingHunted')

// ---------------------------------------------------------------------------
// 幕间三《核心圈》（The Inner Circle）
// ---------------------------------------------------------------------------
// 参考实现 Campaigns/TheCircleUndone.hs:152-199：
//   · 开场读 1，选择「把发现交给桑福德（truth）」或「撒谎（lie）」。
//   · truth 读 2：划掉所有已发现的遗留记忆；若（救出约瑟夫 && 告诉秘社女巫集会）读 4，否则读 5。
//   · 读 4 时最多问桑福德 3 个问题，之后读 6（记录「加入核心圈」）。
//   · lie 读 3，记录「隐瞒遗留记忆」。
const interludeThree = name => interludeText('interludeThree', name)
export const interludeThreeNarrative = Object.freeze({
  opening: interludeThree('theInnerCircle1'),
  truth: interludeThree('theInnerCircle2'),
  lie: interludeThree('theInnerCircle3'),
  innerCircle: interludeThree('theInnerCircle4'),
  notInducted: interludeThree('theInnerCircle5'),
  inducted: interludeThree('theInnerCircle6'),
})
export const interludeThreeLabels = () => interludeLabels('interludeThree')
// 6 个可问的问题：label 来自 base.interlude3.label，正文来自同名/近似名的来源段落。
export const interludeThreeQuestions = Object.freeze([
  { id: 'whatIsTheCreature', section: 'whatIsTheCreature' },
  { id: 'whatDoYouWantWithTheCreature', section: 'whatDoYouWantWithTheCreature' },
  { id: 'whatDoTheWitchesWantWithTheCreature', section: 'whatDoTheWitchesWantWithTheCreature' },
  { id: 'didYouKnowAboutTheCreature', section: 'didYouKnowAboutTheCreatureBeforeTheCharityGala' },
  { id: 'whereAreTheFourMissingPeople', section: 'whereAreTheFourMissingPeopleFromTheCharityGala' },
  { id: 'whyAreYouLookingAtMeLikeThat', section: 'whyAreYouLookingAtMeLikeThat' },
])

export function interludeThreeQuestionOptions() {
  const labels = interludeThreeLabels()
  return interludeThreeQuestions.map(entry => ({
    id: entry.id,
    label: labels[entry.id] || entry.id,
    text: interludeThree(entry.section),
  }))
}

// ---------------------------------------------------------------------------
// 幕间四《扭转命运》（Twist of Fate）
// ---------------------------------------------------------------------------
// 参考实现 Campaigns/TheCircleUndone.hs:200-312：统计「你面前的道路蜿蜒曲折」的数值，
// 并在请求安妮特/桑福德帮助时按难度加入混乱标记。统计项见 `interludeFourEffect()`。
const interludeFour = name => interludeText('interludeFour', name)
export const interludeFourNarrative = Object.freeze({
  opening: interludeFour('twistOfFate1'),
  outro: interludeFour('twistOfFate2'),
})

// 该效果由 src/campaign/campaign-effects.js 的 `twistOfFate` 分发器结算（通用读点）。
export function interludeFourEffect() {
  return {
    type: 'twistOfFate',
    record: 'thePathWindsBeforeYou',
    recordLabel: '你面前的道路蜿蜒曲折',
    conditions: [
      { record: 'youHaveAcceptedYourFate', amount: 1, label: '你接受了自己的命运' },
      { record: 'theInvestigatorsAskedAnetteForAssistance', amount: 2, label: '请求安妮特的帮助' },
      { record: 'theInvestigatorsAskedSanfordForAssistance', amount: 2, label: '请求桑福德的帮助' },
      { record: 'doomDrawsEverCloser', amount: 2, label: '末日渐近' },
    ],
    mementos: {
      record: 'mementosDiscovered',
      thresholds: [
        { atLeast: 3, amount: 1, label: '至少 3 个遗留记忆' },
        { atLeast: 6, amount: 1, label: '至少 6 个遗留记忆' },
        { atLeast: 9, amount: 1, label: '至少 9 个遗留记忆' },
      ],
    },
    // 「拥有黑书」= 任一位在役调查员的战役牌组里有黑书（05150，参考 isJust <$> getOwner theBlackBook）。
    cards: [{ code: '05150', amount: 1, label: '持有黑书' }],
    // 请求安妮特或桑福德帮助：按难度在混乱袋加入一个负值标记（参考代码 -3/-4/-5/-6）。
    chaosIf: [{
      records: ['theInvestigatorsAskedAnetteForAssistance', 'theInvestigatorsAskedSanfordForAssistance'],
      tokenByDifficulty: { easy: '-3', standard: '-4', hard: '-5', expert: '-6' },
    }],
  }
}
