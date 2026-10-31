// 「如同手牌」通道（play / commit as if in hand）统一原语。
//
// 症状：同一类卡面效果（「如同它是你的手牌」「如同其在你的手牌中」）在项目里有 8 种存储形状：
//   · inv.hand 里的物理手牌（基准，不在本模块）
//   · 弃牌堆（playableFromDiscard：临时武器 / 温蒂的护身符）
//   · 威胁区（playableFromThreat：05010 悬案）
//   · 宿主附属的事件（playAttachedEvents：05279 黛雅娜·艾丝帕伦斯）
//   · 背包（cardBackpack：04037）
//   · 原定计划（cardPlan）
//   · 银暮匕首下方（beneathPlayAsIfInHand：05013 黛安娜·史丹利）
//   · 直觉牌库揭示的那张（05002 乔·戴蒙德，规则数据在 hunch-deck.js）
//   · 画中世界复制（copiesBeneathEvents，特例：物理手牌宿主 + 复制事件，仍走手牌通道的专用分支）
//
// 旧实现里每加一类窗口（普通行动 / 快速事件反应窗口 / 收尾玩家窗口 / 能力层 fromHand 窗口 /
// 技能检定投入）都要在每个通道各补一段 if，于是「某个窗口没接某个通道」反复成为同一类 bug：
// 05013 银暮匕首漏了反应窗口与能力窗口、05002 直觉牌库漏了快速事件窗口、背包/原定计划/弃牌堆
// 漏了收尾窗口与能力窗口。本模块把「通道」收敛成唯一声明与读取点：
//
//   1. 通道只在这里定义：怎么枚举、能不能打、额外费用/折扣、怎么取到手里、牌桌挂哪个实体；
//   2. 各窗口只遍历 entries()，不再手写通道分支；
//   3. validateMove / dispatch 用同一份 move 片段（entry.move）还原通道，预览=校验=扣费同源；
//   4. web 端拿 entry.uiKey / option.uiKey 把选项挂回牌桌实体（直觉区那张、下方那张、宿主支援……），
//      点牌即打出。
//
// 新增一个「如同手牌」的存储形状 = 在 CHANNEL_ORDER + entriesOf 里加一条；
// 新增一个窗口 = 用 entries() 枚举。两边都不用再改对方。
//
// 条目（Entry）字段：
//   channel     通道 id（'discard' | 'threat' | 'beneath' | 'hunch' | 'attached' | 'backpack' | 'plan'）
//   code        被打出的卡号
//   move        该通道在 legalMoves / choose 里使用的片段（与原实现逐字段一致，dispatch 依此执行）
//   sourceId    宿主/实例 id（attached=host.id、backpack=bag.id、plan=plan.id、beneath=通道支援 id、threat=实例 id）
//   index       源内下标（beneath / plan / backpack / attached 用）
//   discount    资源折扣（hunch：直觉牌库规则值）
//   hostCost    附加费（attached：{exhaustHost, uses}）
//   labelSuffix 候选/日志后缀（例如「（直觉牌库）」「（银暮匕首：下方）」）
//   uiKey       牌桌挂载协议值（'hunch:<code>' / 'beneath:<code>' / 'asset:<id>'），web 直接当 data-interaction 用

