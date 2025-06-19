import { useEffect } from 'react';
import { useMessages, useSelectedThread } from '../lib/sync-engine-switcher';
import { useUSDCPayment } from '../hooks/useUSDCPayment';
import { toast } from 'sonner';

export function PaymentHandler() {
  const selectedThread = useSelectedThread();
  const messages = useMessages(selectedThread?._id);
  const { sendUSDC, isConnected, isCorrectNetwork, isSending } = useUSDCPayment();

  useEffect(() => {
    if (!messages || messages.length === 0) return;

    // Debug logging
    console.log('PaymentHandler: Checking messages for payment toolCalls', {
      messageCount: messages.length,
      messagesWithToolCalls: messages.filter(m => m.toolCalls).map(m => ({
        id: m._id,
        role: m.role,
        toolCalls: m.toolCalls,
        content: m.content?.substring(0, 50)
      }))
    });

    // Look for the latest assistant message with payment toolCalls
    const latestPaymentMessage = messages
      .filter(m => m.role === 'assistant' && m.toolCalls && m.toolCalls.length > 0)
      .reverse()
      .find(m => m.toolCalls?.some(tc => tc.function?.name === 'send_usdc_payment'));

    if (!latestPaymentMessage) return;

    // Check if this payment was already processed (to prevent duplicate transactions)
    const paymentCall = latestPaymentMessage.toolCalls?.find(
      tc => tc.function?.name === 'send_usdc_payment'
    );

    if (!paymentCall) return;

    // Parse the payment details
    try {
      const args = JSON.parse(paymentCall.function.arguments);
      const { recipientAddress, amount } = args;

      // Check if user has already processed this payment
      const processedKey = `payment_processed_${latestPaymentMessage._id}`;
      if (localStorage.getItem(processedKey)) {
        return; // Already processed
      }

      // Auto-trigger payment if wallet is connected
      if (isConnected && isCorrectNetwork && !isSending) {
        // Show confirmation toast
        toast.info(
          <div>
            <p className="font-semibold">Confirm Payment</p>
            <p className="text-sm">Send {amount} USDC to {recipientAddress.slice(0, 10)}...?</p>
            <div className="flex gap-2 mt-2">
              <button
                onClick={async () => {
                  toast.dismiss();
                  await sendUSDC(recipientAddress, amount);
                  localStorage.setItem(processedKey, 'true');
                }}
                className="px-3 py-1 bg-green-600 text-white rounded text-sm hover:bg-green-700"
              >
                Confirm
              </button>
              <button
                onClick={() => {
                  toast.dismiss();
                  localStorage.setItem(processedKey, 'cancelled');
                }}
                className="px-3 py-1 bg-gray-600 text-white rounded text-sm hover:bg-gray-700"
              >
                Cancel
              </button>
            </div>
          </div>,
          {
            duration: 30000, // 30 seconds to decide
            dismissible: false,
          }
        );
      } else if (!isConnected) {
        toast.error('Please connect your wallet to complete the payment');
      } else if (!isCorrectNetwork) {
        toast.error('Please switch to Base Sepolia network');
      }
    } catch (error) {
      console.error('Failed to parse payment details:', error);
    }
  }, [messages, sendUSDC, isConnected, isCorrectNetwork, isSending]);

  return null; // This is a handler component, no UI
}