import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAccount, usePublicClient, useWalletClient } from 'wagmi';
import { getContractAddresses } from '../config/wagmi';
import { parseAbi, formatEther } from 'viem';

// ABI fragments for BaseWill contract
const baseWillAbi = parseAbi([
  'function getWill(uint256 willId) view returns (tuple(uint256 id, address testator, uint8 status, uint8 activationMode, uint8 privacyMode, uint256 inactivityThreshold, uint256 gracePeriod, uint256 disputePeriod, uint256 createdAt, uint256 updatedAt, uint256 lastActivity, uint256 triggerTime, uint256 executionTime, bytes32 metadataHash, bytes32 encryptedDataHash, address backupExecutor, uint256 version))',
  'function getTestatorWills(address testator) view returns (uint256[])',
  'function getBeneficiaryWills(address beneficiary) view returns (uint256[])',
  'function getBeneficiaries(uint256 willId) view returns (tuple(address beneficiaryAddress, uint256 allocationBps, tuple(uint8 vestingType, uint256 startDelay, uint256 duration, uint256 cliffDuration, uint256 releaseInterval, bytes32 milestoneCondition) vestingSchedule, bool isPrimary, bool hasAccepted, bytes32 labelHash, uint256 amountClaimed, uint256 lastClaimTime)[])',
  'function getWillValue(uint256 willId) view returns (uint256 ethBalance, uint256[] tokenBalances, uint256 nftCount)',
  'function getPlatformStats() view returns (tuple(uint256 totalValueSecured, uint256 totalWillsCreated, uint256 activeWills, uint256 executedWills, uint256 totalDistributed, uint256 registeredNotaries))',
  'function createWill(uint8 activationMode, uint256 inactivityThreshold, uint256 gracePeriod, uint256 disputePeriod, bytes32 metadataHash, address backupExecutor) returns (uint256 willId)',
  'function checkIn(uint256 willId)',
  'function depositETH(uint256 willId) payable',
  'function activateWill(uint256 willId)',
  'function cancelWill(uint256 willId, string reason)',
  'function addBeneficiary(uint256 willId, address beneficiary, uint256 allocationBps, tuple(uint8 vestingType, uint256 startDelay, uint256 duration, uint256 cliffDuration, uint256 releaseInterval, bytes32 milestoneCondition) vestingSchedule, bool isPrimary, bytes32 labelHash)',
  'function removeBeneficiary(uint256 willId, address beneficiary)',
]);

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
