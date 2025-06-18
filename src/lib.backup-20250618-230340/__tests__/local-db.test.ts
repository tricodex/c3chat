import { describe, it, expect, beforeEach, vi } from 'vitest'
import { createLocalDB, LocalDB, StoredThread, StoredMessage } from '../local-db'

describe('LocalDB', () => {
  let db: LocalDB

  beforeEach(async () => {
    // This will use the mocked IndexedDB from test-setup.ts
    db = await createLocalDB()
  })

  describe('Thread Operations', () => {
    const mockThread: StoredThread = {
      _id: 'thread1' as any,
      title: 'Test Thread',
      userId: 'user1' as any,
      lastMessageAt: Date.now(),
      provider: 'openai',
      model: 'gpt-4o-mini',
      localCreatedAt: Date.now(),
      syncedToServer: true,
    }

    it('should save and retrieve threads', async () => {
      await db.saveThread(mockThread)
      const threads = await db.getThreads()
      
      expect(threads).toHaveLength(1)
      expect(threads[0]._id).toBe(mockThread._id)
      expect(threads[0].title).toBe(mockThread.title)
    })

    it('should get a specific thread by id', async () => {
      await db.saveThread(mockThread)
      const thread = await db.getThread(mockThread._id)
      
      expect(thread).not.toBeNull()
      expect(thread?._id).toBe(mockThread._id)
    })

    it('should update thread properties', async () => {
      await db.saveThread(mockThread)
      await db.updateThread(mockThread._id, { title: 'Updated Title' })
      
      const thread = await db.getThread(mockThread._id)
      expect(thread?.title).toBe('Updated Title')
    })

    it('should delete threads', async () => {
      await db.saveThread(mockThread)
      await db.deleteThread(mockThread._id)
      
      const threads = await db.getThreads()
      expect(threads).toHaveLength(0)
    })

    it('should sort threads by lastMessageAt descending', async () => {
      const thread1 = { ...mockThread, _id: 'thread1' as any, lastMessageAt: 1000 }
      const thread2 = { ...mockThread, _id: 'thread2' as any, lastMessageAt: 2000 }
      
      await db.saveThread(thread1)
      await db.saveThread(thread2)
      
      const threads = await db.getThreads()
      expect(threads[0]._id).toBe('thread2')
      expect(threads[1]._id).toBe('thread1')
    })
  })

  describe('Message Operations', () => {
    const mockMessage: StoredMessage = {
      _id: 'message1' as any,
      threadId: 'thread1' as any,
      role: 'user',
      content: 'Hello world',
      localCreatedAt: Date.now(),
      syncedToServer: true,
    }

    it('should save and retrieve messages', async () => {
      await db.saveMessage(mockMessage)
      const messages = await db.getMessages(mockMessage.threadId)
      
      expect(messages).toHaveLength(1)
      expect(messages[0]._id).toBe(mockMessage._id)
      expect(messages[0].content).toBe(mockMessage.content)
    })

    it('should update message properties', async () => {
      await db.saveMessage(mockMessage)
      await db.updateMessage(mockMessage._id, { content: 'Updated content' })
      
      const messages = await db.getMessages(mockMessage.threadId)
      expect(messages[0].content).toBe('Updated content')
    })

    it('should delete messages', async () => {
      await db.saveMessage(mockMessage)
      await db.deleteMessage(mockMessage._id)
      
      const messages = await db.getMessages(mockMessage.threadId)
      expect(messages).toHaveLength(0)
    })

    it('should sort messages by localCreatedAt ascending', async () => {
      const message1 = { ...mockMessage, _id: 'message1' as any, localCreatedAt: 1000 }
      const message2 = { ...mockMessage, _id: 'message2' as any, localCreatedAt: 2000 }
      
      await db.saveMessage(message2) // Save in reverse order
      await db.saveMessage(message1)
      
      const messages = await db.getMessages(mockMessage.threadId)
      expect(messages[0]._id).toBe('message1')
      expect(messages[1]._id).toBe('message2')
    })
  })

  describe('Metadata Operations', () => {
    it('should save and retrieve metadata', async () => {
      const metadata = {
        selectedThreadId: 'thread1',
        lastSyncTime: Date.now(),
      }
      
      await db.setMetadata(metadata)
      const retrievedMetadata = await db.getMetadata()
      
      expect(retrievedMetadata.selectedThreadId).toBe(metadata.selectedThreadId)
      expect(retrievedMetadata.lastSyncTime).toBe(metadata.lastSyncTime)
    })

    it('should merge metadata updates', async () => {
      await db.setMetadata({ selectedThreadId: 'thread1' })
      await db.setMetadata({ lastSyncTime: 12345 })
      
      const metadata = await db.getMetadata()
      expect(metadata.selectedThreadId).toBe('thread1')
      expect(metadata.lastSyncTime).toBe(12345)
    })
  })

  describe('Cleanup Operations', () => {
    it('should clear all data', async () => {
      const mockThread: StoredThread = {
        _id: 'thread1' as any,
        title: 'Test Thread',
        userId: 'user1' as any,
        lastMessageAt: Date.now(),
        localCreatedAt: Date.now(),
        syncedToServer: true,
      }
      
      const mockMessage: StoredMessage = {
        _id: 'message1' as any,
        threadId: 'thread1' as any,
        role: 'user',
        content: 'Test message',
        localCreatedAt: Date.now(),
        syncedToServer: true,
      }
      
      await db.saveThread(mockThread)
      await db.saveMessage(mockMessage)
      
      await db.clear()
      
      const threads = await db.getThreads()
      const messages = await db.getMessages('thread1')
      
      expect(threads).toHaveLength(0)
      expect(messages).toHaveLength(0)
    })

    it('should report availability status', async () => {
      const isAvailable = await db.isAvailable()
      expect(typeof isAvailable).toBe('boolean')
    })

    it('should calculate storage size', async () => {
      const size = await db.getSize()
      expect(typeof size).toBe('number')
      expect(size).toBeGreaterThanOrEqual(0)
    })
  })

  describe('Error Handling', () => {
    it('should handle non-existent thread gracefully', async () => {
      const thread = await db.getThread('non-existent')
      expect(thread).toBeNull()
    })

    it('should handle updating non-existent thread gracefully', async () => {
      await expect(db.updateThread('non-existent', { title: 'Updated' }))
        .resolves.not.toThrow()
    })

    it('should handle deleting non-existent thread gracefully', async () => {
      await expect(db.deleteThread('non-existent'))
        .resolves.not.toThrow()
    })

    it('should handle updating non-existent message gracefully', async () => {
      await expect(db.updateMessage('non-existent', { content: 'Updated' }))
        .resolves.not.toThrow()
    })

    it('should handle deleting non-existent message gracefully', async () => {
      await expect(db.deleteMessage('non-existent'))
        .resolves.not.toThrow()
    })
  })
})

describe('Storage Detection', () => {
  it('should detect storage capabilities', async () => {
    // Since we're in a test environment, OPFS should fail and IndexedDB should work
    const db = await createLocalDB()
    expect(db).toBeDefined()
    expect(await db.isAvailable()).toBe(true)
  })
})
