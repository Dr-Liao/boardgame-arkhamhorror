// 11659 · location · obsidianCanyons
//
// 炫目天际线（×3）。[[峰顶]]；揭示后受 1 恐惧（近似：revealHorror 未接线）；[action] 花费 1-3 线索，每线索从峰顶牌库底揭示 3 张并可放到顶/底（behavior.dazzlingSkylineAction 按 1 线索近似）。
// 数据型条目：数值/身份由 definition 从卡表读取；行为读点见 note 中的 behavior 钩子。
export default {
  code: '11659',
  scope: 'location',
  implemented: true,
  flags: { summit: true, revealHorror: 1, skylineReveal: true },
  
  note: "炫目天际线（×3）。[[峰顶]]；揭示后受 1 恐惧（近似：revealHorror 未接线）；[action] 花费 1-3 线索，每线索从峰顶牌库底揭示 3 张并可放到顶/底（behavior.dazzlingSkylineAction 按 1 线索近似）。",
}
