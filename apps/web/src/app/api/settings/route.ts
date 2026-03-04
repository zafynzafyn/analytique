import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

const SETTINGS_COOKIE = 'analytique-supabase-settings';

export async function GET() {
  try {
    const cookieStore = await cookies();
    const settingsCookie = cookieStore.get(SETTINGS_COOKIE);

    if (settingsCookie) {
      const settings = JSON.parse(settingsCookie.value);
      // Don't expose the full service key
      return NextResponse.json({
        url: settings.url || '',
        anonKey: settings.anonKey ? '••••••••' : '',
        serviceKey: settings.serviceKey ? '••••••••' : '',
        isConfigured: !!(settings.url && settings.anonKey && settings.serviceKey),
      });
    }

    // Fall back to environment variables
    return NextResponse.json({
      url: process.env.SUPABASE_URL || '',
      anonKey: process.env.SUPABASE_ANON_KEY ? '••••••••' : '',
      serviceKey: process.env.SUPABASE_SERVICE_KEY ? '••••••••' : '',
      isConfigured: !!(
        process.env.SUPABASE_URL &&
        process.env.SUPABASE_ANON_KEY &&
        process.env.SUPABASE_SERVICE_KEY
      ),
    });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to get settings' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { supabase } = body;

    if (!supabase) {
      return NextResponse.json({ error: 'Missing supabase settings' }, { status: 400 });
    }

    const cookieStore = await cookies();

    // Store settings in a secure HTTP-only cookie
    cookieStore.set(SETTINGS_COOKIE, JSON.stringify(supabase), {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 365, // 1 year
      path: '/',
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to save settings:', error);
    return NextResponse.json({ error: 'Failed to save settings' }, { status: 500 });
  }
}

export async function DELETE() {
  try {
    const cookieStore = await cookies();

    // Delete the settings cookie
    cookieStore.delete(SETTINGS_COOKIE);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to delete settings:', error);
    return NextResponse.json({ error: 'Failed to delete settings' }, { status: 500 });
  }
}
