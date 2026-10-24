// 万象无终（The Circle Undone）· 战役清单（P10：三组确认 + 大厅入口 + 逐卡账本，战役已开放）。
//
// 状态口径：
//   · 9 章在 P8 升到 `development`，P10 验收后升 `playable`（可从大厅启动）；
//   · P9 接上 `flow`（序章 → 9 章 → 幕间二/三/四 → 尾声 → 结束）、剧情分支与结局选择；
//   · P10 后战役为 `playable`：`assertLaunchableCampaign('theCircleUndone')` 通过，
//     发布级证据（三组确认、逐卡账本、大厅→序章→章节实机路径）见 audit/tcu-migration.json；
//     未逐条等价的分支仍逐条列在 remaining，不宣称规则等价（equivalenceCertified=false）。
import { CONTENT_SCHEMA_VERSION } from '../../schema.js'
import { CHAOS_BAGS, CONTENT_VERSION, MIN_RULES_VERSION, chapters, recordDefaults, recordTypes } from './shared.js'
import { MEMENTO_LABELS, RECORD_LABELS } from './record-labels.js'
import { TCU_STORY_TEXT } from './story-text.js'
import {
  interludeFourEffect, interludeFourNarrative, interludeThreeLabels,
  interludeThreeNarrative, interludeThreeQuestionOptions, interludeTitle, interludeTwoBranch,
  interludeTwoLabels, interludeTwoResponse,
} from './interludes.js'

// P5 交互层沿用这两个导出：档案页与牌桌战役面板直接显示记录/遗留记忆的中文名，
// 不把内部键名暴露给玩家。P9 的剧情文本也读同一张表。
export const TCU_MEMENTO_LABELS = MEMENTO_LABELS
export { RECORD_LABELS }

// 幕间二/三的决策选项直接取自导入正文旁的选择标签（参考实现 base.json 的 label 段）。
const storyParagraphs = (...blocks) => blocks.flat().filter(Boolean).join('\n\n')

// 战役流程节点（纯 JSON，可随观察投影/客户端下发；conditions 见 src/campaign/campaign-flow.js）。
// 剧情正文一律来自 story-text.js（P9 生成物），节点只引用段落，不重复贴正文。
// 「死亡只是开始」的战役引文来自 base.prologue.body（P9 导入到 prologue.sections.quote）；
// 旧生成物没有 quote 时退回序章场景的 1925 正文，保证节点正文不为空。
const prologueQuote = TCU_STORY_TEXT.prologue?.sections?.quote || []
const prologueBody = TCU_STORY_TEXT.prologue?.sections?.body || []

const storyline = Object.freeze({
  prologue: {
    title: TCU_STORY_TEXT.prologue?.title || '序章',
    text: storyParagraphs(prologueQuote.length ? prologueQuote : prologueBody),
  },
  interludeTwo: { title: interludeTitle('interludeTwo') },
  interludeThree: { title: interludeTitle('interludeThree') },
  interludeFour: { title: interludeTitle('interludeFour') },
  epilogue: { title: TCU_STORY_TEXT.epilogue?.title || '尾声' },
})

const resolutionOf = (scenarioId, value) => ({ resolution: { scenarioId, value } })
const recordOf = (record, value = true) => ({ record, equals: value })

