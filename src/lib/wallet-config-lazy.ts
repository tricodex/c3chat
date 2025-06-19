import { createConfig, http } from 'wagmi';
import { baseSepolia } from 'wagmi/chains';
import { walletConnect, injected } from 'wagmi/connectors';

// Base Sepolia USDC contract address
export const USDC_ADDRESS = '0x036CbD53842c5426634e7929541eC2318f3dCF7e' as const;

// Base Sepolia chain configuration
export const baseSepoliaConfig = {
  ...baseSepolia,
  rpcUrls: {
    default: {
      http: [import.meta.env.VITE_BASE_SEPOLIA_RPC_URL || 'https://sepolia.base.org'],
    },
    public: {
      http: ['https://sepolia.base.org'],
    },
  },
};

// Lazy initialization of wagmi config
let wagmiConfigInstance: ReturnType<typeof createConfig> | null = null;

export const getWagmiConfig = () => {
  if (!wagmiConfigInstance) {
    wagmiConfigInstance = createConfig({
      chains: [baseSepoliaConfig],
      transports: {
        [baseSepolia.id]: http(import.meta.env.VITE_BASE_SEPOLIA_RPC_URL || 'https://sepolia.base.org'),
      },
      connectors: [
        // Injected connector for browser wallets (MetaMask, etc.)
        injected({
          target() {
            return {
              id: 'metamask',
              name: 'MetaMask',
              provider: typeof window !== 'undefined' ? window.ethereum : undefined,
            };
          },
        }),
        // WalletConnect for mobile and other wallets
        walletConnect({
          projectId: import.meta.env.VITE_WALLETCONNECT_PROJECTID || '',
          metadata: {
            name: 'C3Chat',
            description: 'AI Chat with USDC Payments',
            url: typeof window !== 'undefined' ? window.location.origin : 'https://localhost:5173',
            icons: ['/icon.png'],
          },
          showQrModal: true, // Only show QR if no injected wallet available
        }),
      ],
    });
  }
  return wagmiConfigInstance;
};

// USDC ABI - minimal interface for transfer
export const USDC_ABI = [
  {
    name: 'transfer',
    type: 'function',
    inputs: [
      { name: 'to', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'nonpayable',
  },
  {
    name: 'decimals',
    type: 'function',
    inputs: [],
    outputs: [{ name: '', type: 'uint8' }],
    stateMutability: 'view',
  },
  {
    name: 'balanceOf',
    type: 'function',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },
] as const;