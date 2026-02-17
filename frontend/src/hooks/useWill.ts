import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAccount, usePublicClient, useWalletClient } from 'wagmi';
import { getContractAddresses } from '../config/wagmi';
import { formatEther } from 'viem';

// ABI for BaseWillCore contract (deployed on Base Mainnet)
const baseWillAbi = [
  // View: read will by id (public mapping getter)
  {
    name: 'wills',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'willId', type: 'uint256' }],
    outputs: [
      { name: 'testator', type: 'address' },
      { name: 'status', type: 'uint8' },
      { name: 'inactivityThreshold', type: 'uint256' },
      { name: 'lastActivityTime', type: 'uint256' },
      { name: 'gracePeriod', type: 'uint256' },
      { name: 'triggeredAt', type: 'uint256' },
      { name: 'totalValue', type: 'uint256' },
      { name: 'requiredNotaries', type: 'uint256' },
      { name: 'verificationCount', type: 'uint256' },
    ],
  },
  // View: get all will IDs for a testator
  {
    name: 'getTestatorWills',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'testator', type: 'address' }],
    outputs: [{ name: '', type: 'uint256[]' }],
  },
  // View: get all will IDs for a beneficiary (public mapping getter)
  {
    name: 'beneficiaryWills',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'beneficiary', type: 'address' }],
    outputs: [{ name: '', type: 'uint256[]' }],
  },
  // View: get beneficiaries for a will
  {
    name: 'getBeneficiaries',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'willId', type: 'uint256' }],
    outputs: [{
      name: '',
      type: 'tuple[]',
      components: [
        { name: 'addr', type: 'address' },
        { name: 'allocationBps', type: 'uint256' },
        { name: 'vestingType', type: 'uint8' },
        { name: 'vestingDuration', type: 'uint256' },
        { name: 'amountClaimed', type: 'uint256' },
      ],
    }],
  },
  // View: get total ETH value in a will
  {
    name: 'getWillTotalValue',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'willId', type: 'uint256' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
  // View: global will counter
  {
    name: 'willCounter',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
  },
  // Write: create a will
  {
    name: 'createWill',
    type: 'function',
    stateMutability: 'payable',
    inputs: [
      { name: 'inactivityThreshold', type: 'uint256' },
      { name: 'gracePeriod', type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'uint256' }],
  },
  // Write: cancel a will
  {
    name: 'cancelWill',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'willId', type: 'uint256' }],
    outputs: [],
  },
  // Write: add a beneficiary
  {
    name: 'addBeneficiary',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'willId', type: 'uint256' },
      { name: 'beneficiary', type: 'address' },
      { name: 'allocationBps', type: 'uint256' },
      { name: 'vestingType', type: 'uint8' },
      { name: 'vestingDuration', type: 'uint256' },
    ],
    outputs: [],
  },
  // Write: remove a beneficiary by index
  {
    name: 'removeBeneficiary',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'willId', type: 'uint256' },
      { name: 'index', type: 'uint256' },
    ],
    outputs: [],
  },
  // Write: deposit ETH into a will
  {
    name: 'depositETH',
    type: 'function',
    stateMutability: 'payable',
    inputs: [{ name: 'willId', type: 'uint256' }],
    outputs: [],
  },
  // Write: check in to reset inactivity timer
  {
    name: 'checkIn',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'willId', type: 'uint256' }],
    outputs: [],
  },
] as const;

export interface WillData {
  id: bigint;
  testator: `0x${string}`;
  status: number;
  inactivityThreshold: bigint;
  lastActivityTime: bigint;
  gracePeriod: bigint;
  triggeredAt: bigint;
  totalValue: bigint;
  requiredNotaries: bigint;
  verificationCount: bigint;
  ethBalance?: string;
  beneficiaryCount?: number;
}

export interface BeneficiaryData {
  addr: `0x${string}`;
  allocationBps: bigint;
  vestingType: number;
  vestingDuration: bigint;
  amountClaimed: bigint;
}

export interface PlatformStats {
  totalValueSecured: bigint;
  totalWillsCreated: bigint;
  activeWills: bigint;
  executedWills: bigint;
  totalDistributed: bigint;
  registeredNotaries: bigint;
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
        const [willRaw, totalValue, beneficiaries] = await Promise.all([
          publicClient.readContract({
            address: addresses.baseWill as `0x${string}`,
            abi: baseWillAbi,
            functionName: 'wills',
            args: [BigInt(willId)],
          }),
          publicClient.readContract({
            address: addresses.baseWill as `0x${string}`,
            abi: baseWillAbi,
            functionName: 'getWillTotalValue',
            args: [BigInt(willId)],
          }),
          publicClient.readContract({
            address: addresses.baseWill as `0x${string}`,
            abi: baseWillAbi,
            functionName: 'getBeneficiaries',
            args: [BigInt(willId)],
          }),
        ]);

        const [testator, status, inactivityThreshold, lastActivityTime, gracePeriod, triggeredAt, totalValueRaw, requiredNotaries, verificationCount] = willRaw as readonly [string, number, bigint, bigint, bigint, bigint, bigint, bigint, bigint];

        return {
          id: BigInt(willId),
          testator: testator as `0x${string}`,
          status,
          inactivityThreshold,
          lastActivityTime,
          gracePeriod,
          triggeredAt,
          totalValue: totalValueRaw,
          requiredNotaries,
          verificationCount,
          ethBalance: formatEther(totalValue as bigint),
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
            const [willRaw, totalValue, beneficiaries] = await Promise.all([
              publicClient.readContract({
                address: addresses.baseWill as `0x${string}`,
                abi: baseWillAbi,
                functionName: 'wills',
                args: [id],
              }),
              publicClient.readContract({
                address: addresses.baseWill as `0x${string}`,
                abi: baseWillAbi,
                functionName: 'getWillTotalValue',
                args: [id],
              }),
              publicClient.readContract({
                address: addresses.baseWill as `0x${string}`,
                abi: baseWillAbi,
                functionName: 'getBeneficiaries',
                args: [id],
              }),
            ]);

            const [testatorAddr, status, inactivityThreshold, lastActivityTime, gracePeriod, triggeredAt, totalValueRaw, requiredNotaries, verificationCount] = willRaw as readonly [string, number, bigint, bigint, bigint, bigint, bigint, bigint, bigint];

            return {
              id,
              testator: testatorAddr as `0x${string}`,
              status,
              inactivityThreshold,
              lastActivityTime,
              gracePeriod,
              triggeredAt,
              totalValue: totalValueRaw,
              requiredNotaries,
              verificationCount,
              ethBalance: formatEther(totalValue as bigint),
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

// Hook to get platform statistics (derived from contract state)
export function usePlatformStats() {
  const { chain } = useAccount();
  const publicClient = usePublicClient();
  const addresses = chain ? getContractAddresses(chain.id) : null;

  return useQuery({
    queryKey: ['platformStats', chain?.id],
    queryFn: async (): Promise<PlatformStats | null> => {
      if (!publicClient || !addresses) return null;

      try {
        const totalWillsCreated = await publicClient.readContract({
          address: addresses.baseWill as `0x${string}`,
          abi: baseWillAbi,
          functionName: 'willCounter',
        }) as bigint;

        return {
          totalValueSecured: 0n,
          totalWillsCreated,
          activeWills: 0n,
          executedWills: 0n,
          totalDistributed: 0n,
          registeredNotaries: 0n,
        };
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
        args: [params.inactivityThreshold, params.gracePeriod],
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
