import { Link } from 'react-router-dom';
import { useAccount } from 'wagmi';
import { motion } from 'framer-motion';
import { formatDistanceToNow } from 'date-fns';
import WillCard from '../components/will/WillCard';
import { useTestatorWills } from '../hooks/useWill';

function Dashboard() {
  const { address } = useAccount();
  const { data: wills, isLoading, error } = useTestatorWills(address);

  // Calculate stats from wills
  const stats = {
    totalValue: wills?.reduce((acc, will) => acc + parseFloat(will.ethBalance || '0'), 0) || 0,
    activeWills: wills?.filter(w => w.status === 1).length || 0,
    totalBeneficiaries: wills?.reduce((acc, will) => acc + (will.beneficiaryCount || 0), 0) || 0,
    lastActivity: wills?.[0]?.lastActivityTime ? new Date(Number(wills[0].lastActivityTime) * 1000) : null,
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">My Wills</h1>
          <p className="text-gray-500 mt-1">Manage your digital estate</p>
        </div>
        <Link to="/create" className="btn-primary btn-lg mt-4 md:mt-0">
          <PlusIcon className="w-5 h-5 mr-2" />
          Create New Will
        </Link>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          label="Total Value Secured"
          value={`${stats.totalValue.toFixed(4)} ETH`}
          icon={<WalletIcon className="w-6 h-6" />}
          color="primary"
        />
        <StatCard
          label="Active Wills"
          value={stats.activeWills.toString()}
          icon={<DocumentIcon className="w-6 h-6" />}
          color="success"
        />
        <StatCard
          label="Total Beneficiaries"
          value={stats.totalBeneficiaries.toString()}
          icon={<UsersIcon className="w-6 h-6" />}
          color="secondary"
        />
        <StatCard
          label="Last Activity"
          value={stats.lastActivity ? formatDistanceToNow(stats.lastActivity, { addSuffix: true }) : 'Never'}
          icon={<ClockIcon className="w-6 h-6" />}
          color="gray"
        />
      </div>

      {/* Quick Actions */}
      <div className="card">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h2>
        <div className="flex flex-wrap gap-3">
          <button className="btn-success flex items-center">
            <CheckIcon className="w-4 h-4 mr-2" />
            Check In (All Wills)
          </button>
          <Link to="/create" className="btn-outline flex items-center">
            <PlusIcon className="w-4 h-4 mr-2" />
            Create New Will
          </Link>
          <Link to="/beneficiary" className="btn-ghost flex items-center">
            <HeartIcon className="w-4 h-4 mr-2" />
            View as Beneficiary
          </Link>
        </div>
      </div>

      {/* Wills List */}
      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Your Wills</h2>

        {isLoading ? (
          <div className="flex justify-center py-12">
            <div className="spinner" />
          </div>
        ) : error ? (
          <div className="card text-center py-12">
            <p className="text-danger-500">Error loading wills. Please try again.</p>
          </div>
        ) : wills && wills.length > 0 ? (
          <div className="grid gap-4 md:grid-cols-2">
            {wills.map((will, index) => (
              <motion.div
                key={will.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: index * 0.1 }}
              >
                <WillCard will={will} />
              </motion.div>
            ))}
          </div>
        ) : (
          <div className="card text-center py-12">
            <div className="empty-state">
              <DocumentIcon className="empty-state-icon" />
              <h3 className="empty-state-title">No wills yet</h3>
              <p className="empty-state-description mb-4">
                Create your first will to protect your digital legacy
              </p>
              <Link to="/create" className="btn-primary">
                Create Your First Will
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Stat Card Component
function StatCard({
  label,
  value,
  icon,
  color
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
  color: 'primary' | 'success' | 'secondary' | 'gray';
}) {
  const colorClasses = {
    primary: 'bg-primary-50 text-primary-700',
    success: 'bg-success-50 text-success-600',
    secondary: 'bg-secondary-50 text-secondary-600',
    gray: 'bg-gray-100 text-gray-600',
  };

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm text-gray-500">{label}</span>
        <div className={`p-2 rounded-lg ${colorClasses[color]}`}>
          {icon}
        </div>
      </div>
      <div className="text-2xl font-bold text-gray-900">{value}</div>
    </div>
  );
}

// Icons
function PlusIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
    </svg>
  );
}

function WalletIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
    </svg>
  );
}

function DocumentIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  );
}

function UsersIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
    </svg>
  );
}

function ClockIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
    </svg>
  );
}

function HeartIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
    </svg>
  );
}

export default Dashboard;
