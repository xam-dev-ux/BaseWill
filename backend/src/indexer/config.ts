// Contract configuration for the indexer

export const CONTRACT_ADDRESS = process.env.BASEWILL_CONTRACT_ADDRESS || '';
export const NOTARY_REGISTRY_ADDRESS = process.env.NOTARY_REGISTRY_ADDRESS || '';

// BaseWill ABI - Events and key functions
export const BASE_WILL_ABI = [
  // Events
  {
    type: 'event',
    name: 'WillCreated',
    inputs: [
      { name: 'willId', type: 'uint256', indexed: true },
      { name: 'testator', type: 'address', indexed: true },
      { name: 'inactivityThreshold', type: 'uint256', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'WillUpdated',
    inputs: [
      { name: 'willId', type: 'uint256', indexed: true },
    ],
  },
  {
    type: 'event',
    name: 'WillCancelled',
    inputs: [
      { name: 'willId', type: 'uint256', indexed: true },
    ],
  },
  {
    type: 'event',
    name: 'BeneficiaryAdded',
    inputs: [
      { name: 'willId', type: 'uint256', indexed: true },
      { name: 'beneficiary', type: 'address', indexed: true },
      { name: 'allocationBps', type: 'uint256', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'BeneficiaryRemoved',
    inputs: [
      { name: 'willId', type: 'uint256', indexed: true },
      { name: 'beneficiary', type: 'address', indexed: true },
    ],
  },
  {
    type: 'event',
    name: 'BeneficiaryUpdated',
    inputs: [
      { name: 'willId', type: 'uint256', indexed: true },
      { name: 'beneficiary', type: 'address', indexed: true },
      { name: 'newAllocationBps', type: 'uint256', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'ActivityRecorded',
    inputs: [
      { name: 'willId', type: 'uint256', indexed: true },
      { name: 'timestamp', type: 'uint256', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'CheckIn',
    inputs: [
      { name: 'willId', type: 'uint256', indexed: true },
      { name: 'by', type: 'address', indexed: true },
    ],
  },
  {
    type: 'event',
    name: 'WillTriggered',
    inputs: [
      { name: 'willId', type: 'uint256', indexed: true },
      { name: 'gracePeriodEnd', type: 'uint256', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'TriggerCancelled',
    inputs: [
      { name: 'willId', type: 'uint256', indexed: true },
    ],
  },
  {
    type: 'event',
    name: 'WillExecuted',
    inputs: [
      { name: 'willId', type: 'uint256', indexed: true },
      { name: 'totalDistributed', type: 'uint256', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'AssetDistributed',
    inputs: [
      { name: 'willId', type: 'uint256', indexed: true },
      { name: 'beneficiary', type: 'address', indexed: true },
      { name: 'amount', type: 'uint256', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'AssetClaimed',
    inputs: [
      { name: 'willId', type: 'uint256', indexed: true },
      { name: 'beneficiary', type: 'address', indexed: true },
      { name: 'amount', type: 'uint256', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'NotaryAssigned',
    inputs: [
      { name: 'willId', type: 'uint256', indexed: true },
      { name: 'notary', type: 'address', indexed: true },
    ],
  },
  {
    type: 'event',
    name: 'NotaryVerificationSubmitted',
    inputs: [
      { name: 'willId', type: 'uint256', indexed: true },
      { name: 'notary', type: 'address', indexed: true },
      { name: 'verified', type: 'bool', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'EmergencyWithdrawalInitiated',
    inputs: [
      { name: 'willId', type: 'uint256', indexed: true },
      { name: 'cooldownEnd', type: 'uint256', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'EmergencyWithdrawalCompleted',
    inputs: [
      { name: 'willId', type: 'uint256', indexed: true },
    ],
  },
  {
    type: 'event',
    name: 'DisputeFiled',
    inputs: [
      { name: 'willId', type: 'uint256', indexed: true },
      { name: 'filer', type: 'address', indexed: true },
      { name: 'reason', type: 'string', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'DisputeResolved',
    inputs: [
      { name: 'willId', type: 'uint256', indexed: true },
      { name: 'inFavor', type: 'bool', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'NotaryRegistered',
    inputs: [
      { name: 'notary', type: 'address', indexed: true },
      { name: 'stake', type: 'uint256', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'NotarySlashed',
    inputs: [
      { name: 'notary', type: 'address', indexed: true },
      { name: 'slashedAmount', type: 'uint256', indexed: false },
    ],
  },
] as const;
