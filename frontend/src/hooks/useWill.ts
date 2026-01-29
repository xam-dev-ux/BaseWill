import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAccount, usePublicClient, useWalletClient } from 'wagmi';
import { getContractAddresses } from '../config/wagmi';
import { formatEther } from 'viem';

// ABI fragments for BaseWill contract (JSON format for complex tuples)
const baseWillAbi = [
  {
    name: 'getWill',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'willId', type: 'uint256' }],
    outputs: [{
      name: '',
      type: 'tuple',
      components: [
        { name: 'id', type: 'uint256' },
        { name: 'testator', type: 'address' },
        { name: 'status', type: 'uint8' },
        { name: 'activationMode', type: 'uint8' },
        { name: 'privacyMode', type: 'uint8' },
        { name: 'inactivityThreshold', type: 'uint256' },
        { name: 'gracePeriod', type: 'uint256' },
        { name: 'disputePeriod', type: 'uint256' },
        { name: 'createdAt', type: 'uint256' },
        { name: 'updatedAt', type: 'uint256' },
        { name: 'lastActivity', type: 'uint256' },
        { name: 'triggerTime', type: 'uint256' },
        { name: 'executionTime', type: 'uint256' },
        { name: 'metadataHash', type: 'bytes32' },
        { name: 'encryptedDataHash', type: 'bytes32' },
        { name: 'backupExecutor', type: 'address' },
        { name: 'version', type: 'uint256' },
      ],
    }],
  },
  {
    name: 'getTestatorWills',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'testator', type: 'address' }],
    outputs: [{ name: '', type: 'uint256[]' }],
  },
  {
    name: 'getBeneficiaryWills',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'beneficiary', type: 'address' }],
    outputs: [{ name: '', type: 'uint256[]' }],
  },
  {
    name: 'getBeneficiaries',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'willId', type: 'uint256' }],
    outputs: [{
      name: '',
      type: 'tuple[]',
      components: [
        { name: 'beneficiaryAddress', type: 'address' },
        { name: 'allocationBps', type: 'uint256' },
        {
          name: 'vestingSchedule',
          type: 'tuple',
          components: [
            { name: 'vestingType', type: 'uint8' },
            { name: 'startDelay', type: 'uint256' },
            { name: 'duration', type: 'uint256' },
            { name: 'cliffDuration', type: 'uint256' },
            { name: 'releaseInterval', type: 'uint256' },
            { name: 'milestoneCondition', type: 'bytes32' },
          ],
        },
        { name: 'isPrimary', type: 'bool' },
        { name: 'hasAccepted', type: 'bool' },
        { name: 'labelHash', type: 'bytes32' },
        { name: 'amountClaimed', type: 'uint256' },
        { name: 'lastClaimTime', type: 'uint256' },
      ],
    }],
  },
  {
    name: 'getWillValue',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'willId', type: 'uint256' }],
    outputs: [
      { name: 'ethBalance', type: 'uint256' },
      { name: 'tokenBalances', type: 'uint256[]' },
      { name: 'nftCount', type: 'uint256' },
    ],
  },
  {
    name: 'getPlatformStats',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{
      name: '',
      type: 'tuple',
      components: [
        { name: 'totalValueSecured', type: 'uint256' },
        { name: 'totalWillsCreated', type: 'uint256' },
        { name: 'activeWills', type: 'uint256' },
        { name: 'executedWills', type: 'uint256' },
        { name: 'totalDistributed', type: 'uint256' },
        { name: 'registeredNotaries', type: 'uint256' },
      ],
    }],
  },
  {
    name: 'createWill',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'activationMode', type: 'uint8' },
      { name: 'inactivityThreshold', type: 'uint256' },
      { name: 'gracePeriod', type: 'uint256' },
      { name: 'disputePeriod', type: 'uint256' },
      { name: 'metadataHash', type: 'bytes32' },
      { name: 'backupExecutor', type: 'address' },
    ],
    outputs: [{ name: 'willId', type: 'uint256' }],
  },
  {
    name: 'checkIn',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'willId', type: 'uint256' }],
    outputs: [],
  },
  {
    name: 'depositETH',
    type: 'function',
    stateMutability: 'payable',
    inputs: [{ name: 'willId', type: 'uint256' }],
    outputs: [],
  },
  {
    name: 'activateWill',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'willId', type: 'uint256' }],
    outputs: [],
  },
  {
    name: 'cancelWill',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'willId', type: 'uint256' },
      { name: 'reason', type: 'string' },
    ],
    outputs: [],
  },
  {
    name: 'addBeneficiary',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'willId', type: 'uint256' },
      { name: 'beneficiary', type: 'address' },
      { name: 'allocationBps', type: 'uint256' },
      {
        name: 'vestingSchedule',
        type: 'tuple',
        components: [
          { name: 'vestingType', type: 'uint8' },
          { name: 'startDelay', type: 'uint256' },
          { name: 'duration', type: 'uint256' },
          { name: 'cliffDuration', type: 'uint256' },
          { name: 'releaseInterval', type: 'uint256' },
          { name: 'milestoneCondition', type: 'bytes32' },
        ],
      },
      { name: 'isPrimary', type: 'bool' },
      { name: 'labelHash', type: 'bytes32' },
    ],
    outputs: [],
  },
  {
    name: 'removeBeneficiary',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'willId', type: 'uint256' },
      { name: 'beneficiary', type: 'address' },
    ],
    outputs: [],
  },
] as const;

