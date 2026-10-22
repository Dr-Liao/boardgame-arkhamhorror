// 战役状态切片（Phase 6 · 战役插件化第三批：stateSlice）
//
// 症状：引擎模块里散落着战役专属的状态字段名 ——
//   Carcosa：`carcosaPlayDiscount`（打出折扣）、`carcosaShroudModifier`（本回合帷幕）、
//            `carcosaDifficultyModifier`（检定难度）、`carcosaActionGains`（演出奖励行动）、
//            `carcosaWagers`（押注资源）；
//   TFA：`tfaDamageBonus` / `tfaDamageReduction`（伤害加成/减伤）、
//        `tfaNoReadyRound`（禁止重整）、`tfaRoundEndDiscard`（支援回合末弃置）。
// 字段名本身也是战役名，等于把战役概念焊进了引擎模块。
//
// 本模块是**唯一的读写口**：引擎只经这些访问器读写，字段名只出现在这里。
// **字段名与形状保持不变**——它们进 `stateHash`，改名就会让 golden replay 基线失效。
//
// 读点：engine.js 的 commonDeps 注入 `campaignState`，各模块从 deps 解构。

export function createCampaignState() {
  return {
    // ---------------- Carcosa ----------------
    // 打出折扣：由 api.playCard 的 options.discount 写入，playCost / actionCost 读取，doPlay 收尾清掉。
    playDiscount: inv => inv?.carcosaPlayDiscount || 0,
    setPlayDiscount: (inv, value) => { if (inv) inv.carcosaPlayDiscount = value },
    clearPlayDiscount: inv => { if (inv) delete inv.carcosaPlayDiscount },

    // 本回合帷幕修正：tempShroudMod 写入，调查结算读取（只在写入回合/座位内有效）。
    setTurnShroudModifier: (loc, state, amount) => {
      if (!loc) return 0
      loc.carcosaShroudModifier = { amount, round: state.round, turnSeat: state.currentSeat }
      return amount
    },
    turnShroudModifier: (loc, state) => (loc?.carcosaShroudModifier?.round === state?.round
      && loc.carcosaShroudModifier.turnSeat === state?.currentSeat ? loc.carcosaShroudModifier.amount : 0),

    // 敌人检定难度修正（api.enemyTestModifier 写入；数据面留给敌人侧的读点）。
    setEnemyTestModifier: (enemy, state, spec = {}) => {
      if (!enemy) return enemy
      enemy.carcosaDifficultyModifier = {
        fight: spec.fight || 0, evade: spec.evade || 0,
        round: state.round, turnSeat: state.currentSeat,
      }
      return enemy
    },
    enemyTestModifier: enemy => enemy?.carcosaDifficultyModifier || null,

    // 演出奖励行动：同一 turn/seat/asset 只给一次（「每回合一次」；额外回合是新的 turnSerial）。
    grantActionGain: (inv, state, key) => {
      if (!inv) return false
      inv.carcosaActionGains ||= {}
      const id = `${state.round}:${state.turnSerial ?? 0}:${state.currentSeat}:${key || 'attack'}`
      if (inv.carcosaActionGains[id]) return false
      inv.carcosaActionGains[id] = true
      inv.actionsLeft++
      return true
    },

    // 押注资源：检定投入时记录，成功按 2 倍返还、失败清掉。
    wager: (inv, code) => inv?.carcosaWagers?.[code] || 0,
    addWager: (inv, code, amount) => {
      if (!inv) return 0
      inv.carcosaWagers ||= {}
      inv.carcosaWagers[code] = (inv.carcosaWagers[code] || 0) + amount
      return inv.carcosaWagers[code]
    },
    clearWager: (inv, code) => { if (inv?.carcosaWagers) delete inv.carcosaWagers[code] },

    // ---------------- 失落的时代 ----------------
    // 「职业杀手」：本回合该敌人下次受到的伤害 +N（一次性，取用即清）。
    consumeDamageBonus: (enemy, state) => {
      const bonus = enemy?.tfaDamageBonus
      if (!bonus) return 0
      // 「本回合」：同一 round 内换人后失效。
      if (bonus.round !== state?.round
        || (bonus.turnSerial != null && state?.turnSerial != null && bonus.turnSerial !== state.turnSerial)) {
        delete enemy.tfaDamageBonus
        return 0
      }
      const amount = bonus.amount || 0
      delete enemy.tfaDamageBonus
      return amount
    },
    setDamageBonus: (enemy, state, amount) => {
      if (!enemy || !amount) return null
      enemy.tfaDamageBonus = { amount, round: state.round, turnSerial: state.turnSerial ?? null }
      return enemy.tfaDamageBonus
    },
    // 通用减伤（幽嘶蛇人）。
    damageReduction: enemy => enemy?.tfaDamageReduction || 0,
    setDamageReduction: (enemy, value) => { if (enemy) enemy.tfaDamageReduction = value },

    // 「蟒蛇」：下个补给阶段不能重整。
    cannotReadyRound: inv => (Number.isInteger(inv?.tfaNoReadyRound) ? inv.tfaNoReadyRound : null),
    clearCannotReadyRound: inv => { if (inv) delete inv.tfaNoReadyRound },

    // 支援的回合末弃置时刻（写入方是效果数据）。
    roundEndDiscardRound: asset => (asset?.tfaRoundEndDiscard ?? null),
    setRoundEndDiscard: (asset, round) => { if (asset) asset.tfaRoundEndDiscard = round },
  }
}
