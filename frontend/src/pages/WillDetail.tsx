import { useParams, Link } from 'react-router-dom';
import { formatDistanceToNow, differenceInDays } from 'date-fns';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import { useWill, useCheckIn, useDepositETH } from '../hooks/useWill';
import { useState } from 'react';
import { parseEther } from 'viem';

const STATUS_LABELS = ['Draft', 'Active', 'Triggered', 'Disputed', 'Executed', 'Cancelled', 'Revoked'];
const STATUS_COLORS = {
  0: 'bg-gray-100 text-gray-700', // Draft
  1: 'bg-success-50 text-success-700', // Active
  2: 'bg-warning-50 text-warning-700', // Triggered
  3: 'bg-danger-50 text-danger-700', // Disputed
  4: 'bg-primary-50 text-primary-700', // Executed
  5: 'bg-gray-100 text-gray-700', // Cancelled
  6: 'bg-danger-50 text-danger-700', // Revoked
};

function WillDetail() {
  const { id } = useParams<{ id: string }>();
  const { data: will, isLoading, error } = useWill(id);
  const checkInMutation = useCheckIn();
  const depositMutation = useDepositETH();
  const [depositAmount, setDepositAmount] = useState('');

  if (isLoading) {
    return (
      <div className="flex justify-center items-center min-h-[400px]">
        <div className="spinner w-8 h-8" />
      </div>
    );
  }

  if (error || !will) {
    return (
      <div className="text-center py-12">
        <h2 className="text-xl font-semibold text-gray-900 mb-2">Will Not Found</h2>
        <p className="text-gray-500 mb-4">The will you're looking for doesn't exist.</p>
        <Link to="/dashboard" className="btn-primary">
          Back to Dashboard
        </Link>
      </div>
    );
  }

  const lastActivity = new Date(Number(will.lastActivity) * 1000);
  const createdAt = new Date(Number(will.createdAt) * 1000);
  const inactivityThreshold = Number(will.inactivityThreshold);
  const triggerDate = new Date(lastActivity.getTime() + inactivityThreshold * 1000);
  const daysUntilTrigger = differenceInDays(triggerDate, new Date());

  const handleCheckIn = async () => {
    try {
      await checkInMutation.mutateAsync(will.id);
      toast.success('Check-in successful!');
    } catch (error) {
      toast.error('Check-in failed. Please try again.');
    }
  };

  const handleDeposit = async () => {
    if (!depositAmount || parseFloat(depositAmount) <= 0) {
      toast.error('Please enter a valid amount');
      return;
    }

    try {
      await depositMutation.mutateAsync({
        willId: will.id,
        amount: parseEther(depositAmount),
      });
      toast.success('Deposit successful!');
      setDepositAmount('');
    } catch (error) {
      toast.error('Deposit failed. Please try again.');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between">
        <div className="flex items-center space-x-4">
          <Link to="/dashboard" className="text-gray-500 hover:text-gray-700">
            <ArrowLeftIcon className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Will #{id}</h1>
            <p className="text-gray-500">
              Created {formatDistanceToNow(createdAt, { addSuffix: true })}
            </p>
          </div>
        </div>
        <div className="flex items-center space-x-3 mt-4 md:mt-0">
          <span className={`px-4 py-2 rounded-full font-medium ${STATUS_COLORS[will.status as keyof typeof STATUS_COLORS]}`}>
            {STATUS_LABELS[will.status]}
          </span>
        </div>
      </div>

      {/* Triggered Warning */}
      {will.status === 2 && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-warning-50 border border-warning-200 rounded-xl p-6"
        >
          <div className="flex items-start space-x-4">
            <div className="flex-shrink-0">
              <AlertIcon className="w-8 h-8 text-warning-500" />
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-warning-800">
                Your Will Has Been Triggered
              </h3>
              <p className="text-warning-700 mt-1">
                You have {will.gracePeriod ? Number(will.gracePeriod) / 86400 : 30} days to cancel this activation.
                Check in now to prove you're still active.
              </p>
              <button
                onClick={handleCheckIn}
                disabled={checkInMutation.isPending}
                className="btn-warning mt-4"
              >
                {checkInMutation.isPending ? 'Checking In...' : "I'm Alive - Cancel Trigger"}
              </button>
            </div>
          </div>
        </motion.div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Activity Status */}
          {will.status === 1 && (
            <div className="card">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Activity Status</h2>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">Last Activity</span>
                  <span className="font-medium text-gray-900">
                    {formatDistanceToNow(lastActivity, { addSuffix: true })}
                  </span>
                </div>
                <div className="progress-bar h-3">
                  <div
                    className={`progress-fill ${
                      daysUntilTrigger <= 7 ? 'bg-danger-500' :
                      daysUntilTrigger <= 30 ? 'bg-warning-500' :
                      daysUntilTrigger <= 90 ? 'bg-secondary-500' : 'bg-success-500'
                    }`}
                    style={{
                      width: `${Math.min(100, ((inactivityThreshold - daysUntilTrigger * 86400) / inactivityThreshold) * 100)}%`
                    }}
                  />
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-500">
                    {daysUntilTrigger > 0
                      ? `${daysUntilTrigger} days until trigger`
                      : 'Ready to trigger'
                    }
                  </span>
                  <span className="text-gray-500">
                    Threshold: {Math.round(inactivityThreshold / 86400)} days
                  </span>
                </div>
                <button
                  onClick={handleCheckIn}
                  disabled={checkInMutation.isPending}
                  className="btn-success w-full"
                >
                  {checkInMutation.isPending ? (
                    <span className="flex items-center justify-center">
                      <div className="spinner w-4 h-4 mr-2" />
                      Checking In...
                    </span>
                  ) : (
                    <>
                      <CheckIcon className="w-5 h-5 mr-2" />
                      Check In Now
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* Assets */}
          <div className="card">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Assets</h2>
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-primary-100 rounded-full flex items-center justify-center">
                    <EthIcon className="w-5 h-5 text-primary-700" />
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">Ethereum</p>
                    <p className="text-sm text-gray-500">ETH</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-bold text-gray-900">
                    {parseFloat(will.ethBalance || '0').toFixed(4)} ETH
                  </p>
                </div>
              </div>

              {/* Deposit Section */}
              {(will.status === 0 || will.status === 1) && (
                <div className="pt-4 border-t border-gray-100">
                  <h3 className="text-sm font-medium text-gray-700 mb-2">Deposit ETH</h3>
                  <div className="flex space-x-2">
                    <input
                      type="number"
                      value={depositAmount}
                      onChange={(e) => setDepositAmount(e.target.value)}
                      placeholder="0.0"
                      className="input flex-1"
                      step="0.001"
                      min="0"
                    />
                    <button
                      onClick={handleDeposit}
                      disabled={depositMutation.isPending}
                      className="btn-primary"
                    >
                      {depositMutation.isPending ? 'Depositing...' : 'Deposit'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Beneficiaries */}
          <div className="card">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              Beneficiaries ({will.beneficiaryCount || 0})
            </h2>
            {will.beneficiaryCount === 0 ? (
              <p className="text-gray-500 text-center py-4">
                No beneficiaries added yet
              </p>
            ) : (
              <div className="space-y-3">
                {/* Placeholder for beneficiaries - would be fetched separately */}
                <p className="text-gray-500 text-center py-4">
                  {will.beneficiaryCount} beneficiaries configured
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Quick Info */}
          <div className="card">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Details</h2>
            <dl className="space-y-3">
              <div className="flex justify-between">
                <dt className="text-gray-500">Status</dt>
                <dd className="font-medium text-gray-900">{STATUS_LABELS[will.status]}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-500">Activation Mode</dt>
                <dd className="font-medium text-gray-900">
                  {['Time-Based', 'Notary Verified', 'Hybrid'][will.activationMode]}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-500">Inactivity Threshold</dt>
                <dd className="font-medium text-gray-900">
                  {Math.round(inactivityThreshold / 86400)} days
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-500">Grace Period</dt>
                <dd className="font-medium text-gray-900">
                  {Number(will.gracePeriod) / 86400} days
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-500">Version</dt>
                <dd className="font-medium text-gray-900">{will.version.toString()}</dd>
              </div>
            </dl>
          </div>

          {/* Actions */}
          <div className="card">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Actions</h2>
            <div className="space-y-2">
              {will.status === 0 && (
                <button className="btn-primary w-full">
                  Activate Will
                </button>
              )}
              <button className="btn-outline w-full">
                Edit Will
              </button>
              {(will.status === 0 || will.status === 1) && (
                <button className="btn-ghost w-full text-danger-600 hover:bg-danger-50">
                  Cancel Will
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Icons
function ArrowLeftIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
    </svg>
  );
}

function AlertIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
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

function EthIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 1.75L5.75 12.25L12 16L18.25 12.25L12 1.75Z" />
      <path d="M12 17.25L5.75 13.5L12 22.25L18.25 13.5L12 17.25Z" opacity="0.6" />
    </svg>
  );
}

export default WillDetail;
