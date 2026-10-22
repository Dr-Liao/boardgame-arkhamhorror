// 浏览器 UI 需要的「卡号 → 用途」表（第 127 轮建立，第 128 轮移入 web/）。
//
// 原先这些卡号散落在 `web/*.js` 里（table-regions / deck-rules / table-components /
// game-ui / rulebook-data / situation-view），属于「单卡特判」。
// 现在集中到这个纯数据模块，由 web/*.js 直接 import。
//
// **必须放在 web/ 内**：大厅只把 Mod 声明的 web 目录挂到 `/mods/<id>/`（见 lib/mods.js 的
// web 契约），浏览器的相对导入不能跨出这个挂载点。放在 `presentation/` 时，
// `import '../presentation/ui-cards.js'` 会被解析成 `/mods/presentation/...` → 404，
// 导致整个浏览器模块加载失败：启动页退回大厅通用弹窗，开局后也停在「正在加载界面…」。
// 这是**纯展示**数据（桌面上画哪张卡、数字怎么显示、规则书怎么归类），不含任何规则判定；
// 规则判定仍在条目/引擎里。web/ 里除本文件外不得再出现卡号字面量
// （tests/architecture-guard.test.mjs 的浏览器边界守卫会检查）。
//
// 说明：
// - `scenarioCards`：剧本参考卡（桌面上显示的那张剧本卡）；
// - `story`：剧情资产/弱点，表格用它把「座位标记」渲染成一张卡；
// - `locationMarkers`：地点上的附属标记卡；
// - `enemyDisplay`：敌人卡面数字的特殊显示规则；
// - `handSlots`：支援卡给的手牌位加成（卡号 → 加成值）；
// - `deckRules`：两组**构筑规则**用的调查员集合（敦威治五人 / 黛西的「命运」限制）；
// - `rulebookActAgenda`：规则书里当作「幕/议程」展示的卡；
// - `tomeInvestigators`：拥有「书籍行动」的调查员。

export const UI_CARDS = Object.freeze({
  scenarioCards: Object.freeze({
    theGathering: '01104',
    theMidnightMasks: '01120',
    theDevourerBelow: '01142',
    extracurricularActivity: '02041',
    theHouseAlwaysWins: '02062',
    theMiskatonicMuseum: '02118',
    theEssexCountyExpress: '02159',
    bloodOnTheAltar: '02195',
    undimensionedAndUnseen: '02236',
    whereDoomAwaits: '02274',
    lostInTimeAndSpace: '02311',
  }),
  story: Object.freeze({
    smiteTheWicked: '02007',
    searchingForIzzie: '02011',
    shadowSpawned: '02142',
  }),
  locationMarkers: Object.freeze({
    barricade: '01038',
    arcaneBarrier: '02102',
    sordidAndSilent: '02089',
    searchingForIzzie: '02011',
  }),
  enemyDisplay: Object.freeze({
    fightMinusTwo: '03103',
  }),
  handSlots: Object.freeze({
    '01008': 2,
  }),
  deckRules: Object.freeze({
    dunwichInvestigators: Object.freeze(['02001', '02002', '02003', '02004', '02005']),
    noFortuneInvestigator: '02002',
  }),
  rulebookActAgenda: Object.freeze(['02085', '02220']),
  tomeInvestigators: Object.freeze(['01002']),
})
