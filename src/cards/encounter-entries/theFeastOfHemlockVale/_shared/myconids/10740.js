// 10740 迷神孢子（Psychotropic Spores）· 诡计 · 共享遭遇组 myconids（印刷 2 张）
// 归属：战役共用 · theFeastOfHemlockVale/_shared/myconids。
// 卡面（中文正文见 src/cards/cards-data.js 的 textZh，本文件不抄第二份）：
//   Revelation - Put Psychotropic Spores into play in your threat area. Limit 1 per investigator.
//   Forced - The first time you draw 1 or more cards from your deck each round: Take 1 direct horror.
//   [action]: Test [intellect] (3). If you succeed, discard Psychotropic Spores.
//   (You may take 1 direct horror for this test to automatically succeed.)
//
// 读点（声明即接线）：
//   · 显现直接在本条目结算（encounterResolve；FHV 诡计的 entryRevelation 条目通道，
//     src/engine/treachery-tokens.js#resolveTreacheryBody）。
//   · 「放进你的威胁区域」= api.threat（scenario-runtime.js 的威胁区唯一写入口，走 afterThreatEntered）；
//     返回 { placed: true } 阻止它按普通诡计进遭遇弃牌堆（与 07299 同一返回值契约）。
//   · 「每位调查员仅限 1 张」= 结算前查 inv.threat 里是否已有同卡，已有则不再放置（结算后按常规弃掉）。
//   · 剩下两段（每条轮第一次抽牌的直接恐惧、[action] 检定/受 1 点直接恐惧换自动成功的摆脱行动）：
//     引擎侧没有对应读点——威胁区卡牌不是能力窗口来源（ability-rules.js#nonPlayerAbilitySources 不枚举
//     inv.threat），威胁区摆脱行动只读 threatEffect.discardCost（无检定）与 endTurnTest（回合末检定），
//     抽牌时点也没有 threatEffect 钩子。因此这两段只落 flags 数据，note 披露为未接线。
const CODE = '10740'
const NAME = '迷神孢子'
const SKILL = 'intellect'
const DIFFICULTY = 3

export default {
  code: CODE,
  scope: 'treachery',
  implemented: true,
  flags: {
    encounterGroup: 'myconids',
    quantity: 2,
    traits: ['Hazard', 'Flora'],
    threatArea: true,
    limitPerInvestigator: 1,
    test: { skill: SKILL, difficulty: DIFFICULTY, discardOnSuccess: true },
    autoSuccessCost: { directHorror: 1 },
    forcedFirstDrawEachRound: { directHorror: 1 },
  },
  encounterResolve(state, inv, card, api) {
    void card
    if (!inv) return false
    if ((inv.threat || []).some(item => (item.originalCode || item.code) === CODE)) {
      api.info?.(`「${NAME}」：你的威胁区域已有 1 张（每位调查员仅限 1 张），本张不再放置。`)
      return false
    }
    api.threat(inv.seat, CODE)
    api.info?.(`🍄 「${NAME}」进入 ${inv.name} 的威胁区域。`)
    return { placed: true }
  },
  note: '显现（进威胁区域 + 每位调查员仅限 1 张）自足实现。「每轮第一次抽牌受 1 点直接恐惧」与'
    + '「[action] 智力(3) 摆脱，可受 1 点直接恐惧自动成功」没有引擎读点（威胁区卡不在能力窗口来源里，'
    + '摆脱行动只支持 discardCost / endTurnTest），本批只落 flags 数据留给 P8 威胁区原语，未冒充已实现。',
}
