import { useAccount } from 'wagmi';
import { useState } from 'react';

function Settings() {
  const { address } = useAccount();
  const [notifications, setNotifications] = useState({
    checkInReminders: true,
    willTriggered: true,
    assetDistributed: true,
    platformUpdates: false,
  });

  return (
    <div className="space-y-8 max-w-3xl">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Settings</h1>
        <p className="text-gray-500 mt-1">Manage your preferences</p>
      </div>

      {/* Profile */}
      <div className="card">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Profile</h2>
        <div className="space-y-4">
          <div>
            <label className="label">Display Name</label>
            <input type="text" className="input" placeholder="Enter your name" />
          </div>
          <div>
            <label className="label">Connected Wallet</label>
            <div className="input bg-gray-50 text-gray-600">
              {address}
            </div>
          </div>
          <div>
            <label className="label">Email (for notifications)</label>
            <input type="email" className="input" placeholder="email@example.com" />
          </div>
        </div>
      </div>

      {/* Notifications */}
      <div className="card">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Notifications</h2>
        <div className="space-y-4">
          {[
            { key: 'checkInReminders', label: 'Check-in Reminders', description: 'Get reminded before your inactivity threshold' },
            { key: 'willTriggered', label: 'Will Triggered Alerts', description: 'Notify when your will is triggered' },
            { key: 'assetDistributed', label: 'Asset Distribution', description: 'Confirm when assets are distributed' },
            { key: 'platformUpdates', label: 'Platform Updates', description: 'News and feature announcements' },
          ].map((item) => (
            <div key={item.key} className="flex items-center justify-between py-2">
              <div>
                <p className="font-medium text-gray-900">{item.label}</p>
                <p className="text-sm text-gray-500">{item.description}</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={notifications[item.key as keyof typeof notifications]}
                  onChange={(e) =>
                    setNotifications((prev) => ({
                      ...prev,
                      [item.key]: e.target.checked,
                    }))
                  }
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-700"></div>
              </label>
            </div>
          ))}
        </div>
      </div>

      {/* Activity Tracking */}
      <div className="card">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Activity Tracking</h2>
        <div className="space-y-4">
          <div className="flex items-center justify-between py-2">
            <div>
              <p className="font-medium text-gray-900">Auto-track Transactions</p>
              <p className="text-sm text-gray-500">
                Count any transaction from your wallet as activity
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input type="checkbox" defaultChecked className="sr-only peer" />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-700"></div>
            </label>
          </div>
        </div>
      </div>

      {/* Danger Zone */}
      <div className="card border-danger-200">
        <h2 className="text-lg font-semibold text-danger-600 mb-4">Danger Zone</h2>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-gray-900">Cancel All Wills</p>
              <p className="text-sm text-gray-500">
                Cancel all your active wills and return deposited assets
              </p>
            </div>
            <button className="btn-danger btn-sm">Cancel All</button>
          </div>
        </div>
      </div>

      {/* Save */}
      <div className="flex justify-end">
        <button className="btn-primary">Save Changes</button>
      </div>
    </div>
  );
}

export default Settings;
