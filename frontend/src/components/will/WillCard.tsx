import { Link } from 'react-router-dom';
import { formatDistanceToNow, differenceInDays } from 'date-fns';

interface WillData {
  id: bigint | string;
  testator: string;
  status: number;
  activationMode: number;
  inactivityThreshold: bigint | string;
  gracePeriod: bigint | string;
  createdAt: bigint | string;
  lastActivity: bigint | string;
  ethBalance?: string;
  beneficiaryCount?: number;
}

interface WillCardProps {
  will: WillData;
}

const STATUS_LABELS = ['Draft', 'Active', 'Triggered', 'Disputed', 'Executed', 'Cancelled', 'Revoked'];
const STATUS_COLORS = {
  0: 'badge-gray', // Draft
  1: 'badge-success', // Active
  2: 'badge-warning', // Triggered
  3: 'badge-danger', // Disputed
  4: 'badge-primary', // Executed
  5: 'badge-gray', // Cancelled
  6: 'badge-danger', // Revoked
};

const ACTIVATION_MODES = ['Time-Based', 'Notary Verified', 'Hybrid'];

function WillCard({ will }: WillCardProps) {
  const willId = typeof will.id === 'bigint' ? will.id.toString() : will.id;
  const lastActivity = new Date(Number(will.lastActivity) * 1000);
  const inactivityThreshold = Number(will.inactivityThreshold);
  const createdAt = new Date(Number(will.createdAt) * 1000);

  // Calculate days until trigger
  const triggerDate = new Date(lastActivity.getTime() + inactivityThreshold * 1000);
  const daysUntilTrigger = differenceInDays(triggerDate, new Date());
  const triggerProgress = Math.min(100, Math.max(0, ((inactivityThreshold - daysUntilTrigger * 86400) / inactivityThreshold) * 100));

  // Status styling
  const statusLabel = STATUS_LABELS[will.status] || 'Unknown';
  const statusClass = STATUS_COLORS[will.status as keyof typeof STATUS_COLORS] || 'badge-gray';

  // Get progress bar color based on proximity to trigger
  const getProgressColor = () => {
    if (daysUntilTrigger <= 7) return 'bg-danger-500';
    if (daysUntilTrigger <= 30) return 'bg-warning-500';
    if (daysUntilTrigger <= 90) return 'bg-secondary-500';
    return 'bg-success-500';
  };

  return (
    <Link to={`/will/${willId}`} className="block">
      <div className="card-hover transition-all duration-200 hover:scale-[1.02]">
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Will #{willId}</h3>
            <p className="text-sm text-gray-500">
              Created {formatDistanceToNow(createdAt, { addSuffix: true })}
            </p>
          </div>
          <span className={statusClass}>{statusLabel}</span>
        </div>

        {/* Value */}
        <div className="flex items-center justify-between mb-4 pb-4 border-b border-gray-100">
          <div>
            <p className="text-sm text-gray-500">Total Value</p>
            <p className="text-xl font-bold text-gray-900">
              {will.ethBalance ? `${parseFloat(will.ethBalance).toFixed(4)} ETH` : '0 ETH'}
            </p>
          </div>
          <div className="text-right">
            <p className="text-sm text-gray-500">Beneficiaries</p>
            <p className="text-xl font-bold text-gray-900">{will.beneficiaryCount || 0}</p>
          </div>
        </div>

        {/* Activity Status */}
        {will.status === 1 && ( // Only show for active wills
          <div className="mb-4">
            <div className="flex items-center justify-between text-sm mb-2">
              <span className="text-gray-500">Last activity</span>
              <span className="font-medium text-gray-700">
                {formatDistanceToNow(lastActivity, { addSuffix: true })}
              </span>
            </div>
            <div className="progress-bar">
              <div
                className={`progress-fill ${getProgressColor()}`}
                style={{ width: `${triggerProgress}%` }}
              />
            </div>
            <div className="flex items-center justify-between text-xs mt-1">
              <span className="text-gray-400">
                {daysUntilTrigger > 0 ? `${daysUntilTrigger} days until trigger` : 'Ready to trigger'}
              </span>
              <span className="text-gray-400">
                {ACTIVATION_MODES[will.activationMode]}
              </span>
            </div>
          </div>
        )}

        {/* Warning Banner for Triggered */}
        {will.status === 2 && (
          <div className="bg-warning-50 border border-warning-200 rounded-lg p-3 text-center">
            <p className="text-warning-700 font-medium text-sm">
              Will has been triggered - Grace period active
            </p>
          </div>
        )}

        {/* Action hint */}
        <div className="flex items-center justify-end text-sm text-primary-600 mt-4">
          <span>View Details</span>
          <svg className="w-4 h-4 ml-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </div>
      </div>
    </Link>
  );
}

export default WillCard;
