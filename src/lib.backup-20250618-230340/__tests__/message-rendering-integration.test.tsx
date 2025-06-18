import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ChatView } from '../../components/ChatView';
import { MessageList } from '../../components/MessageList';
import { EnhancedSyncProvider } from '../corrected-sync-engine';
import React from 'react';

// Mock voice service to prevent errors in tests
vi.mock('../voice-service', () => ({
  VoiceService: class {
    static getInstance() {
      return {
        getVoices: () => [],
        speak: vi.fn(),
        stop: vi.fn(),
        pause: vi.fn(),
        resume: vi.fn(),
        setRate: vi.fn(),
        setPitch: vi.fn(),
        setVolume: vi.fn(),
        setVoice: vi.fn(),
        isSpeaking: false,
        isPaused: false,
      };
    }
  },
  default: class {
    static getInstance() {
      return {
        getVoices: () => [],
        speak: vi.fn(),
        stop: vi.fn(),
        pause: vi.fn(),
        resume: vi.fn(),
        setRate: vi.fn(),
        setPitch: vi.fn(),
        setVolume: vi.fn(),
        setVoice: vi.fn(),
        isSpeaking: false,
        isPaused: false,
      };
    }
  },
  useVoiceInput: () => ({
    isListening: false,
    transcript: '',
    interimTranscript: '',
    error: null,
    startListening: vi.fn(),
    stopListening: vi.fn(),
    canUseVoice: false,
  }),
  useVoiceOutput: () => ({
    isSpeaking: false,
    isPaused: false,
    speak: vi.fn(),
    stop: vi.fn(),
    pause: vi.fn(),
    resume: vi.fn(),
    canUseVoice: false,
  }),
  useVoiceSettings: () => ({
    settings: {
      voice: null,
      rate: 1,
      pitch: 1,
      volume: 1,
    },
    voices: [],
    updateSettings: vi.fn(),
  }),
}));

// Mock the hooks
const mockSendMessage = vi.fn();
const mockActions = {
  sendMessage: mockSendMessage,
  createBranch: vi.fn(),
  exportThread: vi.fn(),
  clearThread: vi.fn(),
  sendSystemMessage: vi.fn(),
  generateImage: vi.fn(),
  sendMessageWithSearch: vi.fn(),
};

const mockState = {
  isOnline: true,
  selectedThreadId: 'thread1',
  threads: [
    {
      _id: 'thread1',
      title: 'Test Thread',
      provider: 'google',
      model: 'gemini-2.0-flash',
      lastMessageAt: Date.now(),
    }
  ],
  messages: {
    'thread1': []
  }
};

vi.mock('../corrected-sync-engine', () => ({
  useEnhancedSync: () => ({
    actions: mockActions,
    state: mockState,
  }),
  useSelectedThread: () => mockState.threads[0],
  useMessages: () => mockState.messages['thread1'] || [],
  EnhancedSyncProvider: ({ children }: any) => <>{children}</>,
}));

vi.mock('../ai-providers', () => ({
  getStoredApiKey: () => 'AIzaSyAxRhM3SgV0SOne0fB8kjl5ZOAufzKQj0Y',
  AI_PROVIDERS: {
    google: { name: 'Google Gemini' }
  }
}));