export function createPlayChannels(deps) {
  const {
    cardDef,
    cardName,
    registeredEntry,
    hunchDeck,
    isCardAvailable,
    isWeaknessCard,
    isWeaknessCode,
    runtimeCardAvailable,
    lolaCanUseCard,
    cannotPlayTypes,
    playAccess,
    cardPlayBlockedReason,
    hasPlayedEventsToDeckTop,
    topDiscardEvent,
    leaveAsset,
    info,
    unique,
  } = deps

  // ---------------------------------------------------------------------------
  // 条目构造
  // ---------------------------------------------------------------------------
  function entry(spec) {
    const def = cardDef(spec.code)
    return Object.freeze({
      channel: spec.channel,
      code: spec.code,
      copyCode: spec.copyCode || null,
      sourceId: spec.sourceId ?? null,
      sourceName: spec.sourceName || null,
      instanceId: spec.instanceId ?? null,
      index: spec.index ?? null,
      topDiscard: spec.topDiscard === true,
      discount: spec.discount || 0,
      hostCost: spec.hostCost || null,
      labelSuffix: spec.labelSuffix || '',
      uiKey: spec.uiKey || null,
      def,
      move: Object.freeze({ ...spec.move }),
    })
  }

  // ---------------------------------------------------------------------------
  // 通道声明表
  // ---------------------------------------------------------------------------
  // 每个通道声明枚举钩子；可用性（entryError）与取牌（takeToHand/actionTake）另有统一实现。
  const entriesOf = {
    // 弃牌堆：卡面声明 playableFromDiscard 的牌（任意位置），以及「温蒂的护身符」看弃牌堆顶事件。
    discard(state, inv) {
      const out = []
      for (const code of unique(inv.discard || [])) {
        if (!playAccess(code).fromDiscard || !isCardAvailable(code)) continue
        const def = cardDef(code)
        if (!def || def.type !== 'event' || isWeaknessCard(def)) continue
        out.push(entry({ channel: 'discard', code, sourceName: '弃牌堆',
          move: { action: 'play', cardId: code, fromDiscard: true },
          labelSuffix: '（弃牌堆）' }))
      }
      const top = hasPlayedEventsToDeckTop(inv) && (inv.discard || []).length ? topDiscardEvent(state, inv) : null
      if (top) {
        const def = cardDef(top)
        if (def && def.type === 'event' && isCardAvailable(top) && !isWeaknessCard(def)) {
          out.push(entry({
            channel: 'discard', code: top, topDiscard: true, sourceName: '护身符：弃牌',
            move: { action: 'play', cardId: top, fromDiscard: true },
            labelSuffix: '（护身符：弃牌）',
          }))
        }
      }
      return out
    },

    // 威胁区：条目声明 playableFromThreat 的牌（05010 悬案被「改为加入威胁区域」后仍可打出）。
    threat(state, inv) {
      const out = []
      for (const threatCard of inv.threat || []) {
        if (registeredEntry(threatCard.code)?.playableFromThreat !== true) continue
        const def = cardDef(threatCard.code)
        if (!def) continue
        out.push(entry({
          channel: 'threat', code: threatCard.code, sourceId: threatCard.id, instanceId: threatCard.id,
          sourceName: '威胁区',
          move: { action: 'play', cardId: threatCard.code, threatId: threatCard.id },
          uiKey: `asset:${threatCard.id}`,
          labelSuffix: '（威胁区）',
        }))
      }
      return out
    },

    // 银暮匕首（05013）：宿主支援未横置时，底下的事件可以「如同手牌」打出/投入。
    beneath(state, inv) {
      const out = []
      const channel = (inv.assets || []).find(asset =>
        registeredEntry(asset.code)?.beneathPlayAsIfInHand === true && !asset.exhausted)
      if (!channel) return out
      for (const [index, code] of (inv.beneath || []).entries()) {
        const def = cardDef(code)
        if (!def || def.type !== 'event') continue
        out.push(entry({
          channel: 'beneath', code, index, sourceId: channel.id, sourceName: cardName(channel.code),
          move: { action: 'play', cardId: code, fromBeneath: true, channelAssetId: channel.id },
          uiKey: `beneath:${code}`,
          labelSuffix: '（银暮匕首：下方）',
        }))
      }
      return out
    },

    // 直觉牌库（05002 乔·戴蒙德）：本阶段揭示的那张「如同你的手牌」，照规则 -2 费。
    hunch(state, inv) {
      const code = inv.hunchRevealed
      if (!code) return []
      const def = cardDef(code)
      if (!def) return []
      const discount = hunchDeck.playDiscount(state, inv, code) || 0
      return [entry({
        channel: 'hunch', code, discount, sourceName: '直觉牌库',
        move: { action: 'play', cardId: code, fromHunch: true },
        uiKey: `hunch:${code}`,
        labelSuffix: '（直觉牌库）',
      })]
    },

    // 宿主声明的可打出附属（05279 黛雅娜·艾丝帕伦斯）：支付宿主附加费后「如同手牌」。
    attached(state, inv) {
      const out = []
      for (const host of inv.assets || []) {
        if (registeredEntry(host.code)?.playAttachedEvents !== true) continue
        const hostCost = registeredEntry(host.code)?.playAttachedEventCost || {}
        // 附加费是否可支付由 entryError 统一判定（validateMove 需要「宿主已横置」这类具体文案，
        // 枚举阶段提前过滤会让来源被当成「不存在」而报错失真）。
        for (const attachment of host.attachments || []) {
          const def = cardDef(attachment.code)
          if (!def || !['event', 'skill'].includes(def.type) || isWeaknessCard(def)) continue
          out.push(entry({
            channel: 'attached', code: attachment.code, sourceId: host.id,
            sourceName: cardName(host.code), instanceId: attachment.id ?? null, hostCost,
            move: { action: 'play', cardId: attachment.code, fromAttachedEventOf: host.id },
            uiKey: `asset:${host.id}`,
            labelSuffix: '（宿主附属）',
          }))
        }
      }
      return out
    },

    // 背包（04037）：「如同手牌」打出附属卡。
    backpack(state, inv) {
      const out = []
      for (const bag of inv.assets || []) {
        if (registeredEntry(bag.code)?.cardBackpack !== true) continue
        for (const [index, code] of unique(bag.attachedCards || []).entries()) {
          const def = cardDef(code)
          if (!def || def.type === 'skill') continue
          if (isWeaknessCard(def) && !playAccess(code).playableWeakness) continue
          out.push(entry({
            channel: 'backpack', code, index, sourceId: bag.id, sourceName: cardName(bag.code),
            move: { action: 'play', cardId: code, fromBackpackId: bag.id },
            uiKey: `asset:${bag.id}`,
            labelSuffix: '（背包）',
          }))
        }
      }
      return out
    },

    // 原定计划（cardPlan）：附属事件「如同手牌」打出（额外费用：横置原定计划）。
    plan(state, inv) {
      const out = []
      for (const plan of inv.assets || []) {
        if (registeredEntry(plan.code)?.cardPlan !== true || plan.exhausted) continue
        for (const [index, code] of (plan.attached || []).entries()) {
          const def = cardDef(code)
          if (!def || def.type !== 'event') continue
          out.push(entry({
            channel: 'plan', code, index, sourceId: plan.id, sourceName: cardName(plan.code),
            move: { action: 'play', cardId: code, fromPlanAssetId: plan.id },
            uiKey: `asset:${plan.id}`,
            labelSuffix: '（原定计划）',
          }))
        }
      }
      return out
    },
  }

  // 统一枚举顺序：与旧 legalMoves / reactionWindow 的通道顺序一致（AI/replay 候选顺序不变）。
  //   · CHANNEL_ORDER 对应旧 legalMoves 的通道顺序（手牌循环之后）；
  //   · WINDOW_CHANNEL_ORDER 对应旧 reactionWindow 的通道顺序（手牌候选之后），
  //     既有通道在前、这次新接通的通道在末尾，避免改变既有对局的待决选择顺序/重放指纹。
  const CHANNEL_ORDER = ['attached', 'hunch', 'threat', 'beneath', 'backpack', 'discard', 'plan']
  const WINDOW_CHANNEL_ORDER = ['plan', 'attached', 'beneath', 'hunch', 'discard', 'backpack', 'threat']

  function entries(state, inv, order = CHANNEL_ORDER) {
    const out = []
    for (const channel of order) out.push(...entriesOf[channel](state, inv))
    return out
  }

  // 反应/能力窗口用：保留既有窗口的候选顺序（新增通道追加在末尾）。
  function windowEntries(state, inv) {
    return entries(state, inv, WINDOW_CHANNEL_ORDER)
  }

  function byChannel(state, inv, channel) {
    return entriesOf[channel] ? entriesOf[channel](state, inv) : []
  }

  // move 是否带「如同手牌」通道字段（窗口先用它分流，避免每次都全量枚举）。
  function isChannelMove(move) {
    return Boolean(move && (move.fromHunch || move.fromBeneath || move.fromAttachedEventOf
      || move.fromBackpackId || move.fromPlanAssetId || move.threatId || move.fromDiscard))
  }

  // 从 move 片段还原通道条目（validateMove / dispatch / 窗口执行共用；move 是权威协议）。
  function entryOf(state, inv, move) {
    if (!isChannelMove(move)) return null
    let channel = null
    if (move.fromHunch) channel = 'hunch'
    else if (move.fromBeneath) channel = 'beneath'
    else if (move.fromAttachedEventOf) channel = 'attached'
    else if (move.fromBackpackId) channel = 'backpack'
    else if (move.fromPlanAssetId) channel = 'plan'
    else if (move.threatId) channel = 'threat'
    else channel = 'discard'
    return byChannel(state, inv, channel).find(candidate => sameMove(candidate.move, move)) || null
  }

  function sameMove(a, b) {
    if (!a || !b || a.cardId !== b.cardId) return false
    if ((a.threatId ?? null) !== (b.threatId ?? null)) return false
    if ((a.fromAttachedEventOf ?? null) !== (b.fromAttachedEventOf ?? null)) return false
    if ((a.fromBackpackId ?? null) !== (b.fromBackpackId ?? null)) return false
    if ((a.fromPlanAssetId ?? null) !== (b.fromPlanAssetId ?? null)) return false
    if ((a.fromBeneath ?? false) !== (b.fromBeneath ?? false)) return false
    if ((a.fromHunch ?? false) !== (b.fromHunch ?? false)) return false
    if ((a.fromDiscard ?? false) !== (b.fromDiscard ?? false)) return false
    return true
  }

  // ---------------------------------------------------------------------------
  // 可用性与费用（预览 = 校验 = 扣费同源）
  // ---------------------------------------------------------------------------
  // 返回第一条拒绝原因（文案与旧 validateMove 逐字一致），全部通过返回 null。
  function entryError(state, inv, candidate, def = candidate.def) {
    if (!def) return '未知卡牌'
    const code = candidate.code
    switch (candidate.channel) {
      case 'hunch':
        if (inv.hunchRevealed !== code) return '直觉牌库没有揭示这张牌'
        break
      case 'beneath': {
        const channel = (inv.assets || []).find(asset =>
          registeredEntry(asset.code)?.beneathPlayAsIfInHand === true && !asset.exhausted)
        if (!channel) return '没有可用的 beneath 通道支援'
        if (!(inv.beneath || []).includes(code)) return '底下没有这张牌'
        break
      }
      case 'attached': {
        const host = (inv.assets || []).find(asset => asset.id === candidate.sourceId
          && registeredEntry(asset.code)?.playAttachedEvents === true)
        if (!host || !(host.attachments || []).some(item => item.code === code)) return '该附属事件不在这里'
        const hostCost = registeredEntry(host.code)?.playAttachedEventCost || {}
        if (hostCost.exhaustHost && host.exhausted) return '宿主已横置，不能打出附属事件'
        if (hostCost.uses && (host.uses || 0) < hostCost.uses) return '宿主使用次数不足'
        break
      }
      case 'backpack': {
        const bag = (inv.assets || []).find(asset => asset.id === candidate.sourceId
          && registeredEntry(asset.code)?.cardBackpack)
        if (!bag || !(bag.attachedCards || []).includes(code)) return '背包里没有这张牌'
        break
      }
      case 'plan': {
        const plan = (inv.assets || []).find(asset => asset.id === candidate.sourceId
          && registeredEntry(asset.code)?.cardPlan)
        if (!plan || plan.exhausted || !(plan.attached || []).includes(code)) return '原定计划下没有可打出的这张事件'
        break
      }
      case 'threat': {
        const threatCard = (inv.threat || []).find(card => card.id === candidate.sourceId)
        if (!threatCard || threatCard.code !== code) return '威胁区没有这张牌'
        if (!playAccess(code).fromThreat) return '这张牌不能从威胁区打出'
        break
      }
      case 'discard': {
        if (!playAccess(code).fromDiscard) {
          if (!hasPlayedEventsToDeckTop(inv)) return '你没有温蒂的护身符'
          if (topDiscardEvent(state, inv) !== code) return '不是弃牌堆中最上方的事件'
        }
        break
      }
      default:
        return '未知的如同手牌通道'
    }
    // 通道内通用门控（窗口会另加自己的时机/条件判定）。
    if (!runtimeCardAvailable(state, inv, code) || def.dataStatus === 'quarantined') return '该卡牌未获运行时许可'
    if (!lolaCanUseCard(inv, code)) return '罗拉只能使用中立或当前角色阵营的卡牌'
    if (cannotPlayTypes(inv).has(def.type)) return '当前禁止打出该类型卡牌'
    if (isWeaknessCard(def) && !playAccess(code).playableWeakness) return '该牌不能作为行动打出'
    if (def.type === 'skill') return '该牌不能作为行动打出'
    const blocked = cardPlayBlockedReason(state, inv, def)
    if (blocked) return blocked
    return null
  }

  function discountOf(candidate) {
    return candidate?.discount || 0
  }

  // move 指向的通道来源已失效时的拒绝文案（与旧 validateMove 的逐条消息一致）。
  function channelMissingReason(state, inv, move) {
    if (move.fromHunch) return '直觉牌库没有揭示这张牌'
    if (move.fromBeneath) {
      const hasChannel = (inv.assets || []).some(asset =>
        registeredEntry(asset.code)?.beneathPlayAsIfInHand === true && !asset.exhausted)
      return hasChannel ? '底下没有这张牌' : '没有可用的 beneath 通道支援'
    }
    if (move.fromAttachedEventOf) return '该附属事件不在这里'
    if (move.fromBackpackId) return '背包里没有这张牌'
    if (move.fromPlanAssetId) return '原定计划下没有可打出的这张事件'
    if (move.threatId) {
      const exists = (inv.threat || []).some(card => card.id === move.threatId)
      return exists ? '这张牌不能从威胁区打出' : '威胁区没有这张牌'
    }
    if (move.fromDiscard) {
      if (!hasPlayedEventsToDeckTop(inv)) return '你没有温蒂的护身符'
      return '不是弃牌堆中最上方的事件'
    }
    return '该卡牌不在对应的如同手牌区域'
  }

  // 通道折扣后的资源费用（负折扣/减费由调用方再按原有渠道处理）。
  function discountedCost(playCostValue, candidate) {
    return Math.max(0, playCostValue - discountOf(candidate))
  }

  // ---------------------------------------------------------------------------
  // 窗口取牌：把通道来源变成「手里的一张牌」，之后窗口执行器走与手牌完全相同的路径。
  // ---------------------------------------------------------------------------
  // 返回 { ok, code, handIndex, discount, apply(), restore(), finish() }：
  //   apply   结算前进入通道上下文（如 _playedFromBeneath）
  //   restore 结算后恢复上下文
  //   finish  打出后置（宿主附属回附 / 背包空包弃置等）
  function takeToHand(state, inv, candidate, events = []) {
    const base = { ok: true, code: candidate.code, discount: discountOf(candidate) }
    switch (candidate.channel) {
      case 'beneath': {
        const channel = (inv.assets || []).find(asset => asset.id === candidate.sourceId
          && registeredEntry(asset.code)?.beneathPlayAsIfInHand === true && !asset.exhausted)
        const at = (inv.beneath || []).indexOf(candidate.code)
        if (!channel || at < 0) return { ok: false }
        channel.exhausted = true
        inv.beneath.splice(at, 1)
        inv.hand.push(candidate.code)
        const previous = state._playedFromBeneath
        return {
          ...base,
          handIndex: inv.hand.length - 1,
          apply() { state._playedFromBeneath = { seat: inv.seat, cardCode: candidate.code } },
          restore() {
            if (previous === undefined) delete state._playedFromBeneath
            else state._playedFromBeneath = previous
          },
        }
      }
      case 'hunch': {
        if (inv.hunchRevealed !== candidate.code) return { ok: false }
        inv.hunchRevealed = null
        inv.hand.push(candidate.code)
        return { ...base, handIndex: inv.hand.length - 1 }
      }
      case 'attached': {
        const host = (inv.assets || []).find(asset => asset.id === candidate.sourceId
          && registeredEntry(asset.code)?.playAttachedEvents === true)
        const at = (host?.attachments || []).findIndex(item => item.code === candidate.code)
        if (!host || at < 0) return { ok: false }
        const hostEntry = registeredEntry(host.code)
        const hostCost = hostEntry?.playAttachedEventCost || {}
        if (hostCost.exhaustHost && host.exhausted) return { ok: false }
        if (hostCost.uses && (host.uses || 0) < hostCost.uses) return { ok: false }
        host.attachments.splice(at, 1)
        if (hostCost.exhaustHost) host.exhausted = true
        if (hostCost.uses) {
          host.uses = Math.max(0, (host.uses || 0) - hostCost.uses)
          if (!host.uses && hostEntry?.discardWhenEmpty) {
            leaveAsset(state, inv, host)
            inv.discard.push(host.code)
          }
        }
        inv.hand.push(candidate.code)
        return {
          ...base,
          handIndex: inv.hand.length - 1,
          finish() {
            if (hostEntry?.playAttachedEventStaysAttached !== true) return
            for (const pile of [inv.discard, inv.hand]) {
              const index = pile.lastIndexOf(candidate.code)
              if (index >= 0) pile.splice(index, 1)
            }
            host.attachments ||= []
            host.attachments.push({
              id: `${host.id}:att:${candidate.code}:${state.round ?? 0}:${(host.attachments.length + 1)}`,
              code: candidate.code, ownerSeat: inv.seat,
            })
          },
        }
      }
      case 'backpack': {
        const bag = (inv.assets || []).find(asset => asset.id === candidate.sourceId
          && registeredEntry(asset.code)?.cardBackpack)
        const at = (bag?.attachedCards || []).indexOf(candidate.code)
        if (!bag || at < 0) return { ok: false }
        bag.attachedCards.splice(at, 1)
        inv.hand.push(candidate.code)
        return {
          ...base,
          handIndex: inv.hand.length - 1,
          finish() {
            if (bag.attachedCards.length) return
            inv.discard.push(bag.code)
            leaveAsset(state, inv, bag)
            info(state, events, '🎒 背包里的最后一张牌被打出，弃掉背包。')
          },
        }
      }
      case 'plan': {
        const plan = (inv.assets || []).find(asset => asset.id === candidate.sourceId
          && registeredEntry(asset.code)?.cardPlan)
        const at = (plan?.attached || []).indexOf(candidate.code)
        if (!plan || plan.exhausted || at < 0) return { ok: false }
        plan.attached.splice(at, 1)
        plan.exhausted = true
        inv.hand.push(candidate.code)
        return { ...base, handIndex: inv.hand.length - 1 }
      }
      case 'discard': {
        const at = (inv.discard || []).lastIndexOf(candidate.code)
        if (at < 0) return { ok: false }
        inv.discard.splice(at, 1)
        inv.hand.push(candidate.code)
        return { ...base, handIndex: inv.hand.length - 1 }
      }
      case 'threat': {
        const at = (inv.threat || []).findIndex(card => card.id === candidate.sourceId && card.code === candidate.code)
        if (at < 0) return { ok: false }
        inv.threat.splice(at, 1)
        inv.hand.push(candidate.code)
        return { ...base, handIndex: inv.hand.length - 1 }
      }
      default:
        return { ok: false }
    }
  }

  // 取出后二次校验失败（资源不足等）：把牌放回原处，避免凭空消失。
  function putBack(state, inv, candidate, handIndex) {
    if (Number.isInteger(handIndex) && inv.hand[handIndex] === candidate.code) inv.hand.splice(handIndex, 1)
    switch (candidate.channel) {
      case 'beneath':
        inv.beneath ||= []
        inv.beneath.push(candidate.code)
        break
      case 'hunch':
        if (inv.hunchRevealed == null) inv.hunchRevealed = candidate.code
        break
      case 'attached': {
        const host = (inv.assets || []).find(asset => asset.id === candidate.sourceId)
        if (host) {
          host.attachments ||= []
          host.attachments.push({
            id: candidate.instanceId || `${host.id}:att:${candidate.code}:${state.round ?? 0}:${host.attachments.length + 1}`,
            code: candidate.code, ownerSeat: inv.seat,
          })
        }
        break
      }
      case 'backpack': {
        const bag = (inv.assets || []).find(asset => asset.id === candidate.sourceId)
        if (bag) { bag.attachedCards ||= []; bag.attachedCards.push(candidate.code) }
        break
      }
      case 'plan': {
        const plan = (inv.assets || []).find(asset => asset.id === candidate.sourceId)
        if (plan) { plan.attached ||= []; plan.attached.push(candidate.code); plan.exhausted = false }
        break
      }
      case 'discard':
        inv.discard.push(candidate.code)
        break
      case 'threat':
        inv.threat ||= []
        inv.threat.push({ id: candidate.sourceId || `threat:${candidate.code}`, code: candidate.code })
        break
      default:
        break
    }
  }

  // ---------------------------------------------------------------------------
  // 普通行动路径：dispatch 的取牌（与旧 dispatch 各分支逐字一致，避免状态指纹漂移）
  // ---------------------------------------------------------------------------
  // 返回 null 表示不是通道 move 或来源已变化；否则：
  //   { toHand: true, handCode, playDiscount, playedFromBeneath, attachedHost }
  //   { move: candidate.move }   —— 其余通道保留 move 片段，由 doPlay 自己从来源取牌。
  function actionTake(state, inv, move, events = []) {
    const candidate = entryOf(state, inv, move)
    if (!candidate) return null
    switch (candidate.channel) {
      case 'hunch': {
        if (inv.hunchRevealed !== move.cardId) return null
        const discount = hunchDeck.playDiscount(state, inv, move.cardId) || 0
        delete inv.hunchRevealed
        inv.hand.push(move.cardId)
        return { toHand: true, handCode: move.cardId, playDiscount: discount }
      }
      case 'beneath': {
        const channel = (inv.assets || []).find(asset =>
          registeredEntry(asset.code)?.beneathPlayAsIfInHand === true && !asset.exhausted)
        if (!channel || !(inv.beneath || []).includes(move.cardId)) return null
        channel.exhausted = true
        inv.beneath.splice(inv.beneath.indexOf(move.cardId), 1)
        inv.hand.push(move.cardId)
        return { toHand: true, handCode: move.cardId, playedFromBeneath: true }
      }
      case 'attached': {
        const host = (inv.assets || []).find(asset => asset.id === move.fromAttachedEventOf)
        const at = (host?.attachments || []).findIndex(item => item.code === move.cardId)
        if (!host || at < 0) return null
        const hostEntry = registeredEntry(host.code)
        const hostCost = hostEntry?.playAttachedEventCost || {}
        if (hostCost.exhaustHost) host.exhausted = true
        if (hostCost.uses) {
          host.uses = Math.max(0, (host.uses || 0) - hostCost.uses)
          if (!host.uses && hostEntry?.discardWhenEmpty) {
            leaveAsset(state, inv, host)
            inv.discard.push(host.code)
          }
        }
        host.attachments.splice(at, 1)
        inv.hand.push(move.cardId)
        return { toHand: true, handCode: move.cardId, attachedHost: host }
      }
      default:
        return { move: candidate.move }
    }
  }

  // 行动路径打出后的收尾（宿主附属「打出后仍附属」；由 dispatch 在 doPlay 后调用）。
  function actionFinish(state, inv, taken, events = []) {
    const host = taken?.attachedHost
    if (!host) return
    const hostEntry = registeredEntry(host.code)
    if (hostEntry?.playAttachedEventStaysAttached !== true) return
    const code = taken.handCode
    for (const pile of [inv.discard, inv.hand]) {
      const index = pile.lastIndexOf(code)
      if (index >= 0) pile.splice(index, 1)
    }
    host.attachments ||= []
    host.attachments.push({
      id: `${host.id}:att:${code}:${state.round ?? 0}:${(host.attachments.length + 1)}`,
      code, ownerSeat: inv.seat,
    })
    // 沿用旧 dispatch 的玩家可见日志（05279 打出附属事件后仍附属在宿主上）。
    info(state, events, `「${code}」结算后仍附属在「${host.code}」上。`)
  }

  // ---------------------------------------------------------------------------
  // 技能检定投入（05013 银暮匕首：「你可以打出或投入……」）
  // ---------------------------------------------------------------------------
  // 目前只有 beneath 通道声明 commit；新增通道只要在 commitEntries 里返回条目即可。
  function commitEntries(state, inv) {
    const out = []
    const channel = (inv.assets || []).find(asset =>
      registeredEntry(asset.code)?.beneathPlayAsIfInHand === true && !asset.exhausted)
    if (!channel) return out
    const copies = new Map()
    for (const code of inv.beneath || []) copies.set(code, (copies.get(code) || 0) + 1)
    for (const [index, code] of (inv.beneath || []).entries()) {
      const def = cardDef(code)
      if (!def || !['event', 'skill'].includes(def.type)) continue
      if (!runtimeCardAvailable(state, inv, code) || isWeaknessCode(code)) continue
      // 同名牌可以有两张（守护结界 deck limit 2）。选项 id 若只用卡号，
      // 技能检定的投入窗口会在打开时抛「选择选项 id 重复」。
      const optionId = copies.get(code) > 1 ? `beneath:${index}:${code}` : `beneath:${code}`
      out.push({
        channel: 'beneath', code, index, sourceId: channel.id, def,
        uiKey: `beneath:${code}`, optionId,
        label: `投入（底下）：${cardName(code)}`,
      })
    }
    return out
  }

  function takeCommit(state, inv, candidate) {
    const channel = (inv.assets || []).find(asset =>
      registeredEntry(asset.code)?.beneathPlayAsIfInHand === true && !asset.exhausted)
    const pile = inv.beneath || []
    const at = Number.isInteger(candidate.index) && pile[candidate.index] === candidate.code
      ? candidate.index
      : pile.indexOf(candidate.code)
    if (!channel || at < 0) return null
    channel.exhausted = true
    return inv.beneath.splice(at, 1)[0]
  }

  // ---------------------------------------------------------------------------
  // 文案与协议 id（窗口/legalMoves/牌桌共用，避免各处再拼一遍）
  // ---------------------------------------------------------------------------
  function actionLabel(candidate, cost) {
    const name = cardName(candidate.code)
    switch (candidate.channel) {
      case 'attached': return `📎 从「${candidate.sourceName}」的附属打出「${name}」`
      case 'hunch': return `🔮 从直觉牌库打出「${name}」(${cost} 资源，-${candidate.discount} 费用)`
      case 'threat': return `🃏 从威胁区打出「${name}」(${cost} 资源)`
      case 'beneath': return `🕯️ 从底下打出「${name}」(${cost} 资源，横置「${candidate.sourceName}」)`
      case 'backpack': return `🎒 从背包打出「${name}」(${cost} 资源)`
      case 'discard': return candidate.topDiscard
        ? `🃏 温蒂的护身符：打出弃牌堆顶事件「${name}」(${cost} 资源)`
        : `🃏 从弃牌堆打出「${name}」(${cost} 资源)`
      case 'plan': return `🃏 原定计划：打出「${name}」(${cost} 资源)`
      default: return `🃏 打出「${name}」(${cost} 资源)`
    }
  }

  function candidateId(candidate) {
    switch (candidate.channel) {
      case 'attached': return `attached:${candidate.sourceId}:${candidate.code}:${candidate.instanceId ?? ''}`
      case 'hunch': return 'hunch'
      case 'discard': return 'discard'
      case 'beneath': return `beneath:${candidate.index ?? 0}`
      case 'plan': return `plan:${candidate.sourceId}:${candidate.index ?? 0}`
      case 'backpack': return `backpack:${candidate.sourceId}:${candidate.code}`
      case 'threat': return `threat:${candidate.instanceId ?? candidate.code}`
      default: return candidate.channel
    }
  }

  return {
    entries,
    windowEntries,
    byChannel,
    entryOf,
    isChannelMove,
    entryError,
    channelMissingReason,
    discountOf,
    discountedCost,
    takeToHand,
    putBack,
    actionTake,
    actionFinish,
    commitEntries,
    takeCommit,
    actionLabel,
    candidateId,
  }
}
