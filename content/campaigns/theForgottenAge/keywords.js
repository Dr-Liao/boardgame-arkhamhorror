// 失落的时代（三循环）关键词清单：审计与规则书共用的唯一事实来源。
// 每个关键词必须同时具备：卡面来源、引擎行为、Node 验收、规则书条目与卡文直达。
export const TFA_KEYWORDS = Object.freeze([
  {
    id: 'explore',
    printed: 'Explore',
    zh: '探索',
    ruleId: 'tfaExploration',
    pattern: 'Explore|探索',
    cardCodes: ['04043', '04050', '04057', '04069', '04071', '04076', '04206', '04285', '04289', '04318'],
    engine: { module: 'src/engine/engine.js', names: ['buildExplorationDeck', 'addToExplorationDeck', 'doExplore'] },
  },
  {
    id: 'vengeance',
    printed: 'Vengeance',
    zh: '复仇',
    ruleId: 'tfaVengeance',
    pattern: 'Vengeance|复仇',
    cardCodes: ['04043', '04059', '04066', '04074', '04083', '04084', '04220', '04277', '04287'],
    engine: { module: 'src/engine/engine.js', names: ['recordVengeance', 'vengeancePoints'] },
  },
  {
    id: 'yigsFury',
    printed: "Yig's Fury",
    zh: '伊格之怒',
    ruleId: 'tfaVengeance',
    pattern: "Yig's Fury|伊格之怒",
    cardCodes: ['04223', '04325b'],
    engine: { module: 'src/engine/engine.js', names: ['addYigsFury', 'yigsFury'] },
  },
  {
    id: 'supplies',
    printed: 'Supplies',
    zh: '补给',
    ruleId: 'tfaSupplies',
    pattern: 'check your supplies|检查(你的)?补给|补给品',
    cardCodes: ['04050', '04060', '04067', '04070', '04206', '04219', '04225', '04228', '04291', '04342'],
    engine: { module: 'src/engine/engine.js', names: ['grantSupplies', 'checkSupplies', 'crossOffSupply', 'suppliesAtLocation'] },
  },
  {
    id: 'poisoned',
    printed: 'Poisoned',
    zh: '中毒',
    ruleId: 'tfaPoison',
    pattern: 'Poisoned|中毒',
    cardCodes: ['04043', '04072', '04075', '04078', '04101', '04102', '04187', '04205', '04216'],
    engine: { module: 'src/engine/engine.js', names: ['poisonInvestigator', 'isPoisoned'] },
  },
  {
    id: 'relicOfAges',
    printed: 'Relic of Ages',
    zh: '古代遗物',
    ruleId: 'tfaRelic',
    pattern: 'Relic of Ages|古代遗物',
    cardCodes: ['04068', '04123', '04191', '04303', '04314', '04320', '04323'],
    engine: { module: 'src/engine/engine.js', names: ['moveRelicOfAges', 'relicOfAges', 'relicOfAgesLocation'] },
  },
  {
    id: 'expeditionLeader',
    printed: 'Expedition Leader',
    zh: '远征领队',
    ruleId: 'tfaRelic',
    pattern: 'expedition leader|lead investigator|领队|队长',
    cardCodes: ['04331'],
    engine: { module: 'src/engine/engine.js', names: ['expeditionLeaderSeat', 'setExpeditionLeader'] },
  },
  {
    id: 'elderThing',
    printed: 'Elder Thing',
    zh: '旧神标记',
    ruleId: 'tfaChaos',
    pattern: 'elder_thing|elder thing',
    cardCodes: ['04043', '04054', '04113', '04161', '04205', '04237', '04277', '04314', '04344'],
    engine: { module: 'content/campaigns/theForgottenAge/tfa-chaos.js', names: ['tfaChaosToken', 'tfaChaosAfterTest'] },
  },
])

export const TFA_RULE_IDS = Object.freeze([
  'tfaCampaign', 'tfaExploration', 'tfaSupplies', 'tfaVengeance', 'tfaPoison',
  'tfaRelic', 'tfaTimeline', 'tfaDescent', 'tfaChaos',
])

export const tfaKeyword = id => TFA_KEYWORDS.find(keyword => keyword.id === id) || null
