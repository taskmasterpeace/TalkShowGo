// SETTINGS KEYS — unit checks (run: npx tsx --test src/lib/command/keys.test.ts)
// Laws under test: env ALWAYS wins over lab/settings/keys.json · masking never leaks a key ·
// the registry covers every contract name · save/delete round-trip · boot hydration is bookkept.
import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
// keys.ts reads TSG_SETTINGS_DIR per call (never at load), so a hoisted import is fine
import { KEYS, KEY_NAMES, getKey, keySource, mask, loadSettings, saveKey, deleteKey, hydrateEnv, features, settingsFile } from './keys'

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'tsg-keys-'))
process.env.TSG_SETTINGS_DIR = tmp
const saved: Record<string, string | undefined> = {}

before(() => {
  for (const n of KEY_NAMES) { saved[n] = process.env[n]; delete process.env[n] }
  saved.TSG_KEYS_FROM_SETTINGS = process.env.TSG_KEYS_FROM_SETTINGS
  delete process.env.TSG_KEYS_FROM_SETTINGS
})
after(() => {
  for (const [k, v] of Object.entries(saved)) { if (v === undefined) delete process.env[k]; else process.env[k] = v }
  fs.rmSync(tmp, { recursive: true, force: true })
})

test('registry covers every contract name with label, service, verify kind and required_for', () => {
  const contract = ['OPENROUTER_API_KEY', 'TWITTERAPI_IO_KEY', 'PERPLEXITY_API_KEY', 'CUPCAKE_GATEWAY_KEY',
    'TWILIO_ACCOUNT_SID', 'TWILIO_AUTH_TOKEN', 'TWILIO_FROM', 'ELEVENLABS_API_KEY', 'RESEND_API_KEY', 'ASSEMBLYAI_API_KEY', 'YTDLP_PATH', 'FFMPEG_PATH']
  for (const n of contract) {
    const d = KEYS.find(k => k.name === n)
    assert.ok(d, n + ' missing from KEYS')
    assert.ok(d!.label && d!.service && d!.verify, n + ' needs label/service/verify')
    assert.ok(Array.isArray(d!.required_for), n + ' needs required_for[]')
    assert.equal(typeof d!.optional, 'boolean', n + ' needs optional')
  }
  assert.equal(new Set(KEY_NAMES).size, KEY_NAMES.length, 'no duplicate names')
})

test('settings file lives under TSG_SETTINGS_DIR when set (test isolation)', () => {
  assert.equal(settingsFile(), path.join(tmp, 'keys.json'))
})

test('getKey: nothing configured -> null', () => {
  assert.equal(getKey('OPENROUTER_API_KEY'), null)
  assert.equal(keySource('OPENROUTER_API_KEY'), null)
})

test('getKey: file only -> file value, source settings', () => {
  saveKey('OPENROUTER_API_KEY', 'file-value-000000000000')
  // saveKey hydrates process.env when no real env var exists; clear that to test the pure file path
  delete process.env.OPENROUTER_API_KEY
  process.env.TSG_KEYS_FROM_SETTINGS = ''
  assert.equal(getKey('OPENROUTER_API_KEY'), 'file-value-000000000000')
  assert.equal(keySource('OPENROUTER_API_KEY'), 'settings')
})

test('getKey: env ALWAYS wins over the file; source env', () => {
  process.env.OPENROUTER_API_KEY = 'env-value-111111111111'
  assert.equal(getKey('OPENROUTER_API_KEY'), 'env-value-111111111111')
  assert.equal(keySource('OPENROUTER_API_KEY'), 'env')
})

test('getKey: an EMPTY env var does not win (falls through to the file)', () => {
  process.env.OPENROUTER_API_KEY = '   '
  assert.equal(getKey('OPENROUTER_API_KEY'), 'file-value-000000000000')
  delete process.env.OPENROUTER_API_KEY
})

test('saveKey: hydrates process.env when nothing is set, and is bookkept as from-settings', () => {
  delete process.env.PERPLEXITY_API_KEY
  saveKey('PERPLEXITY_API_KEY', 'pplx-file-222222222222')
  assert.equal(process.env.PERPLEXITY_API_KEY, 'pplx-file-222222222222')
  assert.equal(keySource('PERPLEXITY_API_KEY'), 'settings', 'a hydrated key still reports settings, not env')
  assert.ok((process.env.TSG_KEYS_FROM_SETTINGS || '').split(',').includes('PERPLEXITY_API_KEY'))
})

