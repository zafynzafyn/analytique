import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

const SETTINGS_COOKIE = 'analytique-supabase-settings';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    let { url, anonKey, serviceKey } = body;

    // If no credentials provided, check for existing config
    if (!url && !anonKey) {
      // First check cookies
      const cookieStore = await cookies();
      const settingsCookie = cookieStore.get(SETTINGS_COOKIE);

      if (settingsCookie) {
        try {
          const savedSettings = JSON.parse(settingsCookie.value);
          url = savedSettings.url;
          anonKey = savedSettings.anonKey;
          serviceKey = savedSettings.serviceKey;
        } catch {
          // Invalid cookie, continue with env vars
        }
      }

      // Fall back to environment variables
      if (!url) {
        url = process.env.SUPABASE_URL || '';
        anonKey = process.env.SUPABASE_ANON_KEY || '';
        serviceKey = process.env.SUPABASE_SERVICE_KEY || '';
      }
    }

    if (!url || !anonKey) {
      return NextResponse.json(
        { success: false, error: 'No database configuration found. Please enter your Supabase credentials.' },
        { status: 400 }
      );
    }

    // Validate URL format
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(url);
    } catch {
      return NextResponse.json(
        { success: false, error: 'Invalid URL format' },
        { status: 400 }
      );
    }

    // Validate it looks like a Supabase URL
    if (!parsedUrl.hostname.includes('supabase')) {
      return NextResponse.json(
        { success: false, error: 'URL does not appear to be a Supabase project URL' },
        { status: 400 }
      );
    }

    // Use the service key if available, otherwise use anon key
    const apiKey = serviceKey || anonKey;

    // Basic key format validation (Supabase keys are JWTs)
    if (!apiKey.includes('.') || apiKey.length < 100) {
      return NextResponse.json(
        { success: false, error: 'Invalid API key format' },
        { status: 400 }
      );
    }

    try {
      // Test by querying a system table that should exist
      // Using the PostgREST endpoint to query information_schema
      const testUrl = `${parsedUrl.origin}/rest/v1/`;

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

      const response = await fetch(testUrl, {
        method: 'GET',
        headers: {
          'apikey': apiKey,
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      // Log for debugging
      console.log('[Test Connection] Status:', response.status);

      // Check response status
      if (response.status === 401) {
        return NextResponse.json(
          { success: false, error: 'Invalid API key - authentication failed' },
          { status: 401 }
        );
      }

      if (response.status === 403) {
        return NextResponse.json(
          { success: false, error: 'Access forbidden - check your API key permissions' },
          { status: 403 }
        );
      }

      // Try to parse the response to check for Supabase-specific errors
      const responseText = await response.text();
      console.log('[Test Connection] Response:', responseText.substring(0, 200));

      // Check for common Supabase error patterns
      if (responseText.includes('Invalid API key') ||
          responseText.includes('invalid_token') ||
          responseText.includes('JWT')) {
        return NextResponse.json(
          { success: false, error: 'Invalid API key' },
          { status: 401 }
        );
      }

      // If status is not in 2xx range and not a specific error we handle
      if (response.status >= 400) {
        return NextResponse.json(
          { success: false, error: `Connection failed with status ${response.status}` },
          { status: response.status }
        );
      }

      // Successful connection
      return NextResponse.json({ success: true });

    } catch (fetchError) {
      console.error('[Test Connection] Fetch error:', fetchError);

      if (fetchError instanceof Error) {
        if (fetchError.name === 'AbortError') {
          return NextResponse.json(
            { success: false, error: 'Connection timed out - check the URL' },
            { status: 408 }
          );
        }

        const errorMessage = fetchError.message.toLowerCase();

        if (errorMessage.includes('enotfound') ||
            errorMessage.includes('getaddrinfo') ||
            errorMessage.includes('dns')) {
          return NextResponse.json(
            { success: false, error: 'Cannot resolve hostname - check the URL' },
            { status: 400 }
          );
        }

        if (errorMessage.includes('econnrefused') ||
            errorMessage.includes('econnreset')) {
          return NextResponse.json(
            { success: false, error: 'Connection refused - check the URL' },
            { status: 400 }
          );
        }

        return NextResponse.json(
          { success: false, error: `Network error: ${fetchError.message}` },
          { status: 500 }
        );
      }

      return NextResponse.json(
        { success: false, error: 'Connection failed' },
        { status: 500 }
      );
    }

  } catch (error) {
    console.error('[Test Connection] Error:', error);
    return NextResponse.json(
      { success: false, error: 'Connection test failed' },
      { status: 500 }
    );
  }
}
