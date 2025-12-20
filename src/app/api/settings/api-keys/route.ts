import { NextResponse } from 'next/server'
import {
  getAllAPIKeyStatuses,
  saveAPIKey,
  deleteAPIKey,
  verifyAPIKey,
  API_KEY_CONFIGS,
  type ServiceType,
} from '@/lib/api-keys'

/**
 * GET /api/settings/api-keys
 * Get status of all API keys
 */
export async function GET() {
  try {
    const statuses = await getAllAPIKeyStatuses()

    // Also return the config info for each service
    const servicesWithConfig = statuses.map(status => ({
      ...status,
      docsUrl: API_KEY_CONFIGS[status.service]?.docsUrl,
      placeholder: API_KEY_CONFIGS[status.service]?.placeholder,
    }))

    return NextResponse.json({
      success: true,
      apiKeys: servicesWithConfig,
    })
  } catch (error) {
    console.error('Error fetching API keys:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch API key statuses' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/settings/api-keys
 * Save an API key
 *
 * Body: { service: ServiceType, apiKey: string, verify?: boolean }
 */
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { service, apiKey, verify = true } = body

    // Validate service
    if (!service || !API_KEY_CONFIGS[service as ServiceType]) {
      return NextResponse.json(
        { success: false, error: 'Invalid service type' },
        { status: 400 }
      )
    }

    // Validate API key
    if (!apiKey || typeof apiKey !== 'string' || apiKey.trim().length < 10) {
      return NextResponse.json(
        { success: false, error: 'Invalid API key' },
        { status: 400 }
      )
    }

    // Save the key
    const result = await saveAPIKey(service as ServiceType, apiKey.trim(), verify)

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error, verificationStatus: result.verificationStatus },
        { status: 400 }
      )
    }

    return NextResponse.json({
      success: true,
      message: `${API_KEY_CONFIGS[service as ServiceType].displayName} API key saved successfully`,
      verificationStatus: result.verificationStatus,
    })
  } catch (error) {
    console.error('Error saving API key:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to save API key' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/settings/api-keys
 * Delete an API key
 *
 * Body: { service: ServiceType }
 */
export async function DELETE(request: Request) {
  try {
    const body = await request.json()
    const { service } = body

    // Validate service
    if (!service || !API_KEY_CONFIGS[service as ServiceType]) {
      return NextResponse.json(
        { success: false, error: 'Invalid service type' },
        { status: 400 }
      )
    }

    const success = await deleteAPIKey(service as ServiceType)

    if (!success) {
      return NextResponse.json(
        { success: false, error: 'Failed to delete API key' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: `${API_KEY_CONFIGS[service as ServiceType].displayName} API key deleted`,
    })
  } catch (error) {
    console.error('Error deleting API key:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to delete API key' },
      { status: 500 }
    )
  }
}

/**
 * PUT /api/settings/api-keys
 * Verify an API key without saving
 *
 * Body: { service: ServiceType, apiKey: string }
 */
export async function PUT(request: Request) {
  try {
    const body = await request.json()
    const { service, apiKey } = body

    // Validate service
    if (!service || !API_KEY_CONFIGS[service as ServiceType]) {
      return NextResponse.json(
        { success: false, error: 'Invalid service type' },
        { status: 400 }
      )
    }

    // Validate API key
    if (!apiKey || typeof apiKey !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Invalid API key' },
        { status: 400 }
      )
    }

    const isValid = await verifyAPIKey(service as ServiceType, apiKey.trim())

    return NextResponse.json({
      success: true,
      valid: isValid,
      message: isValid ? 'API key is valid' : 'API key verification failed',
    })
  } catch (error) {
    console.error('Error verifying API key:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to verify API key' },
      { status: 500 }
    )
  }
}
