// 05280 否决存在
// 卡面：快速。在遭遇卡牌或敌人攻击将要导致你执行以下一项(选择一项)时打出：弃掉手牌、失去资源、失去行动、受到伤害、受到恐惧。
// 卡面：你忽略该效果的影响。然后，对应地执行与之相反的效果(抽取卡牌、获得资源、获得额外行动、治愈伤害、治愈恐惧)。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 05280 否决存在：挂在 harmDealt 窗口上的快速事件，只处理「受到伤害 / 受到恐惧」两个分支：
// 选择要忽略的那一项（把窗口上下文里的该分量清零），再执行相反效果（治愈等量伤害/恐惧）。
// 弃手牌 / 失资源 / 失行动三个分支未实现（需要遭遇卡结算前的「按面向取消」原语），见 note。

export default {
  code: '05280',
  simplified: true,
  note: '五个面向均已实现；剩余近似：引擎的 wouldDiscardFromHand/wouldLoseResources/wouldLoseActions 窗口'
    + '对任何来源的弃牌/失资源/失行动都会打开（卡面限定「遭遇卡牌或敌人攻击」），条目无法区分来源。',
  abilities: [
    {
      kind: 'reaction',
      trigger: ['wouldDiscardFromHand', 'wouldLoseResources', 'wouldLoseActions'],
      fromHand: true,
      label: '忽略弃手牌/失资源/失行动的效果，并执行相反效果',
      criteria: ctx => {
        const context = ctx.context || {}
        if (context.seat !== ctx.inv?.seat) return false
        if (context.cancelled) return false
        return ['discard', 'resources', 'actions'].includes(context.what)
      },
      resolve: ({ inv, context, api }) => {
        context.cancelled = true
        const amount = Math.max(0, Number(context.amount) || 0)
        if (context.what === 'discard') {
          api.info(`${inv.name} 用「否决存在」忽略弃掉手牌的效果，改为抽 ${amount} 张。`)
          api.drawCards(inv.seat, amount)
        } else if (context.what === 'resources') {
          api.info(`${inv.name} 用「否决存在」忽略失去资源的效果，改为获得 ${amount} 资源。`)
          api.gainResources(inv.seat, amount)
        } else if (context.what === 'actions') {
          api.info(`${inv.name} 用「否决存在」忽略失去行动的效果，改为获得 ${amount} 次额外行动。`)
          api.gainAction(inv.seat, amount)
        }
      },
    },
    {
      kind: 'reaction',
      trigger: 'harmDealt',
      fromHand: true,
      label: '忽略这次伤害/恐惧并反向治愈',
      criteria: ctx => {
        const context = ctx.context || {}
        if (context.seat !== ctx.inv?.seat) return false
        if (!((context.damage || 0) > 0 || (context.horror || 0) > 0)) return false
        // 只对「敌人攻击」或「遭遇卡」造成的伤害/恐惧生效。
        return Boolean(context.attack) || Boolean(ctx.state?._treacheryResolving)
      },
      resolve: ({ inv, api, context }) => {
        const damage = Math.max(0, context?.damage || 0)
        const horror = Math.max(0, context?.horror || 0)
        const aspects = []
        if (damage > 0) aspects.push({ id: 'damage', label: `忽略这 ${damage} 点伤害，改为治愈 ${damage} 点伤害` })
        if (horror > 0) aspects.push({ id: 'horror', label: `忽略这 ${horror} 点恐惧，改为治愈 ${horror} 点恐惧` })
        if (!aspects.length) return
        const pick = aspects.length === 1 ? aspects[0].id : api.choice({ kind: 'effect', source: '05280', seat: inv.seat,
          prompt: '「否决存在」：选择要忽略的那一项效果。', options: aspects })
        if (pick === 'damage') {
          context.damage = 0
          api.info(`${inv.name} 用「否决存在」忽略了 ${damage} 点伤害。`)
          api.healDamage(inv.seat, damage)
        } else {
          context.horror = 0
          api.info(`${inv.name} 用「否决存在」忽略了 ${horror} 点恐惧。`)
          api.healHorror(inv.seat, horror)
        }
      },
    },
  ],
  modifiers: [

  ],
}
