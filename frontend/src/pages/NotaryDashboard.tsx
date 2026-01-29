import { useState } from 'react';

function NotaryDashboard() {
  const [isRegistered] = useState(false);

  if (!isRegistered) {
    return (
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Become a Notary</h1>
          <p className="text-gray-500 mt-1">Verify death claims and earn rewards</p>
        </div>

        <div className="card max-w-2xl mx-auto">
          <div className="text-center py-8">
            <div className="w-20 h-20 mx-auto mb-6 bg-primary-100 rounded-full flex items-center justify-center">
              <ScaleIcon className="w-10 h-10 text-primary-700" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">
              Join the Notary Network
            </h2>
            <p className="text-gray-600 max-w-md mx-auto mb-8">
              Notaries play a crucial role in verifying death claims and ensuring
              assets are distributed to the right beneficiaries. Earn rewards for
              each successful verification.
            </p>

            <div className="bg-gray-50 rounded-lg p-6 mb-8 text-left">
              <h3 className="font-medium text-gray-900 mb-4">Requirements</h3>
              <ul className="space-y-3 text-gray-600">
                <li className="flex items-center">
                  <CheckIcon className="w-5 h-5 text-success-500 mr-3" />
                  Stake minimum 0.1 ETH as collateral
                </li>
                <li className="flex items-center">
                  <CheckIcon className="w-5 h-5 text-success-500 mr-3" />
                  Commit to verifying claims promptly
                </li>
                <li className="flex items-center">
                  <CheckIcon className="w-5 h-5 text-success-500 mr-3" />
                  Maintain reputation through accurate verifications
                </li>
              </ul>
            </div>

            <div className="bg-warning-50 border border-warning-200 rounded-lg p-4 mb-8 text-left">
              <p className="text-sm text-warning-800">
                <strong>Warning:</strong> False verifications result in stake slashing.
                Only verify claims you can confirm with legitimate proof.
              </p>
            </div>

            <button className="btn-primary btn-lg">
              Register as Notary (Stake 0.1 ETH)
            </button>
          </div>
        </div>

        {/* How it works */}
        <div className="card max-w-2xl mx-auto">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">How Notary Verification Works</h3>
          <div className="space-y-4">
            {[
              {
                step: 1,
                title: 'Receive Verification Request',
                description: 'When a will requires notary verification, assigned notaries are notified.',
              },
              {
                step: 2,
                title: 'Review Evidence',
                description: 'Examine the submitted death certificate or proof documents.',
              },
              {
                step: 3,
                title: 'Submit Verification',
                description: 'Submit your verification onchain with the proof hash.',
              },
              {
                step: 4,
                title: 'Earn Rewards',
                description: 'When the will executes, receive your share of the notary reward.',
              },
            ].map((item) => (
              <div key={item.step} className="flex items-start space-x-4">
                <div className="w-8 h-8 bg-primary-100 text-primary-700 rounded-full flex items-center justify-center font-bold flex-shrink-0">
                  {item.step}
                </div>
                <div>
                  <h4 className="font-medium text-gray-900">{item.title}</h4>
                  <p className="text-sm text-gray-500">{item.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Notary Dashboard</h1>
        <p className="text-gray-500 mt-1">Manage verifications and track rewards</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="card">
          <p className="text-sm text-gray-500">Stake</p>
          <p className="text-2xl font-bold text-gray-900">0.10 ETH</p>
        </div>
        <div className="card">
          <p className="text-sm text-gray-500">Reputation</p>
          <p className="text-2xl font-bold text-gray-900">50/100</p>
        </div>
        <div className="card">
          <p className="text-sm text-gray-500">Verifications</p>
          <p className="text-2xl font-bold text-gray-900">0</p>
        </div>
        <div className="card">
          <p className="text-sm text-gray-500">Rewards Earned</p>
          <p className="text-2xl font-bold text-gray-900">0.00 ETH</p>
        </div>
      </div>

      {/* Pending Verifications */}
      <div className="card">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Pending Verifications</h2>
        <div className="text-center py-8 text-gray-500">
          No pending verification requests
        </div>
      </div>
    </div>
  );
}

function ScaleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3" />
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

export default NotaryDashboard;