export interface PlatformStats {
  totalValueSecured: bigint;
  totalWillsCreated: bigint;
  activeWills: bigint;
  executedWills: bigint;
  totalDistributed: bigint;
  registeredNotaries: bigint;
}

export interface WillData {
  id: bigint;
  testator: `0x${string}`;
  status: number;
  activationMode: number;
  privacyMode: number;
  inactivityThreshold: bigint;
  gracePeriod: bigint;
  disputePeriod: bigint;
  createdAt: bigint;
  updatedAt: bigint;
  lastActivity: bigint;
  triggerTime: bigint;
  executionTime: bigint;
  metadataHash: `0x${string}`;
  encryptedDataHash: `0x${string}`;
  backupExecutor: `0x${string}`;
  version: bigint;
  ethBalance?: string;
  beneficiaryCount?: number;
}

// Hook to get a single will
export function useWill(willId: string | undefined) {
  const { chain } = useAccount();
  const publicClient = usePublicClient();
  const addresses = chain ? getContractAddresses(chain.id) : null;

  return useQuery({
    queryKey: ['will', willId, chain?.id],
    queryFn: async (): Promise<WillData | null> => {
      if (!publicClient || !addresses || !willId) return null;

      try {
        const will = await publicClient.readContract({
          address: addresses.baseWill as `0x${string}`,
          abi: baseWillAbi,
          functionName: 'getWill',
          args: [BigInt(willId)],
        }) as WillData;

        // Get additional data
        const [value, beneficiaries] = await Promise.all([
          publicClient.readContract({
            address: addresses.baseWill as `0x${string}`,
            abi: baseWillAbi,
            functionName: 'getWillValue',
            args: [BigInt(willId)],
          }),
          publicClient.readContract({
            address: addresses.baseWill as `0x${string}`,
            abi: baseWillAbi,
            functionName: 'getBeneficiaries',
            args: [BigInt(willId)],
          }),
        ]);

        return {
          ...will,
          ethBalance: formatEther((value as [bigint, bigint[], bigint])[0]),
          beneficiaryCount: (beneficiaries as unknown[]).length,
        };
      } catch (error) {
        console.error('Error fetching will:', error);
        return null;
      }
    },
    enabled: !!publicClient && !!addresses && !!willId,
  });
}

// Hook to get all wills for a testator
export function useTestatorWills(testator: `0x${string}` | undefined) {
  const { chain } = useAccount();
  const publicClient = usePublicClient();
  const addresses = chain ? getContractAddresses(chain.id) : null;

  return useQuery({
    queryKey: ['testatorWills', testator, chain?.id],
    queryFn: async (): Promise<WillData[]> => {
      if (!publicClient || !addresses || !testator) return [];

      try {
        const willIds = await publicClient.readContract({
          address: addresses.baseWill as `0x${string}`,
          abi: baseWillAbi,
          functionName: 'getTestatorWills',
          args: [testator],
        }) as bigint[];

        const wills = await Promise.all(
          willIds.map(async (id) => {
            const will = await publicClient.readContract({
              address: addresses.baseWill as `0x${string}`,
              abi: baseWillAbi,
              functionName: 'getWill',
              args: [id],
            }) as WillData;

            const [value, beneficiaries] = await Promise.all([
              publicClient.readContract({
                address: addresses.baseWill as `0x${string}`,
                abi: baseWillAbi,
                functionName: 'getWillValue',
                args: [id],
              }),
              publicClient.readContract({
                address: addresses.baseWill as `0x${string}`,
                abi: baseWillAbi,
                functionName: 'getBeneficiaries',
                args: [id],
              }),
            ]);

            return {
              ...will,
              ethBalance: formatEther((value as [bigint, bigint[], bigint])[0]),
              beneficiaryCount: (beneficiaries as unknown[]).length,
            };
          })
        );

        return wills;
      } catch (error) {
        console.error('Error fetching testator wills:', error);
        return [];
      }
    },
    enabled: !!publicClient && !!addresses && !!testator,
  });
}

