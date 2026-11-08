// 《地球边缘》卡面中文本地修正补丁（参考资源只读，纠错在其下游生成物上）。
//
// 用途：`tools/import-cards.mjs` 生成 `src/cards/cards-data.js` 时，对 08 号段（eoep/eoec）卡
// 应用本文件的确定性修正，修掉审计发现的上游简中继承错误：
//   docs/edgeOfTheEarth/translate/cards/findings.json（32 条，149 处 occurrence）。
// 口径：参考资源不被修改；`node tools/import-cards.mjs --write` 后 `--check` 仍通过。
// 每条规则注明 audit id；不修改规则数值/条件，只改文字（含错别字、图标 token、标点、术语统一）。

const EOTE_PACKS = new Set(['eoep', 'eoec'])
const RULE_FIELDS = ['textZh', 'backTextZh']
const TEXT_FIELDS = ['nameZh', 'subnameZh', 'textZh', 'backNameZh', 'backTextZh']
const EN_PAIR = { nameZh: 'name', subnameZh: 'subname', textZh: 'text', backNameZh: 'backName', backTextZh: 'backText', flavorZh: 'flavor', backFlavorZh: 'backFlavor' }

// 按卡号的精确修正（语义/术语级；顺序敏感）。
const CODE_RULES = {
  // cards-0013 high：en "Take 2 horror" → 简中误作「伤害」。
  '08586': { textZh: [['受到2点伤害', '受到2点恐惧']] },
  // cards-0014 high：「for each different class」按职阶计数，非按卡牌张数。
  '08022': { textZh: [['你每控制一张不同职阶的卡牌', '你控制的卡牌中每有一个不同的职阶']] },
  '08036': { textZh: [['你每控制一张不同职阶的卡牌', '你控制的卡牌中每有一个不同的职阶']] },
  '08050': { textZh: [['你每控制一张不同职阶的卡牌', '你控制的卡牌中每有一个不同的职阶']] },
  // cards-0015：Campaign Log 误译「剧本手册」（Campaign Guide 才用剧本手册）。
  '08622': { backTextZh: [['剧本手册', '剧本日志']] },
  // cards-0021：正文自名与卡名不一致。
  '08037': { textZh: [['地区探测', '地区勘测']] },
  // cards-0022：调查员名统一为「蒙特雷·杰克」。
  '08008': { textZh: [['雷蒙特·杰克', '蒙特雷·杰克']] },
  // cards-0030：「木制雪撬」→「木制雪橇」（卡名+正文）。
  '08615': { nameZh: [['雪撬', '雪橇']], textZh: [['雪撬', '雪橇']] },
  // cards-0031：错别字「复盖」→「覆盖」。
  '08605': { nameZh: [['复盖', '覆盖']], textZh: [['复盖', '覆盖']] },
  // cards-0025：doom token 统一「毁灭标记」。
  '08076': { textZh: [['毁灭印记', '毁灭标记']] },
  // cards-0026：ignore 统一「忽略」。
  '08048': { textZh: [['忽视', '忽略']] },
  // cards-0027：standard damage 统一「标准伤害」。
  '08127': { textZh: [['基础伤害', '标准伤害']] },
  // cards-0028：fight value →「攻击值」。
  '08673': { textZh: [['战斗值', '攻击值']] },
  // cards-0029：campaign 统一「剧本」。
  '08509': { textZh: [['每场战役限一次', '每个剧本仅限一次']] },
  // cards-0018：错字「经」→「将」。
  '08112': { textZh: [['经其“-”变为“+”', '将其“-”变为“+”']] },
  // cards-0019：补限定词「你」；cards-0010：难度标题斜杠后多余空格。
  '08596': { textZh: [['X等于所在地点的高度', 'X等于你所在地点的高度'], ['简单/ 普通', '简单/普通']] },
  // cards-0016：bearer 应为「持有者」。
  '08671': { backTextZh: [['承受者的牌库', '其持有者的牌库']] },
  // cards-0017：不增译「可以」（en 为强制支付）。
  '08650': { textZh: [['调查员可以共同花费', '调查员共同花费']] },
  '08651': { textZh: [['调查员可以共同花费', '调查员共同花费']] },
  '08652': { textZh: [['调查员可以共同花费', '调查员共同花费']] },
  '08653': { textZh: [['调查员可以共同花费', '调查员共同花费']] },
  // cards-0002：补 [[目标]] 特性标记（en [[Objective]]）。
  '08520': { backTextZh: [['结算场景1a上的目标', '结算场景1a上的[[目标]]']] },
  // cards-0024：Limit 统一「每套牌库仅限1张」。
  '08114': { textZh: [['每个牌库', '每套牌库']] },
  '08115': { textZh: [['每个牌库', '每套牌库']] },
  // cards-0010：难度标题斜杠后多余空格。
  '08549': { textZh: [['简单/ 普通', '简单/普通']] },
  '08621': { textZh: [['简单/ 普通', '简单/普通']] },
  '08648': { textZh: [['简单/ 普通', '简单/普通']] },
  // cards-0005：句末括号前多余空格 + 浏览器直排前清理。
  '08505': { textZh: [['。 (团队每轮仅限一次)。', '。(团队每轮仅限一次。)']] },
}

