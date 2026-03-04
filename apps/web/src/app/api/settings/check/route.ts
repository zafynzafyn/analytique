import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

const SETTINGS_COOKIE = 'analytique-supabase-settings';

export async function GET() {
  try {
    // Check for cookie-based configuration first
    const cookieStore = await cookies();
    const settingsCookie = cookieStore.get(SETTINGS_COOKIE);

    if (settingsCookie) {
      try {
        const savedSettings = JSON.parse(settingsCookie.value);
        if (savedSettings.url && savedSettings.anonKey) {
          return NextResponse.json({
            hasEnvConfig: false,
            hasCookieConfig: true,
            url: savedSettings.url,
            source: 'app',
          });
        }
      } catch {
        // Invalid cookie, continue
      }
    }

    // Check for environment variable configuration
    const envUrl = process.env.SUPABASE_URL || '';
    const envAnonKey = process.env.SUPABASE_ANON_KEY || '';
    const envServiceKey = process.env.SUPABASE_SERVICE_KEY || '';

    const hasEnvConfig = !!(envUrl && envAnonKey);

    return NextResponse.json({
      hasEnvConfig,
      hasCookieConfig: false,
      url: hasEnvConfig ? envUrl : '',
      source: hasEnvConfig ? 'env' : 'none',
    });
  } catch (error) {
    console.error('Failed to check config:', error);
    return NextResponse.json({
      hasEnvConfig: false,
      hasCookieConfig: false,
      url: '',
      source: 'none',
    });
  }
}
