// Plans are advisory, observer-scoped data. They never change rule state.
const roles = new Set(['investigate', 'fight', 'support', 'flex'])
export function normalizePlan(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  const plan = {}
  if (roles.has(raw.role)) plan.role = raw.role
  for (const key of ['objective', 'intent', 'upgrade', 'reason']) {
    if (typeof raw[key] === 'string') plan[key] = raw[key].replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, 160)
  }
  return Object.keys(plan).length ? plan : null
}

const identity = (state, seat) => {
  const inv = state.investigators?.find(item => item.seat === seat)
  return inv?.campaignId || inv?.code || String(seat)
}
const scenario = state => `${state.campaign?.id || ''}:${state.scenario?.id || ''}:${state.campaign?.flow?.visits?.[state.campaign?.flow?.nodeId] || 0}`

// Call only after the associated legal move is committed (never on a stale reply).
export function commitAgentPlan(session, seat, raw, decisionState = session.state) {
  const plan = normalizePlan(raw)
  if (!plan) return
  session.agentPlans ||= {}
  session.agentPlans[seat] = { ...plan, investigator: identity(session.state, seat),
    scenario: scenario(decisionState), round: decisionState.round, revision: session.state.revision }
}

export function plansForObserver(session, seat) {
  const plans = session.agentPlans || {}
  const team = Object.entries(plans).filter(([key, p]) => p.investigator === identity(session.state, Number(key)))
    .map(([key, p]) => ({ seat: Number(key), role: roles.has(p.role) ? p.role : 'flex' }))
  const stored = plans[seat]
  if (!stored || stored.investigator !== identity(session.state, seat)) return { team, own: null }
  const own = { ...normalizePlan(stored), revision: stored.revision }
  own.needsReview = stored.scenario !== scenario(session.state) || stored.round !== session.state.round
  if (own.needsReview) delete own.intent
  return { team, own }
}

export function planPrompt(session, seat) {
  return '【持久协作计划】\n' + JSON.stringify(plansForObserver(session, seat))
    + '\n计划只是既往建议；每步按最新局面、玩家战术备忘和合法动作重新评估。needsReview 时重写意图。队友仅共享职责，不共享私有牌组计划。'
}

export const agentPlanning = {
  commit: commitAgentPlan,
  view: plansForObserver,
  prompt: planPrompt,
  instruction: '【协作规划】在输出 JSON 中另附 plan 对象：{role:"investigate|fight|support|flex",objective:"战役目标",intent:"本轮下一步意图",upgrade:"构筑或升级方向",reason:"本次选择的简短依据"}。每项简短，不超过160字。结合队友职责、成本和局势更新；计划不能替代 move，也不能改变规则。',
  outputFormat: '{"move": <行动>, "speech": "<台词>", "plan":{"role":"flex","objective":"战役目标","intent":"下一步","upgrade":"升级方向","reason":"选择依据"}}',
}