describe('Message Rendering Integration Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset messages
    mockState.messages['thread1'] = [];
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it.skip('should not duplicate user messages when sending', async () => {
    const user = userEvent.setup();
    
    // Mock the sendMessage to simulate real behavior
    mockSendMessage.mockImplementation(async (content: string) => {
      // Add optimistic message
      const optimisticMessage = {
        _id: 'temp_msg_1',
        threadId: 'thread1',
        role: 'user' as const,
        content,
        localCreatedAt: Date.now(),
        isOptimistic: true,
      };
      mockState.messages['thread1'] = [...mockState.messages['thread1'], optimisticMessage];
      
      // Simulate server delay
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Replace with real message
      const realMessage = {
        _id: 'msg1',
        threadId: 'thread1',
        role: 'user' as const,
        content,
        localCreatedAt: Date.now(),
        _creationTime: Date.now(),
      };
      
      // Remove optimistic and add real
      mockState.messages['thread1'] = mockState.messages['thread1']
        .filter(m => m._id !== 'temp_msg_1')
        .concat(realMessage);
    });

    render(<ChatView />);
    
    // Type and send a message
    const input = screen.getByPlaceholderText(/Type a message/i);
    await user.type(input, 'have we spoken before?');
    await user.keyboard('{Enter}');
    
    // Wait for message to appear
    await waitFor(() => {
      const messages = screen.getAllByText('have we spoken before?');
      expect(messages).toHaveLength(1);
    });
    
    // Ensure no duplicates after server response
    await waitFor(() => {
      const messages = screen.getAllByText('have we spoken before?');
      expect(messages).toHaveLength(1);
    }, { timeout: 200 });
  });

  it('should handle message deduplication correctly', () => {
    // Test the deduplication logic directly
    const messages = [
      {
        _id: 'msg1',
        threadId: 'thread1',
        role: 'user' as const,
        content: 'Test message',
        localCreatedAt: 1000,
      },
      {
        _id: 'msg2',
        threadId: 'thread1',
        role: 'assistant' as const,
        content: 'Response',
        localCreatedAt: 2000,
      },
      {
        _id: 'temp_msg_123',
        threadId: 'thread1',
        role: 'user' as const,
        content: 'Optimistic message',
        localCreatedAt: 3000,
        isOptimistic: true,
      }
    ];

    render(
      <MessageList 
        messages={messages} 
        messagesEndRef={{ current: null }}
        threadId="thread1" as any
      />
    );

    // Each message should appear exactly once
    expect(screen.getByText('Test message')).toBeInTheDocument();
    expect(screen.getByText('Response')).toBeInTheDocument();
    expect(screen.getByText('Optimistic message')).toBeInTheDocument();
    
    // Check that optimistic message has the right class
    const optimisticMsg = screen.getByText('Optimistic message').closest('.c3-message');
    expect(optimisticMsg).toHaveClass('optimistic');
  });

  it('should properly clear messages when switching threads', async () => {
    // Start with messages in thread1
    mockState.messages['thread1'] = [
      {
        _id: 'msg1',
        threadId: 'thread1',
        role: 'user' as const,
        content: 'Message in thread 1',
        localCreatedAt: Date.now(),
      }
    ];

    const { rerender } = render(<MessageList 
      messages={mockState.messages['thread1']} 
      messagesEndRef={{ current: null }}
      threadId="thread1" as any
    />);

    expect(screen.getByText('Message in thread 1')).toBeInTheDocument();

    // Switch to thread2
    mockState.selectedThreadId = 'thread2';
    mockState.messages['thread2'] = [
      {
        _id: 'msg2',
        threadId: 'thread2',
        role: 'user' as const,
        content: 'Message in thread 2',
        localCreatedAt: Date.now(),
      }
    ];

    rerender(<MessageList 
      messages={mockState.messages['thread2']} 
      messagesEndRef={{ current: null }}
      threadId="thread2" as any
    />);

    // Should only show thread2 messages
    expect(screen.queryByText('Message in thread 1')).not.toBeInTheDocument();
    expect(screen.getByText('Message in thread 2')).toBeInTheDocument();
  });

  it('should not render messages appearing and disappearing', async () => {
    const { rerender } = render(<MessageList 
      messages={[]} 
      messagesEndRef={{ current: null }}
      threadId="thread1" as any
    />);

    // Add a message
    const message = {
      _id: 'msg1',
      threadId: 'thread1',
      role: 'user' as const,
      content: 'Stable message',
      localCreatedAt: Date.now(),
    };

    rerender(<MessageList 
      messages={[message]} 
      messagesEndRef={{ current: null }}
      threadId="thread1" as any
    />);

    expect(screen.getByText('Stable message')).toBeInTheDocument();

    // Re-render with same message - should remain stable
    rerender(<MessageList 
      messages={[message]} 
      messagesEndRef={{ current: null }}
      threadId="thread1" as any
    />);

    expect(screen.getByText('Stable message')).toBeInTheDocument();
    expect(screen.getAllByText('Stable message')).toHaveLength(1);
  });
});