// 诡镇奇谈界面语言包入口（docs/localization.md §8.2）。
// 拆成 core + 按模块拆分的区域片段，方便多人并行维护；聚合后仍是 default export 的扁平对象。
// 缺失 key 的回退顺序由 web/i18n.js 负责：resolved → zh-CN → key。
import core from './zh-CN.core.js'
import hub from './zh-CN.hub.js'
import gameui from './zh-CN.gameui.js'
import table from './zh-CN.table.js'
import panels from './zh-CN.panels.js'
import lore from './zh-CN.lore.js'
import misc from './zh-CN.misc.js'

export default {
  "draft.refillTask": "补足牌组",
  "draft.refillStatus": "补足牌组：{count} / {size} 张，还需 {missing} 张。",
  "draft.deckRequirement": "牌组要求：{count} / {size} 张；还需补足 {missing} 张，补满前不能确认准备或开始关卡。",
  "draft.refillNote": "补牌候选均为计入牌组张数的 0 经验卡。每选一张免费补充下一组三选一，直到达到新要求；主动刷新仍花费 1 经验。补牌完成后，继续升级仍需付费刷新。",

  "draft.type.asset": "支援",
  "draft.typeDistribution": "卡牌类型构成",
  "draft.typeScope": "包含专属卡与弱点；重复卡按实际张数统计。",
  "draft.type.weakness": "弱点",
  "draft.type.other": "其他",
  "draft.fullDeck": "完整卡牌列表",
  "draft.fullDeckTitle": "完整卡牌列表 · 共 {count} 张",

  "draft.modeLabel": "游戏模式",
  "draft.standardDescription": "自由构筑初始牌组，并按常规规则使用经验升级。",
  "draft.modeDescription": "通过卡牌三选一构筑与升级牌组。初始可免费刷新五次；混乱袋额外获得 +1 与 0；关后经验为（最终结算经验 +1）×2。",

  "draft.standard": "普通模式",
  "draft.title": "选牌模式",
  "draft.chooseInvestigator": "请先在调查员页面选择角色。",
  "draft.initialStatus": "初始选牌：已选 {count} 张，剩余免费刷新 {free} 次。",
  "draft.upgradeStatus": "关后升级 · 可用经验 {xp} XP",
  "draft.locked": "整组已锁定，跨关保留；将失去下一关的免费刷新机会。",
  "draft.slot": "候选 {slot}",
  "draft.noCandidate": "当前没有符合此位置要求的合法候选。",
  "draft.inspect": "查看 {name}",
  "draft.cardCost": "卡牌等级 {xp} XP · 资源费用 {cost}",
  "draft.replace": "替换卡牌",
  "draft.replaceFor": "为 {name} 选择替换卡牌",
  "draft.noReplacement": "直接加入",
  "draft.unavailable": "经验不足或没有合法替换；可锁定整组留待下关购买。",
  "draft.initialDone": "初始选牌完成，可以确认准备。",
  "draft.consumed": "本组选牌已完成。继续选牌需花费 1 XP 刷新。",
  "draft.upgradeNote": "每组仅选一张；0 经验卡免费替换。有经验卡另付升级费用，支持同名差价。同名升级刷新权重 ×2。可以跳过并随时返回。",
  "draft.deckTitle": "当前卡组 · {count} 张计入构筑大小",
  "draft.costCurve": "资源费用构成",

  ...core,
  ...hub,
  ...gameui,
  ...table,
  ...panels,
  ...lore,
  ...misc,
}