test('saveKey: a REAL env var is never clobbered by an app save', () => {
  process.env.TWITTERAPI_IO_KEY = 'real-env-333333333333'
  const r = saveKey('TWITTERAPI_IO_KEY', 'app-value-444444444444')
  assert.equal(process.env.TWITTERAPI_IO_KEY, 'real-env-333333333333')
  assert.equal(getKey('TWITTERAPI_IO_KEY'), 'real-env-333333333333')
  assert.equal(r.env_overrides, true)
  assert.equal(loadSettings().TWITTERAPI_IO_KEY, 'app-value-444444444444', 'the file still holds the app value')
  delete process.env.TWITTERAPI_IO_KEY
})

test('saveKey: rejects unknown names, empty values and newlines', () => {
  assert.throws(() => saveKey('NOT_A_KEY' as any, 'x'))
  assert.throws(() => saveKey('RESEND_API_KEY', '   '))
  assert.throws(() => saveKey('RESEND_API_KEY', 'abc\ndef'))
})

test('deleteKey: removes from file and un-hydrates process.env (only when it came from settings)', () => {
  assert.equal(process.env.PERPLEXITY_API_KEY, 'pplx-file-222222222222')
  deleteKey('PERPLEXITY_API_KEY')
  assert.equal(loadSettings().PERPLEXITY_API_KEY, undefined)
  assert.equal(process.env.PERPLEXITY_API_KEY, undefined)
  assert.equal(getKey('PERPLEXITY_API_KEY'), null)
  // a real env var survives a delete of the app copy
  process.env.RESEND_API_KEY = 'real-env-555555555555'
  saveKey('RESEND_API_KEY', 're_app_666666666666')
  deleteKey('RESEND_API_KEY')
  assert.equal(process.env.RESEND_API_KEY, 'real-env-555555555555')
  delete process.env.RESEND_API_KEY
})

test('hydrateEnv: loads every file key that is not already in env, bookkeeps names, never overrides env', () => {
  saveKey('ELEVENLABS_API_KEY', 'el-file-777777777777'); saveKey('ASSEMBLYAI_API_KEY', 'aai-file-888888888888')
  delete process.env.ELEVENLABS_API_KEY; delete process.env.ASSEMBLYAI_API_KEY
  process.env.TSG_KEYS_FROM_SETTINGS = ''
  process.env.ASSEMBLYAI_API_KEY = 'aai-env-999999999999'
  const names = hydrateEnv()
  assert.ok(names.includes('ELEVENLABS_API_KEY'))
  assert.ok(!names.includes('ASSEMBLYAI_API_KEY'), 'env already set -> not hydrated')
  assert.equal(process.env.ELEVENLABS_API_KEY, 'el-file-777777777777')
  assert.equal(process.env.ASSEMBLYAI_API_KEY, 'aai-env-999999999999')
  assert.equal(keySource('ELEVENLABS_API_KEY'), 'settings')
  assert.equal(keySource('ASSEMBLYAI_API_KEY'), 'env')
  delete process.env.ASSEMBLYAI_API_KEY
})

test('mask: first 6 + ellipsis + last 3, never more than that, short values degrade, empty -> empty', () => {
  assert.equal(mask('sk-or-v1-0123456789abcdef85f'), 'sk-or-…85f')
  assert.equal(mask(''), '')
  assert.equal(mask(null as any), '')
  const short = mask('abcdefgh')
  assert.ok(short.length < 'abcdefgh'.length && short.includes('…'), 'short value is not echoed: ' + short)
  const m = mask('0123456789abcdefghij')
  assert.ok(!m.includes('456789ab'), 'the middle is gone')
})

test('settings file is written 0600 where the OS allows', () => {
  if (process.platform === 'win32') return
  const mode = fs.statSync(settingsFile()).mode & 0o777
  assert.equal(mode, 0o600)
})

test('features: readiness follows the keys present', () => {
  for (const n of KEY_NAMES) delete process.env[n]
  fs.writeFileSync(settingsFile(), '{}')
  process.env.TSG_KEYS_FROM_SETTINGS = ''
  let f = Object.fromEntries(features().map(x => [x.id, x]))
  assert.equal(f.pull.ready, false); assert.ok(f.pull.missing.includes('TWITTERAPI_IO_KEY'))
  assert.equal(f.shows.ready, false)
  process.env.TWITTERAPI_IO_KEY = 'tw-aaaaaaaaaaaaaaaa'
  process.env.OPENROUTER_API_KEY = 'or-bbbbbbbbbbbbbbbb'
  f = Object.fromEntries(features().map(x => [x.id, x]))
  assert.equal(f.pull.ready, true)
  assert.equal(f.shows.ready, false, 'shows still needs a voice engine key')
  process.env.CUPCAKE_GATEWAY_KEY = 'gw-cccccccccccccccc'
  f = Object.fromEntries(features().map(x => [x.id, x]))
  assert.equal(f.shows.ready, true)
  assert.equal(f.phone.ready, false)
  assert.equal(f.email.ready, false)
  for (const n of KEY_NAMES) delete process.env[n]
})
