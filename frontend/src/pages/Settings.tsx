import React, { useState, useEffect } from 'react';
import { User, Bell, Shield, Clock } from 'lucide-react';
import { useToast } from '../components/ui/use-toast';
import { authService } from '../services/api';

const Settings: React.FC = () => {
  const { addToast } = useToast();
  const [loading, setLoading] = useState(false);
  const [settings, setSettings] = useState({
    notifications: {
      emailAlerts: true,
      pushNotifications: true,
      violationAlerts: true,
      dailyReminders: false,
    },
    privacy: {
      locationTracking: true,
      dataSharing: false,
      analytics: true,
    },
    profile: {
      name: 'John Driver',
      email: 'john.driver@example.com',
      licenseNumber: 'DL123456789',
      company: 'ABC Trucking',
    },
    hos: {
      defaultCycle: '70_8',
      timezone: 'America/New_York',
      autoCloseEnabled: true,
      autoCloseTime: '00:00',
    },
  });

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      // For now, we'll use the current settings structure
      // In a real app, you'd load the actual settings from the backend
      console.log('Settings loaded from local state');
    } catch (error) {
      console.error('Error loading settings:', error);
    }
  };

  const saveProfile = async () => {
    setLoading(true);
    try {
      await authService.updateProfile({
        name: settings.profile.name,
        email: settings.profile.email,
      });
      addToast({
        title: 'Profile Updated',
        description: 'Your profile has been updated successfully.',
      });
    } catch (error) {
      console.error('Error updating profile:', error);
      addToast({
        title: 'Error',
        description: 'Failed to update profile',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const saveHosSettings = async () => {
    setLoading(true);
    try {
      await authService.updateDriverProfile({
        timezone: settings.hos.timezone,
        default_cycle: settings.hos.defaultCycle,
        auto_close_trip_at_midnight: settings.hos.autoCloseEnabled,
        auto_close_trip_time: settings.hos.autoCloseTime,
      });
      addToast({
        title: 'HOS Settings Updated',
        description: 'Your HOS and trip settings have been updated successfully.',
      });
    } catch (error) {
      console.error('Error updating HOS settings:', error);
      addToast({
        title: 'Error',
        description: 'Failed to update HOS settings',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSettingChange = (category: string, setting: string, value: boolean | string) => {
    setSettings({
      ...settings,
      [category]: {
        ...settings[category as keyof typeof settings],
        [setting]: value,
      },
    });
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Settings</h1>
        <p className="text-gray-600 dark:text-gray-300 mt-2">Manage your account settings and preferences.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Profile Settings */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700">
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center">
              <User className="h-5 w-5 text-gray-400 dark:text-gray-500 mr-3" />
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Profile</h2>
            </div>
          </div>
          <div className="p-6 space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Full Name</label>
              <input
                type="text"
                className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                value={settings.profile.name}
                onChange={(e) => setSettings({
                  ...settings,
                  profile: { ...settings.profile, name: e.target.value }
                })}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Email</label>
              <input
                type="email"
                className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                value={settings.profile.email}
                onChange={(e) => setSettings({
                  ...settings,
                  profile: { ...settings.profile, email: e.target.value }
                })}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">License Number</label>
              <input
                type="text"
                className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                value={settings.profile.licenseNumber}
                onChange={(e) => setSettings({
                  ...settings,
                  profile: { ...settings.profile, licenseNumber: e.target.value }
                })}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Company</label>
              <input
                type="text"
                className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                value={settings.profile.company}
                onChange={(e) => setSettings({
                  ...settings,
                  profile: { ...settings.profile, company: e.target.value }
                })}
              />
            </div>
            <div className="pt-4">
              <button
                onClick={saveProfile}
                disabled={loading}
                className="w-full bg-primary-600 hover:bg-primary-700 dark:bg-primary-700 dark:hover:bg-primary-600 text-white px-4 py-2 rounded-md transition-colors disabled:opacity-50"
              >
                {loading ? 'Saving...' : 'Save Profile'}
              </button>
            </div>
          </div>
        </div>

        {/* Notification Settings */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700">
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center">
              <Bell className="h-5 w-5 text-gray-400 dark:text-gray-500 mr-3" />
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Notifications</h2>
            </div>
          </div>
          <div className="p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-900 dark:text-white">Email Alerts</p>
                <p className="text-sm text-gray-500 dark:text-gray-400">Receive notifications via email</p>
              </div>
              <button
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  settings.notifications.emailAlerts ? 'bg-primary-600 dark:bg-primary-500' : 'bg-gray-200 dark:bg-gray-600'
                }`}
                onClick={() => handleSettingChange('notifications', 'emailAlerts', !settings.notifications.emailAlerts)}
              >
                <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  settings.notifications.emailAlerts ? 'translate-x-6' : 'translate-x-1'
                }`} />
              </button>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-900 dark:text-white">Push Notifications</p>
                <p className="text-sm text-gray-500 dark:text-gray-400">Receive push notifications in app</p>
              </div>
              <button
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  settings.notifications.pushNotifications ? 'bg-primary-600 dark:bg-primary-500' : 'bg-gray-200 dark:bg-gray-600'
                }`}
                onClick={() => handleSettingChange('notifications', 'pushNotifications', !settings.notifications.pushNotifications)}
              >
                <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  settings.notifications.pushNotifications ? 'translate-x-6' : 'translate-x-1'
                }`} />
              </button>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-900 dark:text-white">Violation Alerts</p>
                <p className="text-sm text-gray-500 dark:text-gray-400">Get notified of HOS violations</p>
              </div>
              <button
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  settings.notifications.violationAlerts ? 'bg-primary-600 dark:bg-primary-500' : 'bg-gray-200 dark:bg-gray-600'
                }`}
                onClick={() => handleSettingChange('notifications', 'violationAlerts', !settings.notifications.violationAlerts)}
              >
                <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  settings.notifications.violationAlerts ? 'translate-x-6' : 'translate-x-1'
                }`} />
              </button>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-900 dark:text-white">Daily Reminders</p>
                <p className="text-sm text-gray-500 dark:text-gray-400">Daily log completion reminders</p>
              </div>
              <button
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  settings.notifications.dailyReminders ? 'bg-primary-600 dark:bg-primary-500' : 'bg-gray-200 dark:bg-gray-600'
                }`}
                onClick={() => handleSettingChange('notifications', 'dailyReminders', !settings.notifications.dailyReminders)}
              >
                <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  settings.notifications.dailyReminders ? 'translate-x-6' : 'translate-x-1'
                }`} />
              </button>
            </div>
          </div>
        </div>

        {/* Privacy Settings */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700">
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center">
              <Shield className="h-5 w-5 text-gray-400 dark:text-gray-500 mr-3" />
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Privacy & Security</h2>
            </div>
          </div>
          <div className="p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-900 dark:text-white">Location Tracking</p>
                <p className="text-sm text-gray-500 dark:text-gray-400">Allow location tracking for HOS compliance</p>
              </div>
              <button
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  settings.privacy.locationTracking ? 'bg-primary-600 dark:bg-primary-500' : 'bg-gray-200 dark:bg-gray-600'
                }`}
                onClick={() => handleSettingChange('privacy', 'locationTracking', !settings.privacy.locationTracking)}
              >
                <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  settings.privacy.locationTracking ? 'translate-x-6' : 'translate-x-1'
                }`} />
              </button>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-900 dark:text-white">Data Sharing</p>
                <p className="text-sm text-gray-500 dark:text-gray-400">Share anonymized data for improvements</p>
              </div>
              <button
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  settings.privacy.dataSharing ? 'bg-primary-600 dark:bg-primary-500' : 'bg-gray-200 dark:bg-gray-600'
                }`}
                onClick={() => handleSettingChange('privacy', 'dataSharing', !settings.privacy.dataSharing)}
              >
                <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  settings.privacy.dataSharing ? 'translate-x-6' : 'translate-x-1'
                }`} />
              </button>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-900 dark:text-white">Analytics</p>
                <p className="text-sm text-gray-500 dark:text-gray-400">Help improve the app with usage analytics</p>
              </div>
              <button
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  settings.privacy.analytics ? 'bg-primary-600 dark:bg-primary-500' : 'bg-gray-200 dark:bg-gray-600'
                }`}
                onClick={() => handleSettingChange('privacy', 'analytics', !settings.privacy.analytics)}
              >
                <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  settings.privacy.analytics ? 'translate-x-6' : 'translate-x-1'
                }`} />
              </button>
            </div>
          </div>
        </div>

        {/* HOS Settings */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700">
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center">
              <Clock className="h-5 w-5 text-gray-400 dark:text-gray-500 mr-3" />
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">HOS & Trip Settings</h2>
            </div>
          </div>
          <div className="p-6 space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Default HOS Cycle</label>
              <select
                className="block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                value={settings.hos.defaultCycle}
                onChange={(e) => handleSettingChange('hos', 'defaultCycle', e.target.value)}
              >
                <option value="70_8">70 hours / 8 days (Property-carrying)</option>
                <option value="60_7">60 hours / 7 days (Passenger-carrying)</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Time Zone</label>
              <select
                className="block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                value={settings.hos.timezone}
                onChange={(e) => handleSettingChange('hos', 'timezone', e.target.value)}
              >
                <option value="America/New_York">Eastern Time</option>
                <option value="America/Chicago">Central Time</option>
                <option value="America/Denver">Mountain Time</option>
                <option value="America/Los_Angeles">Pacific Time</option>
              </select>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-900 dark:text-white">Auto-close Trip</p>
                <p className="text-sm text-gray-500 dark:text-gray-400">Automatically close current trip at specified time</p>
              </div>
              <button
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  settings.hos.autoCloseEnabled ? 'bg-primary-600 dark:bg-primary-500' : 'bg-gray-200 dark:bg-gray-600'
                }`}
                onClick={() => handleSettingChange('hos', 'autoCloseEnabled', !settings.hos.autoCloseEnabled)}
              >
                <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  settings.hos.autoCloseEnabled ? 'translate-x-6' : 'translate-x-1'
                }`} />
              </button>
            </div>
            {settings.hos.autoCloseEnabled && (
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Auto-close Time</label>
                <input
                  type="time"
                  className="block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  value={settings.hos.autoCloseTime}
                  onChange={(e) => handleSettingChange('hos', 'autoCloseTime', e.target.value)}
                />
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  Time in your selected timezone when trips will be automatically closed
                </p>
              </div>
            )}
            <div className="pt-4">
              <button
                onClick={saveHosSettings}
                disabled={loading}
                className="w-full bg-primary-600 hover:bg-primary-700 dark:bg-primary-700 dark:hover:bg-primary-600 text-white px-4 py-2 rounded-md transition-colors disabled:opacity-50"
              >
                {loading ? 'Saving...' : 'Save HOS Settings'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Settings;
