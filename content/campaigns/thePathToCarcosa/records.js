// 《卡尔克萨之路》战役记录的中文标签。
//
// 记录键由 manifest.recordSchema（shared.js 的 recordTypes）定义；这里给每个键配一个
// 面向玩家的中文名。缺失时大厅纪事、故事阅读器与 AI 剧情摘要只能退回显示原始键名
// （如 `youFoundNigelsHome`）。新增记录键时同步在这里补标签。
export const CARCOSA_RECORD_LABELS = Object.freeze({
  // 序幕 / 谢幕
  theStrangerIsOnToYou: '陌生人盯上了你们',
  chasingTheStranger: '追踪陌生人的进度',
  pallidMaskBearer: '苍白面具的携带者',
  youTriedToWarnThePolice: '你们曾试图警告警方',
  thePoliceAreSuspiciousOfYou: '警方怀疑你们',
  youChoseNotToGoToThePolice: '你们没有报警',
  doubt: '疑惑',
  conviction: '确信',

  // 最后的王者
  vipsInterviewed: '已会见的宾客',
  vipsSlain: '已遇害的宾客',
  youIntrudedOnASecretMeeting: '你们闯入了秘密聚会',
  youFledTheDinnerParty: '你们逃离了晚宴',
  youSlayedTheMonstersAtTheDinnerParty: '你们在晚宴上击杀了怪物',

  // 往事回声
  youTookTheOnyxClasp: '你们拿走了缟玛瑙扣环',
  youLeftTheOnyxClaspBehind: '你们留下了缟玛瑙扣环',
  youDestroyedTheOathspeaker: '你们摧毁了宣誓者',
  theFollowersOfTheSignHaveFoundTheWayForward: '印记的追随者找到了前进之路',

  // 不可言说的誓言
  theKingClaimedItsVictims: '国王夺走了它的祭品',
  theInvestigatorsWereAttackedAsTheyEscapedTheAsylum: '逃离疗养院时遭到袭击',
  theInvestigatorsEscapedTheAsylum: '你们逃出了疗养院',
  youIgnoredDanielsWarning: '你们无视了丹尼尔的警告',
  youHeadedDanielsWarning: '你们听从了丹尼尔的警告',
  danielStatus: '丹尼尔的状况',

  // 真相幻影
  youDidNotEscapeTheGazeOfThePhantom: '你们没能逃离幻影的凝视',
  youFoundNigelsHome: '你们找到了奈杰尔的家',
  youFoundNigelEngram: '你们找到了奈杰尔的记忆痕迹',
  youWereUnableToFindNigel: '你们没能找到奈杰尔',

  // 苍白面具
  youAwokeInsideTheCatacombs: '你们在墓穴中醒来',
  youEnteredTheCatacombsOnYourOwn: '你们自行进入了墓穴',
  youKnowTheSiteOfTheGate: '你们知道门扉的位置',
  readActII: '已读《黄衣之王》第二幕',

  // 黑星升起
  youOpenedThePathBelow: '你们开启了下方之路',
  youOpenedThePathAbove: '你们开启了上方之路',

  // 卡城幽影
  theRealmOfCarcosaMergedWithOurOwnAndHasturRulesOverThemBoth: '卡尔克萨与我们的世界融合，哈斯塔统治二者',
  theInvestigatorsPreventedHasturFromEscapingHisPrison: '你们阻止了哈斯塔逃离囚牢',
  hasturHasYouInHisGrasp: '哈斯塔将你们握在掌心',
  possessed: '被附身者',
  knowTheSecret: '知晓了卡尔克萨的秘密',
})
