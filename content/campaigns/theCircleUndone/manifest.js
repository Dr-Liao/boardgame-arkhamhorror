// 万象无终（The Circle Undone）· 战役清单（P10：三组确认 + 大厅入口 + 逐卡账本，战役已开放）。
//
// 状态口径：
//   · 9 章在 P8 升到 `development`，P10 验收后升 `playable`（可从大厅启动）；
//   · P9 接上 `flow`（序章 → 9 章 → 幕间二/三/四 → 尾声 → 结束）、剧情分支与结局选择；
//   · P9.1 补齐关间升级窗：叙事幕间（二/三/四）只作阅读停顿（`upgrades: false`），升级窗统一放在
//     下一场冒险之前（参见 flow 顶部注释与参考实现 nextStep 的 canUpgradeDecks）；
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
    // 关间升级窗（`interlude` 节点、无正文）的排布口径＝参考实现 nextStep 的 canUpgradeDecks：
    // 每场冒险结算后、下一场冒险开始前各有一次升级机会；序章后是 `continueNoUpgrade`（序章不给
    // 经验），所以《巫异时刻》前没有这个窗口。旧实现只在叙事幕间二/三/四开窗，巫异时刻→死亡门前、
    // 隐秘之名→恶罪报应、恶罪报应→崇高利益、聚合幻灭→混沌魔掌都直接落到下一关准备，经验花不出去
    // （2026-11-17 用户实测：巫异时刻结束后直接进入死亡门前准备）。
    theWitchingHour: { type: 'scenario', scenarioId: 'theWitchingHour', next: 'restAfterWitchingHour' },
    restAfterWitchingHour: { type: 'interlude', title: '返回阿卡姆', next: 'atDeathsDoorstep' },
    atDeathsDoorstep: { type: 'scenario', scenarioId: 'atDeathsDoorstep', next: 'interludeTwoGate' },
    // 幕间二只在《死亡门前》结局 1（逃出幽灵国度）后阅读；结局 2/3 直接进入升级窗。
    interludeTwoGate: {
      type: 'branch',
      options: [
        { id: 'escaped', when: resolutionOf('atDeathsDoorstep', 'r1'), next: 'interludeTwo' },
        { id: 'skipped', when: { not: resolutionOf('atDeathsDoorstep', 'r1') }, next: 'restBeforeTheSecretName' },
      ],
    },
    // 幕间二是叙事停顿窗（`upgrades: false`）：先读完正文/做完三选一，再在下一关前集中升级
    // （参考实现：ATD 结局 1 → InterludeStep 2；幕间读完后的 nextStep 才带升级窗）。
    interludeTwo: { type: 'interlude', upgrades: false, title: storyline.interludeTwo.title, next: 'interludeTwoFate' },
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
      next: 'restBeforeTheSecretName',
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
      type: 'story', title: storyline.interludeTwo.title, text: interludeTwoResponse.refuse.text, next: 'restBeforeTheSecretName',
    },
    interludeTwoAgreed: {
      type: 'story', title: storyline.interludeTwo.title, text: interludeTwoResponse.agree.text, next: 'restBeforeTheSecretName',
    },
    interludeTwoLied: {
      type: 'story', title: storyline.interludeTwo.title, text: interludeTwoResponse.lie.text, next: 'restBeforeTheSecretName',
    },
    // 幕间二所有出口（含跳过）汇合到同一个升级窗，再进入《隐秘之名》。
    restBeforeTheSecretName: { type: 'interlude', title: '调查间隙', next: 'theSecretName' },
    theSecretName: { type: 'scenario', scenarioId: 'theSecretName', next: 'restBeforeTheWagesOfSin' },
    restBeforeTheWagesOfSin: { type: 'interlude', title: '继续追查', next: 'theWagesOfSin' },
    theWagesOfSin: { type: 'scenario', scenarioId: 'theWagesOfSin', next: 'restBeforeForTheGreaterGood' },
    restBeforeForTheGreaterGood: { type: 'interlude', title: '秘社的集会', next: 'forTheGreaterGood' },
    forTheGreaterGood: { type: 'scenario', scenarioId: 'forTheGreaterGood', next: 'interludeThreeGate' },
    // 幕间三只在《崇高利益》结局 1（拿走机关盒、被邀请）后阅读；其余结局直接进入升级窗。
    interludeThreeGate: {
      type: 'branch',
      options: [
        { id: 'inducted', when: resolutionOf('forTheGreaterGood', 'r1'), next: 'interludeThree' },
        { id: 'skipped', when: { not: resolutionOf('forTheGreaterGood', 'r1') }, next: 'restBeforeUnionAndDisillusion' },
      ],
    },
    // 幕间三同为叙事停顿窗：正文/问答结束后在《聚合幻灭》前统一开升级窗。
    interludeThree: {
      type: 'interlude',
      upgrades: false,
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
      next: 'restBeforeUnionAndDisillusion',
    },
    interludeThreeNotInducted: {
      type: 'story',
      title: storyline.interludeThree.title,
      text: interludeThreeNarrative.notInducted,
      next: 'restBeforeUnionAndDisillusion',
    },
    interludeThreeLie: {
      type: 'story',
      title: storyline.interludeThree.title,
      text: interludeThreeNarrative.lie,
      effects: [{ type: 'record', key: 'theInvestigatorsKeptsTheirMementosHidden', value: true }],
      next: 'restBeforeUnionAndDisillusion',
    },
    // 幕间三两条出口（含跳过）汇合到同一个升级窗，再进入《聚合幻灭》。
    restBeforeUnionAndDisillusion: { type: 'interlude', title: '前往未访之岛', next: 'unionAndDisillusion' },
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
          next: 'restBeforeInTheClutchesOfChaos',
        },
      ],
    },
    restBeforeInTheClutchesOfChaos: { type: 'interlude', title: '阿卡姆的异变', next: 'inTheClutchesOfChaos' },
    inTheClutchesOfChaos: {
      type: 'scenario', scenarioId: 'inTheClutchesOfChaos', next: 'interludeFour',
    },
    // 幕间四是叙事停顿窗：先读「扭转命运」正文并结算计数，再在《黑色王座》前开升级窗
    // （参考实现：ICC 之后是 InterludeStep 4；幕间读完后的 nextStep 才带升级窗）。
    interludeFour: {
      type: 'interlude',
      upgrades: false,
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
      next: 'restBeforeBlackThrone',
    },
    restBeforeBlackThrone: { type: 'interlude', title: '最后的准备', next: 'beforeTheBlackThrone' },
    beforeTheBlackThrone: { type: 'scenario', scenarioId: 'beforeTheBlackThrone', next: 'epilogue' },
    // 尾声：正文按实际结局与记录组装（tcuFlowStory），节点本身只保留标题。
    epilogue: { type: 'story', title: storyline.epilogue.title, next: 'end' },
    end: { type: 'end' },
  },
}

