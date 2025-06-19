import { useAccount, useConnect, useDisconnect } from 'wagmi';
import { Wallet, LogOut } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

// Extend window for ethereum provider
declare global {
  interface Window {
    ethereum?: any;
  }
}

export function WalletConnect() {
  const { address, isConnected, chain } = useAccount();
  const { connect, connectors, isPending, error } = useConnect();
  const { disconnect } = useDisconnect();
  const [showDropdown, setShowDropdown] = useState(false);

  // Debug: Log available connectors
  console.log('Available connectors:', connectors.map(c => ({ id: c.id, name: c.name, type: c.type })));

  const handleConnect = async () => {
    try {
      console.log('Attempting to connect...');
      // Check if MetaMask or other injected wallet is available
      const injectedConnector = connectors.find(c => c.id === 'metamask' || c.type === 'injected');
      const walletConnectConnector = connectors.find(c => c.id === 'walletConnect');
      
      console.log('Found injected:', injectedConnector?.id);
      console.log('Found WalletConnect:', walletConnectConnector?.id);
      
      // Check if injected wallet has a provider (like MetaMask is installed)
      const hasInjectedProvider = typeof window !== 'undefined' && window.ethereum;
      console.log('Has injected provider:', hasInjectedProvider);
      
      // Use injected only if provider exists, otherwise use WalletConnect
      const connector = (hasInjectedProvider && injectedConnector) ? injectedConnector : walletConnectConnector || connectors[0];
      
      if (connector) {
        console.log('Connecting with:', connector.id);
        connect({ connector });
      } else {
        toast.error('No wallet connector available');
      }
    } catch (error) {
      console.error('Failed to connect wallet:', error);
      toast.error('Failed to connect wallet');
    }
  };

  // Log connection errors
  if (error) {
    console.error('Connection error:', error);
  }

  const handleDisconnect = () => {
    disconnect();
    setShowDropdown(false);
    toast.success('Wallet disconnected');
  };

  // Format address for display
  const formatAddress = (addr: string) => {
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  };

  if (isConnected && address) {
    return (
      <div className="relative">
        <button
          onClick={() => setShowDropdown(!showDropdown)}
          className="c3-button c3-button-ghost c3-button-sm flex items-center gap-2"
          style={{
            padding: '0.375rem 0.75rem',
            borderRadius: 'var(--c3-radius-lg)',
          }}
        >
          <Wallet className="w-4 h-4" />
          <span className="text-xs font-medium">{formatAddress(address)}</span>
          {chain && chain.id !== 84532 && (
            <span className="text-xs text-[var(--c3-error)]">Wrong Network</span>
          )}
        </button>

        {showDropdown && (
          <>
            <div
              className="fixed inset-0 z-40"
              onClick={() => setShowDropdown(false)}
            />
            <div className="absolute right-0 mt-1 w-48 rounded-md shadow-lg bg-[var(--c3-surface-primary)] border border-[var(--c3-border-subtle)] z-50">
              <div className="py-1">
                <div className="px-4 py-2 text-xs text-[var(--c3-text-secondary)]">
                  Connected to {chain?.name || 'Unknown'}
                </div>
                <button
                  onClick={handleDisconnect}
                  className="w-full text-left px-4 py-2 text-sm hover:bg-[var(--c3-surface-secondary)] flex items-center gap-2"
                >
                  <LogOut className="w-4 h-4" />
                  Disconnect
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    );
  }

  return (
    <button
      onClick={handleConnect}
      disabled={isPending}
      className="c3-button c3-button-ghost c3-button-sm flex items-center gap-2"
      style={{
        padding: '0.375rem 0.75rem',
        borderRadius: 'var(--c3-radius-lg)',
      }}
    >
      <Wallet className="w-4 h-4" />
      <span className="text-xs font-medium">
        {isPending ? 'Connecting...' : 'Connect Wallet'}
      </span>
    </button>
  );
}