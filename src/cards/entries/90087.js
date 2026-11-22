// 90087 萝拉·海耶斯（平行 / Enthralling Encore，挑战「迷人返场」必需调查员）。
//
// 卡面（cards-data 90087）：
//   You begin the game in the Neutral role.
//   You can only play or commit Neutral cards or cards of your current role.
//   Forced - When your turn begins: Switch your role ([guardian]/[seeker]/[rogue]/[mystic]/[survivor]/Neutral).
//   [elder_sign] effect: +2. You may switch roles.
//
// 引擎读点：
//   · 角色系统：条目级 `investigator.deckbuildingRoles` 是 stats.js#lolaCanUseCard 的读点
//     （打出/投入仅限中立或当前角色卡）；`api.switchRole(seat, source, prompt)`（api-card.js →
//     stats.chooseLolaRole）让玩家选择角色并写 inv.role；`api.setRoleDiscount` 已由 03018 使用。
//   · 回合开始强制切换：`turnBegins` 窗口（windows.js，回合开始后）。Samuel Blake（90093）在手牌中时
//     不能切换（卡面）；在场上时切换追加「受 1 点恐惧」。
//   · 旧印：`elderSign.resolve` 返回 { delta: 2 }，并可选切换角色。
//   · 「开局中立角色」：引擎开局走 table-decisions.js#chooseLolaRole（deckbuildingRoles 且无 role 时询问），
//     没有「平行萝拉固定从中立开始」的读点 → 已排队
//     primitive-requests/core-inv-90087-starting-role.json；接线前开局会照常询问初始角色。

const code = '90087'
const SAMUEL = '90093'
const samuelInHand = inv => (inv.hand || []).includes(SAMUEL)
const samuelInPlay = inv => (inv.assets || []).some(asset => asset.code === SAMUEL)

// 切换角色：Samuel Blake 在手 → 不允许；在场上 → 追加 1 点恐惧。返回新角色或 null。
function switchRole(inv, api, prompt) {
  if (samuelInHand(inv)) {
    api.info('「塞缪尔·布莱克」在你手牌中，你不能切换角色。')
    return null
  }
  const role = api.switchRole(inv.seat, code, prompt)
  if (!role) return null
  if (samuelInPlay(inv) && !inv.defeated) {
    api.horror(inv.seat, 1)
    api.info('切换角色时「塞缪尔·布莱克」令你受到 1 点恐惧。')
  }
  return role
}

export default {
  code,
  kind: 'investigator',
  investigator: {
    deckbuildingRoles: true,
    elderSign: { bonus: 2 },
  },
  elderSign: {
    id: '90087-eldersign',
    label: '旧印：+2。你可以切换角色',
    resolve: ({ inv, api }) => {
      if (!samuelInHand(inv)) {
        const answer = api.choice({
          kind: 'reaction', source: '90087-eldersign', seat: inv.seat,
          prompt: '旧印：是否切换你的角色？',
          options: [{ id: 'skip', label: '不切换' }, { id: 'switch', label: '切换角色' }],
        })
        if (answer === 'switch') switchRole(inv, api, '旧印：选择要切换到的角色。')
      }
      return { delta: 2 }
    },
  },
  abilities: [
    {
      kind: 'forced',
      trigger: 'turnBegins',
      label: '回合开始时：切换你的角色',
      criteria: [({ inv }) => !samuelInHand(inv)],
      resolve: ({ inv, api }) => {
        switchRole(inv, api, '回合开始：选择要切换到的角色。')
      },
    },
  ],
  modifiers: [],
  note: '近似：开局固定中立角色缺读点（primitive-requests/core-inv-90087-starting-role.json）；Samuel Blake 在手时「不能打出其它角色的卡」需要引擎 lolaCanUseCard 扩展（primitive-requests/core-inv-90093-samuel-blake-role-lock.json）。',
}
