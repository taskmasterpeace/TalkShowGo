// Next boot hook (needs experimental.instrumentationHook in next.config.mjs on Next 14). On the Node runtime it
// hydrates process.env from lab/settings/keys.json for every key NOT already set — so keys pasted in the
// SETTINGS page reach every existing `process.env.X` read in the app, with zero edits elsewhere. Env always
// wins: a variable that is already set is never touched. Logs NAMES only, never a value.
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    try {
      const { hydrateEnv } = await import('./lib/command/keys')
      const names = hydrateEnv()
      if (names.length) console.log(`[settings] ${names.length} key${names.length === 1 ? '' : 's'} loaded from lab/settings/keys.json: ${names.join(', ')} (env vars still win)`)
    } catch (e: any) {
      console.warn('[settings] could not hydrate keys from lab/settings/keys.json: ' + String(e?.message || e))
    }
  }
}
