import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MessageList } from '../MessageList';
import React from 'react';

describe('Message Rendering Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render empty state when no messages', () => {
    render(
      <MessageList 
        messages={[]} 
        messagesEndRef={{ current: null }}
        threadId="thread1" as any
      />
    );

    expect(screen.getByText('Start a new conversation')).toBeInTheDocument();
  });

  it('should render messages without duplicates', () => {
    const messages = [
      {
        _id: 'msg1',
        threadId: 'thread1',
        role: 'user' as const,
        content: 'have we spoken before?',
        localCreatedAt: Date.now(),
        _creationTime: Date.now(),
      },
      {
        _id: 'msg2',
        threadId: 'thread1',
        role: 'assistant' as const,
        content: 'As a large language model, I have no memory of past conversations.',
        localCreatedAt: Date.now() + 1000,
        _creationTime: Date.now() + 1000,
      }
    ];

    render(
      <MessageList 
        messages={messages} 
        messagesEndRef={{ current: null }}
        threadId="thread1" as any
      />
    );

    // Check that each message appears exactly once
    const userMessages = screen.getAllByText('have we spoken before?');
    expect(userMessages).toHaveLength(1);

    const assistantMessages = screen.getAllByText(/As a large language model/);
    expect(assistantMessages).toHaveLength(1);
  });

  it('should handle optimistic messages correctly', () => {
    const messages = [
      {
        _id: 'temp_msg_123',
        threadId: 'thread1',
        role: 'user' as const,
        content: 'Test message',
        localCreatedAt: Date.now(),
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

    // Check optimistic message is rendered
    expect(screen.getByText('Test message')).toBeInTheDocument();
    
    // Check for optimistic indicator
    const messageDiv = screen.getByText('Test message').closest('.c3-message');
    expect(messageDiv).toHaveClass('optimistic');
  });

  it('should render duplicate messages if they have same ID', () => {
    const messages = [
      {
        _id: 'msg1',
        threadId: 'thread1',
        role: 'user' as const,
        content: 'Test message',
        localCreatedAt: Date.now(),
      },
      {
        _id: 'msg1', // Same ID - React will warn but render both
        threadId: 'thread1',
        role: 'user' as const,
        content: 'Test message',
        localCreatedAt: Date.now(),
      }
    ];

    render(
      <MessageList 
        messages={messages} 
        messagesEndRef={{ current: null }}
        threadId="thread1" as any
      />
    );

    // This shows the bug - duplicate IDs cause duplicate renders
    const renderedMessages = screen.getAllByText('Test message');
    expect(renderedMessages).toHaveLength(2);
  });

  it('should properly merge optimistic and server messages', () => {
    const messages = [
      {
        _id: 'msg1',
        threadId: 'thread1',
        role: 'user' as const,
        content: 'First message',
        localCreatedAt: 1000,
      },
      {
        _id: 'temp_msg_123',
        threadId: 'thread1', 
        role: 'user' as const,
        content: 'Optimistic message',
        localCreatedAt: 2000,
        isOptimistic: true,
      },
      {
        _id: 'msg2',
        threadId: 'thread1',
        role: 'assistant' as const,
        content: 'Response',
        localCreatedAt: 3000,
      }
    ];

    render(
      <MessageList 
        messages={messages} 
        messagesEndRef={{ current: null }}
        threadId="thread1" as any
      />
    );

    // All messages should be rendered
    expect(screen.getByText('First message')).toBeInTheDocument();
    expect(screen.getByText('Optimistic message')).toBeInTheDocument();
    expect(screen.getByText('Response')).toBeInTheDocument();
  });
});