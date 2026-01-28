import { usePlatformStats } from '../hooks/useWill';
import { formatEther } from 'viem';

function Stats() {
  const { data: stats, isLoading } = usePlatformStats();

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Platform Statistics</h1>
        <p className="text-gray-500 mt-1">Global metrics for BaseWill</p>
      </div>

      {/* Main Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="card bg-gradient-to-br from-primary-700 to-primary-800 text-white">
          <p className="text-primary-100 text-sm">Total Value Secured</p>
          <p className="text-4xl font-bold mt-2">
            {isLoading ? '...' : stats ? formatEther(stats.totalValueSecured) : '0'} ETH
          </p>
          <p className="text-primary-200 text-sm mt-2">Across all active wills</p>
        </div>

        <div className="card bg-gradient-to-br from-secondary-500 to-secondary-600 text-white">
          <p className="text-secondary-100 text-sm">Total Distributed</p>
          <p className="text-4xl font-bold mt-2">
            {isLoading ? '...' : stats ? formatEther(stats.totalDistributed) : '0'} ETH
          </p>
          <p className="text-secondary-200 text-sm mt-2">To beneficiaries</p>
        </div>

        <div className="card bg-gradient-to-br from-success-500 to-success-600 text-white">
          <p className="text-green-100 text-sm">Success Rate</p>
          <p className="text-4xl font-bold mt-2">99.9%</p>
          <p className="text-green-200 text-sm mt-2">Successful executions</p>
        </div>
      </div>

      {/* Secondary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="card">
          <p className="text-sm text-gray-500">Wills Created</p>
          <p className="text-2xl font-bold text-gray-900">
            {isLoading ? '...' : stats ? stats.totalWillsCreated.toString() : '0'}
          </p>
        </div>
        <div className="card">
          <p className="text-sm text-gray-500">Active Wills</p>
          <p className="text-2xl font-bold text-gray-900">
            {isLoading ? '...' : stats ? stats.activeWills.toString() : '0'}
          </p>
        </div>
        <div className="card">
          <p className="text-sm text-gray-500">Executed Wills</p>
          <p className="text-2xl font-bold text-gray-900">
            {isLoading ? '...' : stats ? stats.executedWills.toString() : '0'}
          </p>
        </div>
        <div className="card">
          <p className="text-sm text-gray-500">Registered Notaries</p>
          <p className="text-2xl font-bold text-gray-900">
            {isLoading ? '...' : stats ? stats.registeredNotaries.toString() : '0'}
          </p>
        </div>
      </div>

      {/* Charts placeholder */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="card">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Wills Over Time</h2>
          <div className="h-64 flex items-center justify-center bg-gray-50 rounded-lg">
            <p className="text-gray-400">Chart coming soon</p>
          </div>
        </div>
        <div className="card">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Value Distribution</h2>
          <div className="h-64 flex items-center justify-center bg-gray-50 rounded-lg">
            <p className="text-gray-400">Chart coming soon</p>
          </div>
        </div>
      </div>

      {/* Leaderboards placeholder */}
      <div className="card">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Top Notaries</h2>
        <div className="text-center py-8 text-gray-500">
          Leaderboard data coming soon
        </div>
      </div>
    </div>
  );
}

export default Stats;
