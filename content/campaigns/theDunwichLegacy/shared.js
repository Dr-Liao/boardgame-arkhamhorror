// Source: Arkham/Campaigns/TheDunwichLegacy/ChaosBag.hs (original campaign).
// No tablet or elder-thing token is present until a resolution adds one.
export const CHAOS_BAGS = {
  easy: ['+1', '+1', '0', '0', '0', '-1', '-1', '-1', '-2', '-2', 'skull', 'skull', 'cultist', 'autofail', 'eldersign'],
  standard: ['+1', '0', '0', '-1', '-1', '-1', '-2', '-2', '-3', '-4', 'skull', 'skull', 'cultist', 'autofail', 'eldersign'],
  hard: ['0', '0', '0', '-1', '-1', '-2', '-2', '-3', '-3', '-4', '-5', 'skull', 'skull', 'cultist', 'autofail', 'eldersign'],
  expert: ['0', '-1', '-1', '-2', '-2', '-3', '-3', '-4', '-4', '-5', '-6', '-8', 'skull', 'skull', 'cultist', 'autofail', 'eldersign'],
}

export const chapters = [
  { id: 'extracurricularActivity', code: '02041', name: '课外活动' },
  { id: 'theHouseAlwaysWins', code: '02062', name: '百赌百胜' },
  { id: 'theMiskatonicMuseum', code: '02118', name: '米斯卡塔尼克博物馆' },
  { id: 'theEssexCountyExpress', code: '02159', name: '疯狂列车' },
  { id: 'bloodOnTheAltar', code: '02195', name: '血色祭坛' },
  { id: 'undimensionedAndUnseen', code: '02236', name: '无人知晓' },
  { id: 'whereDoomAwaits', code: '02274', name: '毁灭之地' },
  { id: 'lostInTimeAndSpace', code: '02311', name: '迷失时空' },
]

export const recordLabels = {
  openingScenario: '最先调查的地点', professorWarrenRiceWasKidnapped: '莱斯教授被绑架',
  theInvestigatorsRescuedProfessorWarrenRice: '已救出莱斯教授', theInvestigatorsFailedToSaveTheStudents: '未能救出学生',
  theStudentsWereRescued: '学生获救', theExperimentWasDefeated: '实验体被击败',
  investigatorsWereUnconsciousForSeveralHours: '调查员昏迷数小时',
  oBannionGangHasABoneToPickWithTheInvestigators: '欧巴尼恩帮怀恨在心',
  drFrancisMorganWasKidnapped: '摩尔根博士被绑架', theInvestigatorsRescuedDrFrancisMorgan: '已救出摩尔根博士',
  naomiHasTheInvestigatorsBacks: '娜奥米支持调查员', drHenryArmitageWasKidnapped: '阿米蒂奇博士被绑架',
  theInvestigatorsRescuedDrHenryArmitage: '已救出阿米蒂奇博士',
  theInvestigatorsFailedToRecoverTheNecronomicon: '未能找回死灵之书',
  theInvestigatorsDestroyedTheNecronomicon: '已销毁死灵之书', theInvestigatorsTookCustodyOfTheNecronomicon: '保管死灵之书',
  theNecronomiconWasStolen: '死灵之书被盗', theInvestigatorsWereDelayedOnTheirWayToDunwich: '前往敦威治途中耽搁',
  theRitualWasCompleted: '仪式已完成', theInvestigatorsPutSilasBishopOutOfHisMisery: '结束赛拉斯的痛苦',
  theInvestigatorsRestoredSilasBishop: '赛拉斯恢复人形', theInvestigatorsBanishedSilasBishop: '已放逐赛拉斯',
  sacrificedToYogSothoth: '献祭给犹格·索托斯的人', drHenryArmitageSurvivedTheDunwichLegacy: '阿米蒂奇存活',
  professorWarrenRiceSurvivedTheDunwichLegacy: '莱斯存活', drFrancisMorganSurvivedTheDunwichLegacy: '摩尔根存活',
  zebulonWhateleySurvivedTheDunwichLegacy: '泽布伦存活', earlSawyerSurvivedTheDunwichLegacy: '厄尔存活',
  youCalmedTheTownsfolk: '安抚镇民', youWarnedTheTownsfolk: '警告镇民', broodEscapedIntoTheWild: '逃走的子嗣',
  noBroodEscapedIntoTheWild: '没有子嗣逃走', theInvestigatorsEnteredTheGate: '调查员进入传送门',
  yogSothothToreApartTheBarrierBetweenWorldsAndBecameOneWithAllReality: '世界屏障被撕裂',
  theInvestigatorsClosedTheTearInReality: '已关闭现实裂隙', yogSothothHasFledToAnotherDimension: '犹格·索托斯逃往另一维度',
}