export const manifest = {
  schemaVersion: CONTENT_SCHEMA_VERSION,
  id: 'theCircleUndone',
  epilogueCrossOutRecords: ['theInvestigatorsSurvivedTheWatchersEmbrace'],
  name: '万象无终',
  nameEn: 'The Circle Undone',
  contentVersion: CONTENT_VERSION,
  minRulesVersion: MIN_RULES_VERSION,
  status: 'playable',
  requiredPackIds: ['core', 'tcuCampaign', 'tcuInvestigators', 'tcuPlayer'],
  // 批次 2：关间可插入的独立支线（每人支付 cost 经验；结算后回到原定下一章）。
  sideStories: [
    { campaignId: 'curseOfTheRougarou', cost: 1 },
    { campaignId: 'carnevaleOfHorrors', cost: 3 },
    { campaignId: 'murderAtTheExcelsiorHotel', cost: 3 },
  ],
  scenarioIds: chapters.map(chapter => chapter.id),
  // 线性解锁：9 章按流程顺序，前一章解锁后一章。战役未启动，所以只是数据。
  unlock: Object.fromEntries(chapters.map((chapter, index) =>
    [chapter.id, index ? [chapters[index - 1].id] : []])),
  chaosBags: CHAOS_BAGS,
  recordSchema: recordTypes,
  recordDefaults,
  recordLabels: RECORD_LABELS,
  mementoLabels: MEMENTO_LABELS,
  // 战役奖赏卡（卡面写明「不计入牌组张数」）：新获取时由 campaignCardChange(..., { deckSlot: false })
  // 直接写进调查员记录的 `campaignCards`；这张表只给存档迁移回填旧存档（三选一模式的 30 张
  // 牌组校验/补牌必须扣掉它们，否则《巫异时刻》介绍给的权杖王牌会把牌组顶成 31 张）。
  grantedDeckCards: ['05040'],
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
