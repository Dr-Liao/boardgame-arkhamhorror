// 阿卡姆的毁灭（The Doom of Arkham）两章共用的「印刷数据入口」扩展。
//
// 印刷事实源已经是战役根目录 `content/campaigns/theDrownedCity/card-data.js`（campaign-core 维护，
// 事实源 `src/cards/cards-data.js`）。本文件只补两件两章共用、根模块不提供的能力：
//   1. `encounterDefinitions(codes, patches)`：遭遇定义 + 按卡号补丁（克苏鲁部位的印刷数值/关键词、
//      剧情资产的盟友槽豁免等无法从卡文启发式推出来的字段）；
//   2. `flagsOf(registeredEntry, code)`：章节 behavior 读取单卡条目 flags 的唯一入口。
// 其余（printed / location / stage / encounterGroupDeck / identitiesFor）直接转出根模块，
// 避免第二份事实源。放在 Part I 目录由 Part II 相对引用（两章是同一场游戏的前后部分）。
import {
  ALL_CARDS, printed, location, stage, identitiesFor,
  encounterGroupCards, encounterGroupDeck,
} from '../../card-data.js'

export {
  ALL_CARDS, printed, location, stage, identitiesFor, encounterGroupCards, encounterGroupDeck,
}

/** 敌人/诡计/剧情资产定义：根模块的同口径展开 + 按卡号补丁。 */
export function encounterDefinitions(codes, patches = {}) {
  const base = encounterDefinitionsBase(codes)
  for (const [code, patch] of Object.entries(patches)) {
    for (const category of ['enemies', 'treacheries', 'storyAssets']) {
      if (base[category][code]) Object.assign(base[category][code], patch)
    }
  }
  return base
}

// 根模块的 encounterDefinitions 不带补丁；这里复制其最小实现，保持同一口径。
function encounterDefinitionsBase(codes) {
  const enemies = {}, treacheries = {}, storyAssets = {}
  for (const code of new Set(codes)) {
    const card = ALL_CARDS[code]
    if (!card) throw new RangeError(`Unknown The Doom of Arkham encounter definition: ${code}`)
    const printedCard = printed(code)
    // 敌人与诡计的印刷关键词都从卡文推断，因此 text 在分支外只声明一次。
    const text = String(card.text || '')
    if (card.type === 'enemy') {
      enemies[code] = {
        ...printedCard,
        fight: card.fight ?? null, evade: card.evade ?? null, health: card.health ?? null,
        ...(card.healthPerInvestigator ? { healthPerInvestigator: card.health } : {}),
        damage: card.damage || 0, horror: card.horror || 0,
        ...(Object.hasOwn(card, 'victory') ? { victory: card.victory } : {}),
        hunter: /\bHunter\b|猎手/i.test(text),
        aloof: /\bAloof\b|冷漠/i.test(text),
        massive: /\bMassive\b|庞大/i.test(text),
        retaliate: /\bRetaliate\b|反击/i.test(text),
        alert: /\bAlert\b|警戒/i.test(text),
        relentless: /\bRelentless\b|无情/i.test(text),
        elite: (card.traits || []).includes('Elite'),
      }
    } else if (card.type === 'treachery') {
      treacheries[code] = {
        ...printedCard, entryRevelation: true,
        surge: /^Surge\.|涌动/.test(text),
        peril: /(?:^|\n|\. )Peril\.|险境/.test(text),
      }
    } else if (card.type === 'story') {
      storyAssets[code] = { ...printedCard, global: true }
    } else if (card.type === 'asset') {
      storyAssets[code] = {
        ...printedCard, global: true,
        slots: [...(card.slots || [])],
        ...(card.health != null ? { health: card.health } : {}),
        ...(card.sanity != null ? { sanity: card.sanity } : {}),
      }
    }
  }
  return { enemies, treacheries, storyAssets }
}

/** 取实现某条行为的单卡条目 flags（章节 behavior 的唯一数据事实源）。 */
export function flagsOf(registeredEntry, code) {
  const entry = registeredEntry(String(code))
  return entry?.flags || {}
}
