// 11657 · location · obsidianCanyons
//
// 悬挂船只（×2）。[[峰顶]]；回合结束：[敏捷](X)（X=本地点调查员数），失败弃掉悬挂船只（放峰顶牌库顶，behavior.turnEnded）；[action] 本地点每人花 1 线索，向相邻开阔天空滑动一次（behavior.actions obsidianHangingShipSlide）。
// 数据型条目：数值/身份由 definition 从卡表读取；行为读点见 note 中的 behavior 钩子。
export default {
  code: '11657',
  scope: 'location',
  implemented: true,
  flags: { summit: true, hangingShip: true, slideAction: true },
  
  note: "悬挂船只（×2）。[[峰顶]]；回合结束：[敏捷](X)（X=本地点调查员数），失败弃掉悬挂船只（放峰顶牌库顶，behavior.turnEnded）；[action] 本地点每人花 1 线索，向相邻开阔天空滑动一次（behavior.actions obsidianHangingShipSlide）。",
}