const flow = {
  start: 'prologue',
  nodes: {
    // 序章：先读战役序章正文，再进入《暮色庄园失踪事件》。
    // 4 位故事调查员的选人、22 张塔罗与失踪人口记录由该章 setup 结算（P2.6/P8），
    // 每位角色的独立引言与抽到的塔罗结果作为座位级私密正文写进 campaign.privateStories。
    prologue: { type: 'story', ...storyline.prologue, next: 'disappearanceAtTheTwilightEstate' },
    disappearanceAtTheTwilightEstate: {
      type: 'scenario', scenarioId: 'disappearanceAtTheTwilightEstate', next: 'theWitchingHour',
    },
    theWitchingHour: { type: 'scenario', scenarioId: 'theWitchingHour', next: 'atDeathsDoorstep' },
    atDeathsDoorstep: { type: 'scenario', scenarioId: 'atDeathsDoorstep', next: 'interludeTwoGate' },
    // 幕间二只在《死亡门前》结局 1（逃出幽灵国度）后阅读；结局 2/3 直接进入《隐秘之名》。
    interludeTwoGate: {
      type: 'branch',
      options: [
        { id: 'escaped', when: resolutionOf('atDeathsDoorstep', 'r1'), next: 'interludeTwo' },
        { id: 'skipped', when: { not: resolutionOf('atDeathsDoorstep', 'r1') }, next: 'theSecretName' },
      ],
    },
    interludeTwo: { type: 'interlude', title: storyline.interludeTwo.title, next: 'interludeTwoFate' },
    // 幕间二的分支取决于约瑟夫·梅吉尔的结局（《死亡门前》结局 1 时已按区域落定为三条记录之一）。
    interludeTwoFate: {
      type: 'branch',
      options: [
        { id: 'gone', when: recordOf('josefDisappearedIntoTheMist'), next: 'interludeTwoGone' },
        { id: 'rescued', when: recordOf('theInvestigatorsRescuedJosef'), next: 'interludeTwoRescued' },
        {
          id: 'alive',
          when: {
            all: [
              { not: recordOf('josefDisappearedIntoTheMist') },
              { not: recordOf('theInvestigatorsRescuedJosef') },
            ],
          },
          next: 'interludeTwoAlive',
        },
      ],
    },
    interludeTwoGone: {
      type: 'story',
      title: storyline.interludeTwo.title,
      text: interludeTwoBranch.gone.text,
      effects: [
        { type: 'record', key: 'josefDisappearedIntoTheMist', value: true },
        { type: 'record', key: 'theInvestigatorsAreEnemiesOfTheLodge', value: true },
      ],
      next: 'theSecretName',
    },
    interludeTwoRescued: {
      type: 'story',
      title: storyline.interludeTwo.title,
      text: interludeTwoBranch.rescued.text,
      effects: [
        { type: 'record', key: 'theInvestigatorsRescuedJosef', value: true },
        { type: 'experience', amount: 2 },
      ],
      next: 'interludeTwoDecision',
    },
    interludeTwoAlive: {
      type: 'story',
      title: storyline.interludeTwo.title,
      text: interludeTwoBranch.alive.text,
      effects: [{ type: 'record', key: 'josefIsAliveAndWell', value: true }],
      next: 'interludeTwoDecision',
    },
    // 秘社的邀请：拒绝 / 同意 / 撒谎（参考实现 thePriceOfProgress7/8/9）。
    interludeTwoDecision: {
      type: 'choice',
      title: storyline.interludeTwo.title,
      prompt: '卡尔·桑福德向你们伸出手。你们如何回应？',
      options: [
        {
          id: 'refuse',
          label: interludeTwoLabels().refuse || '拒绝参与',
          effects: [{ type: 'record', key: 'theInvestigatorsAreEnemiesOfTheLodge', value: true }],
          next: 'interludeTwoRefused',
        },
        {
          id: 'agree',
          label: interludeTwoLabels().agree || '同意',
          effects: [
            { type: 'record', key: 'theInvestigatorsAreMembersOfTheLodge', value: true },
            { type: 'chaos', token: 'cultist', amount: 1 },
          ],
          next: 'interludeTwoAgreed',
        },
        {
          id: 'lie',
          label: interludeTwoLabels().lie || '撒谎',
          effects: [
            { type: 'record', key: 'theInvestigatorsAreMembersOfTheLodge', value: true },
            { type: 'record', key: 'theInvestigatorsAreDeceivingTheLodge', value: true },
            { type: 'chaos', token: 'cultist', amount: 1 },
          ],
          next: 'interludeTwoLied',
        },
      ],
    },
    interludeTwoRefused: {
      type: 'story', title: storyline.interludeTwo.title, text: interludeTwoResponse.refuse.text, next: 'theSecretName',
    },
    interludeTwoAgreed: {
      type: 'story', title: storyline.interludeTwo.title, text: interludeTwoResponse.agree.text, next: 'theSecretName',
    },
    interludeTwoLied: {
      type: 'story', title: storyline.interludeTwo.title, text: interludeTwoResponse.lie.text, next: 'theSecretName',
    },
    theSecretName: { type: 'scenario', scenarioId: 'theSecretName', next: 'theWagesOfSin' },
    theWagesOfSin: { type: 'scenario', scenarioId: 'theWagesOfSin', next: 'forTheGreaterGood' },
    forTheGreaterGood: { type: 'scenario', scenarioId: 'forTheGreaterGood', next: 'interludeThreeGate' },
    // 幕间三只在《崇高利益》结局 1（拿走机关盒、被邀请）后阅读。
    interludeThreeGate: {
      type: 'branch',
      options: [
        { id: 'inducted', when: resolutionOf('forTheGreaterGood', 'r1'), next: 'interludeThree' },
        { id: 'skipped', when: { not: resolutionOf('forTheGreaterGood', 'r1') }, next: 'unionAndDisillusion' },
      ],
    },
    interludeThree: {
      type: 'interlude',
      title: storyline.interludeThree.title,
      text: interludeThreeNarrative.opening,
      next: 'interludeThreeDecision',
    },
    interludeThreeDecision: {
      type: 'choice',
      title: storyline.interludeThree.title,
      prompt: '桑福德要求你们交出找到的一切。你们如何回答？',
      options: [
        {
          id: 'truth',
          label: interludeThreeLabels().truth || '把发现交给他',
          next: 'interludeThreeTruth',
        },
        {
          id: 'lie',
          label: interludeThreeLabels().lie || '告诉他什么都没找到（撒谎）',
          next: 'interludeThreeLie',
        },
      ],
    },
    interludeThreeTruth: {
      type: 'story',
      title: storyline.interludeThree.title,
      text: interludeThreeNarrative.truth,
      // 「划掉剧本日志中「遗留记忆」下方的所有条目」。
      effects: [{ type: 'crossOffMementos', labels: MEMENTO_LABELS }],
      next: 'interludeThreeTruthGate',
    },
    interludeThreeTruthGate: {
      type: 'branch',
      options: [
        {
          id: 'innerCircle',
          when: {
            all: [
              recordOf('theInvestigatorsRescuedJosef'),
              recordOf('theInvestigatorsToldTheLodgeAboutTheCoven'),
            ],
          },
          next: 'interludeThreeInnerCircle',
        },
        {
          id: 'otherwise',
          when: {
            not: {
              all: [
                recordOf('theInvestigatorsRescuedJosef'),
                recordOf('theInvestigatorsToldTheLodgeAboutTheCoven'),
              ],
            },
          },
          next: 'interludeThreeNotInducted',
        },
      ],
    },
    // 核心圈四：最多问桑福德 3 个问题（纯叙事，无规则后果）。
    interludeThreeInnerCircle: {
      type: 'story',
      title: storyline.interludeThree.title,
      text: interludeThreeNarrative.innerCircle,
      effects: [{
        type: 'storyQuestions',
        id: 'interludeThreeInnerCircle',
        max: 3,
        prompt: '在桑福德的耐心耗尽之前，选择你要问的问题。',
        doneLabel: interludeThreeLabels().done || '问完了',
        questions: interludeThreeQuestionOptions(),
      }],
      next: 'interludeThreeInducted',
    },
    interludeThreeInducted: {
      type: 'story',
      title: storyline.interludeThree.title,
      text: interludeThreeNarrative.inducted,
      effects: [{ type: 'record', key: 'theInvestigatorsWereInductedIntoTheInnerCircle', value: true }],
      next: 'unionAndDisillusion',
    },
    interludeThreeNotInducted: {
      type: 'story',
      title: storyline.interludeThree.title,
      text: interludeThreeNarrative.notInducted,
      next: 'unionAndDisillusion',
    },
    interludeThreeLie: {
      type: 'story',
      title: storyline.interludeThree.title,
      text: interludeThreeNarrative.lie,
      effects: [{ type: 'record', key: 'theInvestigatorsKeptsTheirMementosHidden', value: true }],
      next: 'unionAndDisillusion',
    },
    unionAndDisillusion: {
      type: 'scenario', scenarioId: 'unionAndDisillusion', next: 'unionEndingGate',
    },
    // 《聚合幻灭》结局 2/9 是战役终点（秘社 / 女巫集会赢得战役）；其余结局继续《混沌魔掌》。
    unionEndingGate: {
      type: 'branch',
      options: [
        {
          id: 'ended',
          when: { any: [resolutionOf('unionAndDisillusion', 'r2'), resolutionOf('unionAndDisillusion', 'r9')] },
          next: 'end',
        },
        {
          id: 'continued',
          when: {
            not: { any: [resolutionOf('unionAndDisillusion', 'r2'), resolutionOf('unionAndDisillusion', 'r9')] },
          },
          next: 'inTheClutchesOfChaos',
        },
      ],
    },
    inTheClutchesOfChaos: {
      type: 'scenario', scenarioId: 'inTheClutchesOfChaos', next: 'interludeFour',
    },
    interludeFour: {
      type: 'interlude',
      title: storyline.interludeFour.title,
      text: interludeFourNarrative.opening,
      // 「你面前的道路蜿蜒曲折」计数 + 请求帮助时的混乱袋增删（campaign-effects 的 twistOfFate）。
      effects: [interludeFourEffect()],
      next: 'interludeFourOutro',
    },
    interludeFourOutro: {
      type: 'story',
      title: storyline.interludeFour.title,
      text: interludeFourNarrative.outro,
      next: 'beforeTheBlackThrone',
    },
    beforeTheBlackThrone: { type: 'scenario', scenarioId: 'beforeTheBlackThrone', next: 'epilogue' },
    // 尾声：正文按实际结局与记录组装（tcuFlowStory），节点本身只保留标题。
    epilogue: { type: 'story', title: storyline.epilogue.title, next: 'end' },
    end: { type: 'end' },
  },
}

