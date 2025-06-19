import { useAccount, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { parseUnits } from 'viem';
import { USDC_ADDRESS, USDC_ABI } from '../lib/wallet-config-lazy';
import { toast } from 'sonner';
import { useEffect } from 'react';

export function useUSDCPayment() {
  const { address, isConnected, chain } = useAccount();
  const { 
    data: hash,
    error: sendError,
    isPending: isSending,
    writeContract,
    reset
  } = useWriteContract();

  const { 
    isLoading: isConfirming,
    isSuccess: isConfirmed,
    error: confirmError
  } = useWaitForTransactionReceipt({
    hash,
  });

  // Handle transaction success
  useEffect(() => {
    if (isConfirmed && hash) {
      toast.success(`Payment sent successfully! TX: ${hash.slice(0, 10)}...`);
      reset();
    }
  }, [isConfirmed, hash, reset]);

  // Handle errors
  useEffect(() => {
    if (sendError) {
      console.error('Send error:', sendError);
      if (sendError.message.includes('User rejected')) {
        toast.error('Transaction rejected by user');
      } else {
        toast.error(`Failed to send payment: ${sendError.message}`);
      }
    }
    if (confirmError) {
      console.error('Confirmation error:', confirmError);
      toast.error('Transaction failed');
    }
  }, [sendError, confirmError]);

  const sendUSDC = async (recipient: string, amount: number) => {
    if (!isConnected) {
      toast.error('Please connect your wallet first');
      return;
    }

    if (chain?.id !== 84532) { // Base Sepolia chain ID
      toast.error('Please switch to Base Sepolia network');
      return;
    }

    if (!recipient.match(/^0x[a-fA-F0-9]{40}$/)) {
      toast.error('Invalid recipient address');
      return;
    }

    if (amount <= 0) {
      toast.error('Amount must be greater than 0');
      return;
    }

    try {
      // USDC has 6 decimals
      const amountInDecimals = parseUnits(amount.toString(), 6);
      
      toast.info('Please confirm the transaction in your wallet...');
      
      writeContract({
        address: USDC_ADDRESS,
        abi: USDC_ABI,
        functionName: 'transfer',
        args: [recipient as `0x${string}`, amountInDecimals],
      });
    } catch (error: any) {
      console.error('Error preparing transaction:', error);
      toast.error('Failed to prepare transaction');
    }
  };

  return {
    sendUSDC,
    isConnected,
    isSending: isSending || isConfirming,
    isConfirmed,
    hash,
    reset,
    currentAddress: address,
    isCorrectNetwork: chain?.id === 84532,
  };
}