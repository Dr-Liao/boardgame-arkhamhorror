const handlers = new Map()
export function registerCampaignEffectHandler(id, handler) {
  if (typeof id !== 'string' || !/^[a-z][A-Za-z0-9-]*$/.test(id) || typeof handler !== 'function') throw new TypeError('Invalid campaign effect handler')
  if (handlers.has(id) && handlers.get(id) !== handler) throw new Error('Duplicate campaign effect handler: '+id)
  handlers.set(id,handler)
}
export function runCampaignEffectHandler(state, effect, log) {
  const handler=handlers.get(effect.handler)
  if (!handler) throw new Error('Unknown campaign effect handler: '+effect.handler)
  return handler(state,effect,log)
}
