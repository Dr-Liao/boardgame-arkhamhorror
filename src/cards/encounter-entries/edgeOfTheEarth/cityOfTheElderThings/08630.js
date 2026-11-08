// 08630 隐秘隧道（Hidden Tunnel）· location
//
// 归属：关卡专用 · edgeOfTheEarth/cityOfTheElderThings（P7）。
// 卡面：
//   隐秘隧道上的线索不能被发现或移动到其他地点。
//   [action]：任选一项技能检定(4)。你可以花费一个[skull]钥匙来使你本次检定得到技能值+5。如果你检定成功，将隐秘隧道上的1个线索返回到供应堆(如果你花费了一个[skull]钥匙，改为2个线索)。
// 背面：进入地下城市的通道被隐藏了。你不能进入隐秘隧道。
//
// 逐卡规则由 `src/cards/card-rules.js` 的读点读取（actRule / agendaRule / locationRule / enemyRule / treacheryRule / encounterResolve / flags），章节 behavior 只做分派。
export default {
  code: "08630",
  scope: "location",
  implemented: true,
  locationRule: {
    actions: [
      {
        rule: "tunnelInvestigate",
        label: "任选技能检定(4)：成功把隧道上 1 线索放回供应堆（花费 1 个 [skull] 钥匙则 2 个）"
      }
    ],
    blocksClueDiscovery: true,
    victory: 1
  }
}
