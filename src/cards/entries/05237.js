// 05237 幸运或是注定（幸存者 · 2 经验）
// 卡面：快速。在毁灭标记将要放到任意冒险卡牌上时打出。
// 卡面：每场游戏最多1张。
// 卡面：取消将要放到该卡牌上的1个毁灭标记。放逐幸运或是注定。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 05237 幸运或是注定：快速；取消 1 个毁灭标记；每场游戏最多 1 张；放逐自身。
//
// 显式简化（详见 worker 报告）：
//   未实现：①「在毁灭标记将要放到任意冒险卡牌上时打出」的精确时点——引擎只有 addDoom /
//   placeDoomOnCard 的写入点，没有 doomWouldBePlaced 窗口；本批改为「自己的回合内快速打出」，
//   结算时取消当前密谋上已有的 1 点毁灭（净效果同为「少 1 点毁灭」）。
//   ② 「每场游戏最多 1 张」按调查员 gameFlags 记账（多调查员时不是团队级）。
//   proposedApi: window doomWouldBePlaced(interrupt) + context { card, amount, cancelled }；
//   见 artifacts/migration/tcu/primitive-requests/w-m2-3-05237-doom-placement-window.json。P10 前补。

export default {
  code: '05237',
  simplified: true,
  note: '未实现：「毁灭标记将要放到冒险卡牌上时」的精确时点（引擎缺 doomWouldBePlaced 窗口，改为自己回合快速打出、'
    + '取消当前密谋上的 1 点毁灭）与团队级「每场游戏最多 1 张」（按调查员 gameFlags 记账）；'
    + '快速、放逐自身已实现。P10 前补。',
  playCondition: [
    { when: ({ state }) => (state.doom || 0) > 0, message: '当前密谋上没有可以取消的毁灭标记' },
    {
      when: ({ state }) => !state.investigators.some(owner => owner.gameFlags?.fortuneOrFate),
      message: '每场游戏最多打出 1 张「幸运或是注定」',
    },
  ],
  abilities: [
    {
      kind: 'played',
      fast: true,
      exileAfterPlay: true,
      label: '取消当前密谋上 1 点毁灭并放逐自身',
      resolve: ({ inv, api }) => {
        const removed = api.removeDoom(1)
        api.setGameFlag(inv.seat, 'fortuneOrFate')
        api.info(`🌑 ${inv.name} 用「幸运或是注定」取消了密谋上的 ${removed} 点毁灭。`)
      },
    },
  ],
}
