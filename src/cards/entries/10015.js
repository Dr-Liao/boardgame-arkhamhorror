// 10015 汉克·萨姆森（Hank Samson）· 求生者 · 5 生命 / 5 理智 · 助理 / 监守
// 卡面：
//   你所在地点其他调查员和[[盟友]]支援受到的伤害和/或恐惧，可以分配给你。
//   [reaction] 在你将要因伤害和/或恐惧而被击败时：改为治愈你全部的伤害和恐惧，
//   将本卡牌与绑定的[[坚毅]]版本交换，任选一面朝上。
//   [旧印] 效果：+1。
//
// 读点（卡面 → 引擎）：
//   · 同地点伤恐承接 → 条目 flags.assignInvestigatorHarmAtLocation；
//     读点 src/engine/harm-assignment.js#investigatorsWhoCanAbsorbHarm / redirectAllyHarm。
//   · 濒败替换 → forced + wouldDefeat → api.scenario.replaceLethalHarmWithForm：
//     investigator-form.js 把卡面身份（code/技能/生命/理智）整体换成 10016a 或 10016b，
//     清空既有伤害/恐惧，并写 inv.formHealingProhibited（治疗读点 harm-threat.js#healDamageFrom /
//     healHorrorFrom）。形态卡号来自 cards-data 的 bondedCards，引擎不读条目里的形态声明，
//     因此这里不重复登记绑定关系；inv.form / formOriginal 都是纯 JSON 状态，随存档往返。
//   · 旧印 +1 → investigator.elderSign.bonus（AI 预估）与 elderSign.resolve（结算）。
//   · 《“爹爹在哪儿？”》轮末 1 点直接恐惧：玩家卡附属在敌人身上时不是能力窗口来源，且
//     phases.js 只在 hasWindowListener('roundEnds') 为真时开窗；10018 的条目因此不能自己当
//     监听者。该强制能力按「汉克当前面」写在 10015/10016a/10016b 三个条目上（三面是同一张
//     调查员卡的不同面，引擎只读当前 inv.code 的条目），见 10018.js 的 note。
const WHERES_PA = '10018'

const wheresPaAttached = state => (state.enemies || []).some(enemy =>
  (enemy.attachments || []).some(card => (card.originalCode || card.code) === WHERES_PA))

// 窗口在 checkDefeated 里、可能先经过救命卡的快速事件窗口——真正结算本强制能力前重判一次
// 「仍然是致命伤/恐」，避免被快速卡救回后还换面。数值用调查员实例上的当前上限（引擎的
// getMaxHealth 会再叠加动态 +上限；这里是最接近的只读近似）。
const stillLethal = inv => (inv.damage || 0) >= (inv.maxHealth ?? inv.health ?? Infinity)
  || (inv.horror || 0) >= (inv.maxSanity ?? inv.sanity ?? Infinity)

// 与 10016a/10016b 同一份「轮末直接恐惧」读点（三面各写一次，原因见文件头）。
const wheresPaRoundEnd = {
  kind: 'forced',
  trigger: 'roundEnds',
  label: '《“爹爹在哪儿？”》轮末：汉克·萨姆森受到 1 点直接恐惧',
  criteria: [({ state }) => wheresPaAttached(state)],
  resolve: ({ inv, api }) => api.directHorror(inv.seat, 1),
}

export default {
  code: '10015',
  name: 'Hank Samson',
  kind: 'investigator',
  investigator: { elderSign: { bonus: 1 } },
  flags: { assignInvestigatorHarmAtLocation: true },
  elderSign: {
    id: '10015-eldersign',
    label: '汉克旧印：+1',
    resolve: () => ({ delta: 1 }),
  },
  abilities: [
    {
      kind: 'forced',
      trigger: 'wouldDefeat',
      label: '濒败替换：治愈全部伤害与恐惧，换成坚毅面（任选一面，本局不能治疗）',
      criteria: [({ inv, context }) => !inv.form
        && context?.when === 'wouldDefeat'
        && context.seat === inv.seat
        && ['damage', 'horror', 'both'].includes(context.cause)
        && stillLethal(inv)],
      resolve: ({ inv, api, context }) => {
        // 印刷「任选一面朝上」：两张绑定坚毅面二选一。选项 id 就是卡号，便于界面/AI 直接使用。
        const forms = [
          { id: '10016a', label: `${api.cardName('10016a')}·坚毅面（助理）：4 生命 / 6 理智` },
          { id: '10016b', label: `${api.cardName('10016b')}·坚毅面（监守）：6 生命 / 4 理智` },
        ]
        const answer = api.choice({
          kind: 'effect', source: '10015', seat: inv.seat,
          prompt: '选择要交换的坚毅面（任选一面朝上）。',
          options: forms,
        })
        const code = forms.some(form => form.id === answer) ? answer : '10016a'
        api.scenario.replaceLethalHarmWithForm(inv.seat, context, {
          code, form: 'alternate', healingProhibited: true,
        })
      },
    },
    wheresPaRoundEnd,
  ],
  modifiers: [],
}