// shroud「隐藏」→「隐藏值」（cards-0023；不含 Hidden 关键词卡）。
const SHROUD_CODES = new Set(['08503', '08556b', '08566', '08567', '08568', '08569', '08570', '08571', '08572', '08573', '08574', '08625', '08626', '08630'])

// 中文数字体例统一为阿拉伯数字（cards-0011；仅规则文本、仅这些卡）。
const NUMERAL_CODES = new Set(['08019', '08031', '08044', '08046', '08051', '08062', '08101', '08117', '08119', '08504', '08681', '08691'])
const CN_NUM = { 一: '1', 二: '2', 两: '2', 三: '3', 四: '4', 五: '5', 六: '6', 七: '7', 八: '8', 九: '9', 十: '10' }
const NUMERAL_RULE = /([一二两三四五六七八九十])(个|张|次|位|名|轮|点|枚|件)/g

/** 中文标点/空格/段落级机械清理（所有 EOTE 卡通用）。 */
function normalizeZhPunctuation(text) {
  let s = String(text ?? '')
  // cards-0007 / 其它：[frost] 后补「标记」名词
  s = s.replace(/(个|一|张|枚)\[frost\](?!标记)/g, '$1[frost]标记')
  // cards-0006 / 080xx：`-1 [icon]` 空格去掉
  s = s.replace(/([-+]\d+) (?=\[)/g, '$1')
  // cards-0008 等：关键词行「目标 -正文」补空格；只处理「空格 + 连字符 + 中文/token」，避免误伤「忒咳哩-哩」等专名。
  s = s.replace(/(\s[-–])(?=[\u4e00-\u9fff[])/g, '$1 ')
  // cards-0004：标点后/前多余空格
  s = s.replace(/([，。：；！？、])\s+/g, '$1')
  s = s.replace(/\s+([，。：；！？、])/g, '$1')
  s = s.replace(/([\u4e00-\u9fff。！？)])\s+\(/g, '$1(')
  s = s.replace(/(\])\s+(?=[\u4e00-\u9fff(（])/g, '$1')
  // 括号内句号后括号外重复句号：「。(…)。」
  s = s.replace(/。\s*\(([^()]*)\)。\s*$/g, '。($1)')
  // cards-0005 型：中句号 + 空格 + 括号
  s = s.replace(/。\s+\(/g, '。(')
  return s
}

/** 规则行缺句末句号（cards-0009）：仅规则文本、跳过标题/数值/已带结尾标点的行。 */
function ensureLineTerminals(text) {
  const lines = String(text ?? '').split('\n')
  return lines.map(line => {
    const trimmed = line.trim()
    if (!trimmed) return line
    if (!/[\u4e00-\u9fff]/.test(trimmed)) return line
    if (/[。！？；：、，）”』】)]$/.test(trimmed)) return line
    if (/\/(?:普通|专家|困难|简单)$/.test(trimmed)) return line
    if (/^[•\-–]?\s*\[[a-z_]+\]?\s*$/.test(trimmed)) return line
    if (/^(?:目标|强制|显现|反应|自由|快速|猎手|冷漠|巨大|警戒|涌动|险境|谈判|反击|巡逻|远程|盟友|道具|遗物)(?:\s*[-–]\s*.*)?$/.test(trimmed) && !/[。！？]$/.test(trimmed)) return `${line}。`
    // 行尾为汉字/）】但整行看起来是完整句子（含「：」的引导句不补）
    if (trimmed.includes('：') && !/[。！？]$/.test(trimmed)) return line
    if (trimmed.endsWith(')') || trimmed.endsWith('）')) return `${line}。`
    if (/\d$/.test(trimmed)) return line
    return `${line}。`
  }).join('\n')
}

/** 引文署名统一（cards-0032）：H.P.洛夫克拉夫特，《作品》→ H. P. 洛夫克拉夫特《作品》。 */
function normalizeCitation(text) {
  return String(text ?? '')
    .replace(/H\.?\s*P\.?\s*洛夫克拉夫特[，,、]?\s*(《[^》]+》)/g, 'H. P. 洛夫克拉夫特$1')
}

/**
 * 对一张 EOTE 卡的 zh 展示字段应用本地修正（原地修改 normalizeCard 的结果对象）。
 * @param {object} card normalizeCard 输出（已含 en/zh 字段）
 */
export function applyEoteTextFixes(card) {
  if (!card || !EOTE_PACKS.has(card.pack)) return card
  const code = card.code

  // 1) 按卡号精确替换
  for (const [field, rules] of Object.entries(CODE_RULES[code] || {})) {
    if (typeof card[field] !== 'string') continue
    for (const [find, replace] of rules) card[field] = card[field].split(find).join(replace)
  }

  // 2) 图标 token：[fast] → [free] 的系统性替换（cards-0001）。仅当 en 同字段使用 [fast]。
  for (const zhField of ['textZh', 'backTextZh']) {
    const enField = EN_PAIR[zhField]
    const enText = String(card[enField] ?? '')
    if (!enText.includes('[fast]')) continue
    card[zhField] = String(card[zhField] ?? '').split('[free]').join('[fast]')
  }

  // 3) 图标后名词、标点、空格（全字段规则文本）
  for (const field of RULE_FIELDS) {
    if (typeof card[field] !== 'string') continue
    card[field] = normalizeZhPunctuation(card[field])
    // FAQ 勘误注记（cards-0012）：中文语境保留则本地化；这里按产品口径移除英文注记
    card[field] = card[field].replace(/[（(]\s*FAQ\s*[，,]\s*v2\.1\s*[)）]/gi, '')
    card[field] = card[field].replace(/\s{2,}/g, ' ').trim()
    // cards-0009：规则行补句末句号
    card[field] = ensureLineTerminals(card[field])
  }

  // 4) shroud 术语（cards-0023）
  if (SHROUD_CODES.has(code)) {
    for (const field of RULE_FIELDS) {
      if (typeof card[field] !== 'string') continue
      card[field] = card[field].replace(/隐藏(?!值)/g, '隐藏值')
    }
  }

  // 5) 中文数字体例（cards-0011）
  if (NUMERAL_CODES.has(code)) {
    for (const field of RULE_FIELDS) {
      if (typeof card[field] !== 'string') continue
      card[field] = card[field].replace(NUMERAL_RULE, (_, num, measure) => `${CN_NUM[num]}${measure}`)
    }
  }

  // 6) 引文署名（cards-0032，风味字段）
  for (const field of ['flavorZh', 'backFlavorZh']) {
    if (typeof card[field] === 'string') card[field] = normalizeCitation(card[field])
  }
  // 7) 卡名/特性字段的残余空格清理
  for (const field of TEXT_FIELDS) {
    if (typeof card[field] === 'string') card[field] = card[field].replace(/\s{2,}/g, ' ').trim()
  }
  return card
}

export const EOTE_CARD_TEXT_FIX_META = Object.freeze({
  audit: 'docs/edgeOfTheEarth/translate/cards/findings.json',
  packs: [...EOTE_PACKS],
  codeRules: Object.keys(CODE_RULES).length,
  shroudCodes: [...SHROUD_CODES],
  numeralCodes: [...NUMERAL_CODES],
})
