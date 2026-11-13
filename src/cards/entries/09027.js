// 09027 深度伤痛（Grievous Wound）· 守卫者事件 · 0 经验。
// 卡面：快速。在你使用[[近战]]支援成功攻击非[[精英]]敌人后打出。
//       将深度伤痛附属到被攻击敌人。
//       强制 - 当一轮结束时：对附属的敌人造成 1 点伤害。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 口径：
//   · 附属：api.attachPlayerCardToAsset(code, enemy)（通用 attachCardTo 写 enemy.attachments）；
//   · 轮末伤害：效果实体 + 强制能力（trigger roundEnds，effect dealDamage，目标写成 id:<敌人 id>，
//     读点 effects.js#dealDamage → enemyForTarget('id:…')）；时长取 endOfRound，在本轮轮末
//     （phases.js 的 roundEnds 窗口，晚于 endOfRound 到期）结算。
// approximation：① 「被附属的敌人每轮结束都受 1 点伤害」只实现当前轮的轮末 1 次：玩家卡附属到敌人
//   后不会被 nonPlayerAbilitySources 枚举（enemy.attachments 只枚举非玩家 scope 条目），
//   重复轮次需要引擎把玩家卡附敌纳入窗口来源（见 primitive-requests/09027.json）；
//   ② 打出条件「使用近战支援成功攻击非精英敌人后」缺「本次攻击来源」上下文读点，改为由玩家选择
//   同地点非精英敌人（不校验本次攻击的武器与结果）。
export default {
  code: '09027',
  note: 'approximation: 轮末 1 点伤害只结算当前轮 1 次（玩家卡附属到敌人不是窗口来源）；打出条件无法校验「刚用近战支援成功攻击」（见 primitive-requests/09027.json）',
  abilities: [
    {
      kind: 'played',
      fast: true,
      label: '快速：附属到同地点非精英敌人；本轮轮末对其造成 1 点伤害',
      resolve: ({ state, inv, api }) => {
        const enemies = api.enemiesAt(inv.location).filter(enemy => !enemy.elite)
        if (!enemies.length) {
          api.info('深度伤痛：这里没有非精英敌人。')
          return
        }
        const enemyId = enemies.length === 1 ? enemies[0].id : api.choice({
          kind: 'target', source: '09027', seat: inv.seat,
          prompt: '深度伤痛：选择被攻击的非精英敌人。',
          options: enemies.map(enemy => ({ id: enemy.id, label: enemy.name })),
        })
        const enemy = state.enemies.find(item => item.id === enemyId) || enemies[0]
        const attachment = api.attachPlayerCardToAsset('09027', enemy, { ownerSeat: inv.seat })
        api.addEffect({
          duration: 'endOfRound',
          sourceCode: '09027',
          sourceInstanceId: attachment?.id ?? enemy.id,
          controllerSeat: inv.seat,
          label: '深度伤痛：本轮结束时对附属敌人造成 1 点伤害',
          abilities: [{
            kind: 'forced',
            trigger: 'roundEnds',
            label: '轮末：对深度伤痛的附属敌人造成 1 点伤害',
            effect: { type: 'dealDamage', amount: 1, target: `id:${enemy.id}` },
          }],
        }, inv.seat)
        api.info(`深度伤痛：附属到「${enemy.name}」，本轮结束时其受到 1 点伤害。`)
      },
    },
  ],
  modifiers: [],
}
