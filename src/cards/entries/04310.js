// 04310 虚空碎裂
// 卡面：封印(0)。使用(3充能)。
// 卡面：[action]花费1充能或释放一个封印在此的混乱标记：攻击。本次攻击不使用[combat]，改为使用[willpower]，并造成+1伤害。每有一个“0”标记封印在虚空碎裂上，你本次攻击得到+2[willpower]。你在本次攻击期间每揭示一个“0”标记，将该标记封印在虚空碎裂上，并且本次攻击造成额外1点伤害。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 04310 虚空碎裂：花 1 充能或释放封印的「0」作为费用，用意志攻击（封印的 0 各 +2 意志、+1 伤害）。

export default {
  code: '04310',
  uses: 3,
  usesType: 'charges',
  sealOnEnter: '0',
  abilities: [
    {
      kind: 'action', label: '花费 1 充能或释放标记：意志攻击（+1 伤害）', cost: { action: true },
      // 旧写法是 effect.kind = 'fight'：这次「攻击」不引发借机攻击。
      countsAs: 'fight',
      resolve: ({ inv, source, api }) => {
        if (!source) return
        let paid = false
        if ((source.uses || 0) > 0) {
          api.addUses(source, -1)
          paid = true
          api.info(`「${api.cardName('04310')}」花费 1 充能（剩 ${source.uses}）。`)
        } else if (api.sealedTokensFrom(source, '0') > 0) {
          const released = api.releaseSealedToken(source, '0')
          paid = true
          api.info(`「${api.cardName('04310')}」释放封印的 ${api.tokenLabel(released)} 作为费用。`)
        }
        if (!paid) { api.info('「虚空碎裂」没有充能或封印标记可支付。'); return }
        const targets = api.enemiesAt(inv.location)
        if (!targets.length) { api.info('这里没有可攻击的敌人。'); return }
        const enemy = targets.length === 1 ? targets[0] : api.chooseEnemy(inv.seat, { type: 'fight' })
        if (!enemy) return
        const sealedNow = api.sealedTokensFrom(source, '0')
        api.fight(inv.seat, enemy.id, { skill: 'willpower', combatBonus: sealedNow * 2, damageBonus: 1,
          noSpend: true, sealZerosTo: source.id, sealZerosLabel: api.cardName('04310') })
      },
    },
  ],
  modifiers: [

  ],
}
