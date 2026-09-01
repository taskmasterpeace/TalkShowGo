import { NextResponse } from 'next/server'
import { loadData, compileShowplan } from '../../../../../lab/engine/showplan.mjs'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** POST {formatId, runtime?, skinId?, seatOverrides?, guests?, input?}
 *  STAGE 3 of PROCESS: the Showrunner compiles the selected FORMAT + available cast into a
 *  role-assigned run of show (casting, branch-resolved beat sheet, render manifest, warnings).
 *  Pure compiler in lab/engine/showplan.mjs; contract in lab/FORMAT_SYSTEM.md. */
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({} as any))
  if (!body.formatId) return NextResponse.json({ error: 'formatId required' }, { status: 400 })
  try {
    const data = loadData(process.cwd())
    const plan = compileShowplan(data, {
      formatId: body.formatId,
      runtime: body.runtime ?? null,
      skinId: body.skinId ?? null,
      seatOverrides: body.seatOverrides ?? {},
      guests: body.guests,
      input: body.input ?? null,
    })
    return NextResponse.json({ ok: true, ...plan })
  } catch (e: any) {
    return NextResponse.json({ error: String(e?.message || e).slice(0, 200) }, { status: 400 })
  }
}
