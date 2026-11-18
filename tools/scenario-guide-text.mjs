// 阅读者指南的纯文本清洗工具（无 I/O、无组合根依赖）。
//
// 从 tools/import-scenario-guides.mjs 抽出：TSK/TDE/EOTE 的原生成器与《铁杉谷盛宴》的
// tools/build-fhv-guides.mjs 都从这里取同一份清洗口径，避免生成器之间形成 ESM 循环。

// 上游 zh locale 遗留的英文句（少量只影响阅读体验的补充译法）。
function localizeSupplements(value, language) {
  return language === 'zh' ? String(value)
    .replaceAll('The investigators win the campaign!', '调查员赢得战役！')
    .replaceAll('Do not read any intro for a character not chosen by a player. Once each player has read his or her character’s intro, proceed to Setup.', '不要阅读未被玩家选中的角色引言。每位玩家读完自己角色的引言后，进入设置。')
    .replaceAll('but perhaps this is the chance you have been waiting for?', '但或许这正是你一直等待的机会？')
    .replaceAll('Step forward and accept Keziah’s offering. Skip to Resolution 9. You may choose this option only if an investigator has the Black Book in their deck and Erynn joined the investigators.', '走上前，接受凯夏的馈赠。跳至结局 9。只有在某名调查员的牌组中有黑书，且艾琳已加入调查员时，才可以选择此项。')
    .replaceAll('Flee with Sanford and the Lodge. Skip to Resolution 10', '与桑福德和秘社一同逃走。跳至结局 10') : String(value)
}

// 遭遇组图标清单：生成器把 `<section class="encounter-sets"><img…>` 整段剥掉后，会留下
// 「这些遭遇组以下列图标表示：」的悬空句（guides-0004）。遭遇组名称已在前句逐个列出，
// 这里连同冒号一起删掉；中英面板同口径。
const ENCOUNTER_ICON_HINT_ZH = /(?:这些|上述|以下)?遭遇(?:组|牌)[^。.：:\n；;]*(?:图标|圖標)[^。.：:\n；;]*[：:]\s*/g
const ENCOUNTER_ICON_HINT_EN = /\b(?:these|the following|the above)(?:\s+encounter)?\s+(?:sets?|cards?)\b[^.\n]*(?:icons?|symbols?)[^.\n]*:\s*/gi

export function stripEncounterIconHints(text, language) {
  return String(text ?? '').replace(language === 'en' ? ENCOUNTER_ICON_HINT_EN : ENCOUNTER_ICON_HINT_ZH, '')
}

// 中文指南里的英文列举连接符：", and" / 半角逗号 → 中文顿号（guides-0003）。
function localizeZhConnectors(text) {
  let output = String(text ?? '')
    .replace(/\s*,\s*and\s+/gi, '、')
    .replace(/([\u3400-\u9fff\]\)）”’])\s*,\s*/g, '$1、')
  // 去掉顿号后遗留的「、。」「、.」。
  output = output.replace(/、\s*([。.!?！？])/g, '$1')
  return output
}

// ---------------------------------------------------------------------------
// 中文指南里残留的英文转场句（上游 zh locale 半译）：整行 "Proceed to Setup." 等。
// 这些句子只有 2 个英文词，旧测试的「3+ 英文词」门槛抓不到，但玩家会直接读到英文。
// ---------------------------------------------------------------------------
const RESIDUAL_EN_TRANSITIONS = [
  [/\bProceed to _?Setup_?\./gi, '进入冒险设置。'],
  [/\bSkip to _?Setup_?\./gi, '跳至冒险设置。'],
  [/\bProceed to _?Intro_?\./gi, '进入引言。'],
  [/\bSkip to _?Intro_?\./gi, '跳至引言。'],
  [/\bRead _?Intro_?\./gi, '阅读引言。'],
  [/\bProceed to _?Scenario I+: The Witching Hour_?\./gi, '进入冒险：巫异时刻。'],
]

export function localizeResidualEnglish(text) {
  let output = String(text ?? '')
  // 段首的英文分节标签（上游 zh locale 半译）：Resolution 2: / Intro 4: → 结局 2：/ 引言 4：
  output = output.replace(/^([ \t]*)(Intro|Resolution|No Resolution|Scenario)\s*([0-9]+|[IVX]+)?\s*[:：]/gim,
    (match, indent, label, number) => {
      const localized = { intro: '引言', resolution: '结局', 'no resolution': '无结局', scenario: '剧本' }[label.toLowerCase()]
      return `${indent}${localized}${number ? ` ${number}` : ''}：`
    })
  for (const [pattern, replacement] of RESIDUAL_EN_TRANSITIONS) output = output.replace(pattern, replacement)
  return output
}

export function guideText(value, language) {
  let text = String(value)
    .replace(/<section\b[^>]*class=['"]encounter-sets['"][^>]*>[\s\S]*?<\/section>/gi, '')
    .replace(/<img\b[^>]*>/gi, '')
    .replace(/<(?:br|hr)\s*\/?\s*>/gi, '\n')
    .replace(/<li\b[^>]*>/gi, '\n• ')
    .replace(/<\/(?:p|div|li|ul|ol|h[1-6])>/gi, '\n\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/\{'\{'\}([^{}]+)\{'\}'\}/g, '{$1}')
    .replace(/\{fast\}/g, '[free]')
    .replace(/\{xp\}/g, language === 'en' ? '(calculate as instructed above)' : '（按上述说明计算）')
    .replace(/\{name\}/g, language === 'en' ? 'the chosen investigator' : '所选调查员')
    .replace(/\{key\}/g, language === 'en' ? 'the chosen key' : '所选钥匙')
    .replace(/\{perPlayer\}/g, '[per_investigator]')
    .replace(/\{([a-zA-Z_]+)\}/g, (_, name) => `[${({ elderThing: 'elder_thing', autoFail: 'auto_fail' })[name] || name}]`)
    .replace(/\[\[([^\]]+)\]\]/g, '$1').replace(/\*/g, '').replace(/(^|[^a-z])_|_([^a-z]|$)/gi, '$1$2')
    .replace(/[ \t]+/g, ' ').replace(/ *\n */g, '\n').replace(/\n{3,}/g, '\n\n').trim()
  text = stripEncounterIconHints(text, language)
  if (language === 'zh') text = localizeZhConnectors(text)
  const localized = localizeSupplements(text, language)
  return language === 'zh' ? localizeResidualEnglish(localized) : localized
}
