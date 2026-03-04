'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Database,
  Save,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  KeyRound,
  Globe,
  Eye,
  EyeOff,
  Shield,
  Unplug,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import {
  loadSettings,
  saveSettings,
  isSupabaseConfigured,
  validateSupabaseUrl,
  getDefaultSettings,
  type AppSettings,
} from '@/lib/settings';

interface EnvConfig {
  hasEnvConfig: boolean;
  url: string;
}

export default function ConnectionPage() {
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [showServiceKey, setShowServiceKey] = useState(false);
  const [showAnonKey, setShowAnonKey] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
  const [connectionError, setConnectionError] = useState<string>('');
  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [showDisconnectDialog, setShowDisconnectDialog] = useState(false);
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  const [envConfig, setEnvConfig] = useState<EnvConfig | null>(null);

  useEffect(() => {
    const loadedSettings = loadSettings();
    setSettings(loadedSettings);

    // Check for existing env configuration
    fetch('/api/settings/check')
      .then(res => res.json())
      .then(data => setEnvConfig(data))
      .catch(() => setEnvConfig({ hasEnvConfig: false, url: '' }));
  }, []);

  const handleSettingsChange = (field: string, value: string) => {
    if (!settings) return;
    setSettings({
      ...settings,
      supabase: {
        ...settings.supabase,
        [field]: value,
      },
    });
    setHasChanges(true);
    setConnectionStatus('idle');
  };

  const handleTestConnection = async () => {
    setConnectionStatus('testing');
    setConnectionError('');

    try {
      // If we have settings entered, test those
      // Otherwise, test existing config (env vars or cookies)
      const hasEnteredCredentials = settings?.supabase.url && settings?.supabase.anonKey;

      const res = await fetch('/api/settings/test-connection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(hasEnteredCredentials ? settings.supabase : {}),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        setConnectionStatus('success');
      } else {
        setConnectionStatus('error');
        setConnectionError(data.error || 'Connection failed');
      }
    } catch (error) {
      setConnectionStatus('error');
      setConnectionError('Failed to test connection');
    }
  };

  const handleSaveSettings = async () => {
    if (!settings) return;
    setIsSaving(true);

    try {
      // Save to localStorage
      saveSettings(settings);

      // Save to API (for server-side usage via cookies)
      await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });

      setHasChanges(false);
    } catch (error) {
      console.error('Failed to save settings:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDisconnect = async () => {
    setIsDisconnecting(true);

    try {
      // Reset to default settings
      const defaultSettings = getDefaultSettings();
      setSettings(defaultSettings);

      // Save to localStorage
      saveSettings(defaultSettings);

      // Clear server-side cookie
      await fetch('/api/settings', {
        method: 'DELETE',
      });

      setConnectionStatus('idle');
      setHasChanges(false);
      setShowDisconnectDialog(false);
    } catch (error) {
      console.error('Failed to disconnect:', error);
    } finally {
      setIsDisconnecting(false);
    }
  };

  const isConfigured = settings ? isSupabaseConfigured(settings) : false;

  if (!settings) {
    return (
      <div className="flex items-center justify-center h-full">
        <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between p-6 border-b bg-card/50">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-500">
            <Database className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-semibold">Database Connection</h1>
            <p className="text-sm text-muted-foreground">
              Configure your Supabase database credentials
            </p>
          </div>
        </div>
        <Button
          onClick={handleSaveSettings}
          disabled={!hasChanges || isSaving}
          className="gap-2"
        >
          {isSaving ? (
            <RefreshCw className="h-4 w-4 animate-spin" />
          ) : (
            <Save className="h-4 w-4" />
          )}
          Save Changes
        </Button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-2xl space-y-6">
          {/* Environment Config Banner */}
          {envConfig?.hasEnvConfig && !isConfigured && (
            <Card className="p-4 bg-blue-500/5 border-blue-500/20">
              <div className="flex items-center gap-3">
                <Database className="h-5 w-5 text-blue-500" />
                <div className="flex-1">
                  <p className="font-medium">Environment Configuration Detected</p>
                  <p className="text-sm text-muted-foreground">
                    Supabase is configured via environment variables ({envConfig.url})
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-2"
                  onClick={handleTestConnection}
                  disabled={connectionStatus === 'testing'}
                >
                  {connectionStatus === 'testing' ? (
                    <RefreshCw className="h-4 w-4 animate-spin" />
                  ) : (
                    <Database className="h-4 w-4" />
                  )}
                  Test Connection
                </Button>
              </div>
            </Card>
          )}

          {/* Status Banner */}
          <Card className={cn(
            'p-4',
            isConfigured ? 'bg-green-500/5 border-green-500/20' : 'bg-amber-500/5 border-amber-500/20'
          )}>
            <div className="flex items-center gap-3">
              {isConfigured ? (
                <CheckCircle2 className="h-5 w-5 text-green-500" />
              ) : (
                <AlertTriangle className="h-5 w-5 text-amber-500" />
              )}
              <div className="flex-1">
                <p className="font-medium">
                  {isConfigured ? 'Supabase Connected' : 'Supabase Not Configured'}
                </p>
                <p className="text-sm text-muted-foreground">
                  {isConfigured
                    ? 'Your database connection is configured and ready to use.'
                    : envConfig?.hasEnvConfig
                      ? 'You can use the environment configuration above, or enter custom credentials below.'
                      : 'Configure your Supabase credentials to start querying your database.'}
                </p>
              </div>
              {isConfigured && (
                <div className="flex items-center gap-2">
                  <Link href="/settings">
                    <Button variant="outline" size="sm" className="gap-2">
                      <Shield className="h-4 w-4" />
                      Table Security
                    </Button>
                  </Link>
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-2 text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200"
                    onClick={() => setShowDisconnectDialog(true)}
                  >
                    <Unplug className="h-4 w-4" />
                    Disconnect
                  </Button>
                </div>
              )}
            </div>
          </Card>

          {/* Supabase URL */}
          <div className="space-y-2">
            <label className="text-sm font-medium flex items-center gap-2">
              <Globe className="h-4 w-4" />
              Supabase URL
            </label>
            <Input
              type="url"
              placeholder="https://your-project.supabase.co"
              value={settings.supabase.url}
              onChange={(e) => handleSettingsChange('url', e.target.value)}
              className={cn(
                settings.supabase.url && !validateSupabaseUrl(settings.supabase.url) && 'border-red-500'
              )}
            />
            <p className="text-xs text-muted-foreground">
              Find this in your Supabase project settings under API
            </p>
          </div>

          {/* Anon Key */}
          <div className="space-y-2">
            <label className="text-sm font-medium flex items-center gap-2">
              <KeyRound className="h-4 w-4" />
              Anon / Public Key
            </label>
            <div className="relative">
              <Input
                type={showAnonKey ? 'text' : 'password'}
                placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                value={settings.supabase.anonKey}
                onChange={(e) => handleSettingsChange('anonKey', e.target.value)}
                className="pr-10"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute right-1 top-1 h-8 w-8"
                onClick={() => setShowAnonKey(!showAnonKey)}
              >
                {showAnonKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              The public anon key for client-side requests
            </p>
          </div>

          {/* Service Key */}
          <div className="space-y-2">
            <label className="text-sm font-medium flex items-center gap-2">
              <KeyRound className="h-4 w-4" />
              Service Role Key
              <span className="px-1.5 py-0.5 text-xs bg-red-500/10 text-red-600 rounded">Secret</span>
            </label>
            <div className="relative">
              <Input
                type={showServiceKey ? 'text' : 'password'}
                placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                value={settings.supabase.serviceKey}
                onChange={(e) => handleSettingsChange('serviceKey', e.target.value)}
                className="pr-10"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute right-1 top-1 h-8 w-8"
                onClick={() => setShowServiceKey(!showServiceKey)}
              >
                {showServiceKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              The service role key for server-side database access. Keep this secret!
            </p>
          </div>

          {/* Test Connection */}
          <div className="flex items-center gap-4 pt-4">
            <Button
              variant="outline"
              onClick={handleTestConnection}
              disabled={!settings.supabase.url || !settings.supabase.anonKey || connectionStatus === 'testing'}
              className="gap-2"
            >
              {connectionStatus === 'testing' ? (
                <RefreshCw className="h-4 w-4 animate-spin" />
              ) : (
                <Database className="h-4 w-4" />
              )}
              Test Connection
            </Button>

            {connectionStatus === 'success' && (
              <span className="text-sm text-green-600 flex items-center gap-1">
                <CheckCircle2 className="h-4 w-4" />
                Connection successful!
              </span>
            )}

            {connectionStatus === 'error' && (
              <span className="text-sm text-red-600 flex items-center gap-1">
                <AlertTriangle className="h-4 w-4" />
                {connectionError}
              </span>
            )}
          </div>

          {/* Help Link */}
          <Card className="p-4 bg-muted/30">
            <div className="flex items-start gap-3">
              <ExternalLink className="h-5 w-5 text-muted-foreground mt-0.5" />
              <div>
                <p className="font-medium">Need help?</p>
                <p className="text-sm text-muted-foreground">
                  You can find your Supabase credentials in your project&apos;s API settings.
                </p>
                <a
                  href="https://supabase.com/dashboard/project/_/settings/api"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-primary hover:underline mt-1 inline-block"
                >
                  Open Supabase Dashboard
                </a>
              </div>
            </div>
          </Card>
        </div>
      </div>

      {/* Disconnect Confirmation Dialog */}
      <Dialog open={showDisconnectDialog} onOpenChange={setShowDisconnectDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-red-500" />
              Disconnect Database
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to disconnect from Supabase? This will remove all your database credentials from this application.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Card className="p-3 bg-amber-500/5 border-amber-500/20">
              <p className="text-sm text-amber-700 dark:text-amber-400">
                You will need to re-enter your credentials to use the chat and schema features again.
              </p>
            </Card>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowDisconnectDialog(false)}
              disabled={isDisconnecting}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDisconnect}
              disabled={isDisconnecting}
              className="gap-2"
            >
              {isDisconnecting ? (
                <RefreshCw className="h-4 w-4 animate-spin" />
              ) : (
                <Unplug className="h-4 w-4" />
              )}
              Disconnect
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