// Hook to get platform statistics
export function usePlatformStats() {
  const { chain } = useAccount();
  const publicClient = usePublicClient();
  const addresses = chain ? getContractAddresses(chain.id) : null;

  return useQuery({
    queryKey: ['platformStats', chain?.id],
    queryFn: async (): Promise<PlatformStats | null> => {
      if (!publicClient || !addresses) return null;

      try {
        const stats = await publicClient.readContract({
          address: addresses.baseWill as `0x${string}`,
          abi: baseWillAbi,
          functionName: 'getPlatformStats',
        }) as PlatformStats;

        return stats;
      } catch (error) {
        console.error('Error fetching platform stats:', error);
        return null;
      }
    },
    enabled: !!publicClient && !!addresses,
  });
}

// Hook for creating a will
export function useCreateWill() {
  const { chain } = useAccount();
  const { data: walletClient } = useWalletClient();
  const publicClient = usePublicClient();
  const queryClient = useQueryClient();
  const addresses = chain ? getContractAddresses(chain.id) : null;

  return useMutation({
    mutationFn: async (params: {
      activationMode: number;
      inactivityThreshold: bigint;
      gracePeriod: bigint;
      disputePeriod: bigint;
      metadataHash: `0x${string}`;
      backupExecutor: `0x${string}`;
    }) => {
      if (!walletClient || !publicClient || !addresses) {
        throw new Error('Wallet not connected');
      }

      const hash = await walletClient.writeContract({
        address: addresses.baseWill as `0x${string}`,
        abi: baseWillAbi,
        functionName: 'createWill',
        args: [
          params.activationMode,
          params.inactivityThreshold,
          params.gracePeriod,
          params.disputePeriod,
          params.metadataHash,
          params.backupExecutor,
        ],
      });

      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      return receipt;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['testatorWills'] });
      queryClient.invalidateQueries({ queryKey: ['platformStats'] });
    },
  });
}

// Hook for check-in
export function useCheckIn() {
  const { chain } = useAccount();
  const { data: walletClient } = useWalletClient();
  const publicClient = usePublicClient();
  const queryClient = useQueryClient();
  const addresses = chain ? getContractAddresses(chain.id) : null;

  return useMutation({
    mutationFn: async (willId: bigint) => {
      if (!walletClient || !publicClient || !addresses) {
        throw new Error('Wallet not connected');
      }

      const hash = await walletClient.writeContract({
        address: addresses.baseWill as `0x${string}`,
        abi: baseWillAbi,
        functionName: 'checkIn',
        args: [willId],
      });

      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      return receipt;
    },
    onSuccess: (_, willId) => {
      queryClient.invalidateQueries({ queryKey: ['will', willId.toString()] });
      queryClient.invalidateQueries({ queryKey: ['testatorWills'] });
    },
  });
}

// Hook for depositing ETH
export function useDepositETH() {
  const { chain } = useAccount();
  const { data: walletClient } = useWalletClient();
  const publicClient = usePublicClient();
  const queryClient = useQueryClient();
  const addresses = chain ? getContractAddresses(chain.id) : null;

  return useMutation({
    mutationFn: async ({ willId, amount }: { willId: bigint; amount: bigint }) => {
      if (!walletClient || !publicClient || !addresses) {
        throw new Error('Wallet not connected');
      }

      const hash = await walletClient.writeContract({
        address: addresses.baseWill as `0x${string}`,
        abi: baseWillAbi,
        functionName: 'depositETH',
        args: [willId],
        value: amount,
      });

      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      return receipt;
    },
    onSuccess: (_, { willId }) => {
      queryClient.invalidateQueries({ queryKey: ['will', willId.toString()] });
      queryClient.invalidateQueries({ queryKey: ['testatorWills'] });
      queryClient.invalidateQueries({ queryKey: ['platformStats'] });
    },
  });
}
