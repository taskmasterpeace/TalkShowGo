/**
 * SIGNAL EXPORT
 *
 * Exports greenlit stories to Director's Palette for video production.
 */

import { supabase } from '@/lib/db'

interface SignalExportData {
  job_run_id: string
  story_id: string
}

export async function signalExport(data: SignalExportData) {
  const { job_run_id, story_id } = data

  try {
    await supabase
      .from('job_runs')
      .update({ status: 'running', started_at: new Date().toISOString() })
      .eq('id', job_run_id)

    // Get the export package
    const { data: exportPkg, error: exportError } = await supabase
      .from('export_packages')
      .select('*')
      .eq('story_id', story_id)
      .eq('status', 'pending')
      .single()

    if (exportError) throw exportError
    if (!exportPkg) throw new Error('No pending export package found')

    // Send to Director's Palette API
    const apiUrl = process.env.DIRECTORS_PALETTE_API_URL
    const apiKey = process.env.DIRECTORS_PALETTE_API_KEY

    if (!apiUrl) {
      // If no API configured, just mark as sent (dev mode)
      await supabase
        .from('export_packages')
        .update({
          status: 'sent',
          sent_at: new Date().toISOString(),
        })
        .eq('id', exportPkg.id)
    } else {
      // Send to actual API
      const response = await fetch(`${apiUrl}/api/stories/import`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify(exportPkg.package_json),
      })

      if (!response.ok) {
        throw new Error(`API returned ${response.status}: ${await response.text()}`)
      }

      const result = await response.json()

      await supabase
        .from('export_packages')
        .update({
          status: 'acknowledged',
          sent_at: new Date().toISOString(),
          response: result,
        })
        .eq('id', exportPkg.id)
    }

    // Update story production status
    await supabase
      .from('stories')
      .update({ production_status: 'in_production' })
      .eq('id', story_id)

    await supabase
      .from('job_runs')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
        items_processed: 1,
      })
      .eq('id', job_run_id)

    return { success: true }
  } catch (error) {
    await supabase
      .from('export_packages')
      .update({ status: 'failed' })
      .eq('story_id', story_id)

    await supabase
      .from('job_runs')
      .update({
        status: 'failed',
        completed_at: new Date().toISOString(),
        errors: [{ error: String(error) }],
      })
      .eq('id', job_run_id)

    throw error
  }
}