export const manifest = {
  schemaVersion: CONTENT_SCHEMA_VERSION,
  id: 'theCircleUndone',
  name: '万象无终',
  nameEn: 'The Circle Undone',
  contentVersion: CONTENT_VERSION,
  minRulesVersion: MIN_RULES_VERSION,
  status: 'playable',
  requiredPackIds: ['core', 'tcuCampaign', 'tcuInvestigators', 'tcuPlayer'],
  scenarioIds: chapters.map(chapter => chapter.id),
  // 线性解锁：9 章按流程顺序，前一章解锁后一章。战役未启动，所以只是数据。
  unlock: Object.fromEntries(chapters.map((chapter, index) =>
    [chapter.id, index ? [chapters[index - 1].id] : []])),
  chaosBags: CHAOS_BAGS,
  recordSchema: recordTypes,
  recordDefaults,
  recordLabels: RECORD_LABELS,
  mementoLabels: MEMENTO_LABELS,
  // 幕间处理器：P9 起幕间二/三/四由 flow 节点 + campaign-effects 结算（见 interludes.js）。
  interludeHandlerId: 'tcuInterlude',
  resolutionIds: ['defeat', 'victory'],
  // 战役结局：参考实现 Campaigns/TheCircleUndone 的 Key.hs；按顺序匹配剧本日志，
  // 第一个命中的记录即战役结局。顺序口径：先列「末章/章节终局」的具体结局，再把中途失败记录放最后，
  // 避免中途的「调查员音讯全无」盖过最终结局。
  endings: [
    { id: 'azathothDevouredTheUniverse', label: '结局：阿撒托斯吞食宇宙', record: 'azathothDevouredTheUniverse' },
    { id: 'joinedThePipers', label: '结局：加入阿撒托斯的吹笛人', record: 'theLeadInvestigatorHasJoinedThePipersOfAzathoth' },
    { id: 'signedTheBlackBook', label: '结局：在阿撒托斯的黑书上签名', record: 'theInvestigatorsSignedTheBlackBookOfAzathoth' },
    { id: 'reversedTheIncantation', label: '结局：逆转咒语', record: 'theInvestigatorsReversedTheIncantation' },
    { id: 'azathothSlumbersForNow', label: '结局：阿撒托斯沉睡', record: 'azathothSlumbersForNow' },
    { id: 'covenHoldsTheWorld', label: '结局：女巫集会掌控世界', record: 'theCovenOfKeziahHoldsTheWorldInItsGrasp' },
    { id: 'lodgeHoldsTheWorld', label: '结局：银暮秘社掌控世界', record: 'theTrueWorkOfTheSilverTwilightLodgeHasBegun' },
    { id: 'neverSeenOrHeardFromAgain', label: '结局：调查员音讯全无', record: 'theInvestigatorsAreNeverSeenOrHeardFromAgain' },
  ],
  // 战役流程（P9 接线）：序章 → 9 章 → 幕间二/三/四 → 尾声 → 结束；
  // 幕间与章节分支都走 campaign-flow 的声明式条件（记录 / 剧本结局），不在引擎里写战役名。
  flow,
}
