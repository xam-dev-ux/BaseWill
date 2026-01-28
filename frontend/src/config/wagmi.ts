import { createConfig, http } from 'wagmi';
import { base, baseSepolia } from 'wagmi/chains';
import { getDefaultConfig } from 'connectkit';

// Contract addresses - will be replaced after deployment
export const CONTRACT_ADDRESSES = {
  base: {
    baseWill: import.meta.env.VITE_BASEWILL_ADDRESS || '0x0000000000000000000000000000000000000000',
    notaryRegistry: import.meta.env.VITE_NOTARY_REGISTRY_ADDRESS || '0x0000000000000000000000000000000000000000',
  },
  baseSepolia: {
    baseWill: import.meta.env.VITE_BASEWILL_ADDRESS_TESTNET || '0x0000000000000000000000000000000000000000',
    notaryRegistry: import.meta.env.VITE_NOTARY_REGISTRY_ADDRESS_TESTNET || '0x0000000000000000000000000000000000000000',
  },
};

// Get current network contract addresses
export function getContractAddresses(chainId: number) {
  if (chainId === base.id) {
    return CONTRACT_ADDRESSES.base;
  }
  return CONTRACT_ADDRESSES.baseSepolia;
}

// Wagmi configuration
export const wagmiConfig = createConfig(
  getDefaultConfig({
    chains: [base, baseSepolia],
    transports: {
      [base.id]: http(import.meta.env.VITE_BASE_RPC_URL || 'https://mainnet.base.org'),
      [baseSepolia.id]: http(import.meta.env.VITE_BASE_SEPOLIA_RPC_URL || 'https://sepolia.base.org'),
    },
    walletConnectProjectId: import.meta.env.VITE_WALLETCONNECT_PROJECT_ID || '',
    appName: 'BaseWill',
    appDescription: 'Decentralized inheritance platform for automatic crypto asset distribution',
    appUrl: 'https://basewill.xyz',
    appIcon: '/favicon.svg',
  })
);

// Export chains for use elsewhere
export { base, baseSepolia };
