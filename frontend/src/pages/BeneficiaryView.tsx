import { useAccount } from 'wagmi';
import { motion } from 'framer-motion';

function BeneficiaryView() {
  const { address } = useAccount();

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Beneficiary Dashboard</h1>
        <p className="text-gray-500 mt-1">View wills where you're named as a beneficiary</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="card">
          <p className="text-sm text-gray-500">Potential Inheritance</p>
          <p className="text-2xl font-bold text-gray-900">0.00 ETH</p>
        </div>
        <div className="card">
          <p className="text-sm text-gray-500">Named in Wills</p>
          <p className="text-2xl font-bold text-gray-900">0</p>
        </div>
        <div className="card">
          <p className="text-sm text-gray-500">Claimable Now</p>
          <p className="text-2xl font-bold text-gray-900">0.00 ETH</p>
        </div>
      </div>

      {/* Empty State */}
      <div className="card">
        <div className="text-center py-12">
          <div className="w-16 h-16 mx-auto mb-4 bg-gray-100 rounded-full flex items-center justify-center">
            <HeartIcon className="w-8 h-8 text-gray-400" />
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            Not Named in Any Wills
          </h3>
          <p className="text-gray-500 max-w-sm mx-auto">
            You haven't been designated as a beneficiary in any wills yet. When someone
            adds you, their will will appear here.
          </p>
        </div>
      </div>

      {/* Info */}
      <div className="bg-primary-50 border border-primary-200 rounded-xl p-6">
        <h3 className="font-medium text-primary-900 mb-2">How Beneficiary Works</h3>
        <ul className="text-sm text-primary-700 space-y-2">
          <li className="flex items-start">
            <span className="mr-2">1.</span>
            When someone names you as a beneficiary, their will appears here
          </li>
          <li className="flex items-start">
            <span className="mr-2">2.</span>
            You can optionally accept or reject the designation
          </li>
          <li className="flex items-start">
            <span className="mr-2">3.</span>
            When a will is executed, you can claim your allocated assets
          </li>
          <li className="flex items-start">
            <span className="mr-2">4.</span>
            Vested assets are released according to the schedule set by the testator
          </li>
        </ul>
      </div>
    </div>
  );
}

function HeartIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
    </svg>
  );
}

export default BeneficiaryView;
