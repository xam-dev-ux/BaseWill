// Keeper configuration and contract ABI

export const CONTRACT_ADDRESS = process.env.BASEWILL_CONTRACT_ADDRESS || '';

// BaseWill ABI - Functions needed by keeper
export const BASE_WILL_ABI = [
  // Read functions
  {
    type: 'function',
    name: 'willCounter',
    inputs: [],
    outputs: [{ type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'getWillStatus',
    inputs: [{ name: 'willId', type: 'uint256' }],
    outputs: [{ type: 'uint8' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'canTriggerWill',
    inputs: [{ name: 'willId', type: 'uint256' }],
    outputs: [{ type: 'bool' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'canExecuteWill',
    inputs: [{ name: 'willId', type: 'uint256' }],
    outputs: [{ type: 'bool' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'getWillTotalValue',
    inputs: [{ name: 'willId', type: 'uint256' }],
    outputs: [{ type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'executorRewardPercent',
    inputs: [],
    outputs: [{ type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'getWill',
    inputs: [{ name: 'willId', type: 'uint256' }],
    outputs: [
      {
        type: 'tuple',
        components: [
          { name: 'testator', type: 'address' },
          { name: 'status', type: 'uint8' },
          { name: 'activationMode', type: 'uint8' },
          { name: 'inactivityThreshold', type: 'uint256' },
          { name: 'lastActivityTime', type: 'uint256' },
          { name: 'gracePeriod', type: 'uint256' },
          { name: 'triggeredAt', type: 'uint256' },
          { name: 'totalValue', type: 'uint256' },
        ],
      },
    ],
    stateMutability: 'view',
  },
  // Write functions
  {
    type: 'function',
    name: 'triggerWill',
    inputs: [{ name: 'willId', type: 'uint256' }],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'executeWill',
    inputs: [{ name: 'willId', type: 'uint256' }],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  // Events
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
    name: 'WillExecuted',
    inputs: [
      { name: 'willId', type: 'uint256', indexed: true },
      { name: 'totalDistributed', type: 'uint256', indexed: false },
    ],
  },
] as const;
