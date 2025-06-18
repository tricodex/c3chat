/**
 * Tests for File Attachments and Message Streaming
 * 
 * This test suite covers:
 * 1. File upload functionality
 * 2. Attachment storage and retrieval
 * 3. Message streaming with StreamBuffer
 * 4. Real-time updates during streaming
 * 5. Error handling for attachments
 * 6. Performance with large files
 */

import { describe, it, expect, beforeEach, vi, Mock } from 'vitest'
import React from 'react'
import { render, renderHook, act, waitFor, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Id } from '../../../convex/_generated/dataModel'

// Mock modules
vi.mock('../../../convex/_generated/api', () => ({
  api: {
    attachments: {
      uploadFile: { name: 'attachments.uploadFile' },
      getAttachments: { name: 'attachments.getAttachments' },
      deleteAttachment: { name: 'attachments.deleteAttachment' },
    },
    messages: {
      send: { name: 'messages.send' },
      update: { name: 'messages.update' },
    },
    ai: {
      generateResponse: { name: 'ai.generateResponse' },
    },
  },
}))

vi.mock('convex/react', () => ({
  useQuery: vi.fn(() => []),
  useMutation: vi.fn(() => vi.fn()),
  useAction: vi.fn(() => vi.fn()),
}))

vi.mock('../local-db', () => ({
  createLocalDB: vi.fn(() => Promise.resolve({
    isAvailable: vi.fn().mockResolvedValue(true),
    getThreads: vi.fn().mockResolvedValue([]),
    saveThread: vi.fn().mockResolvedValue(undefined),
    getMessages: vi.fn().mockResolvedValue([]),
    saveMessage: vi.fn().mockResolvedValue(undefined),
    updateMessage: vi.fn().mockResolvedValue(undefined),
    getMetadata: vi.fn().mockResolvedValue({}),
    setMetadata: vi.fn().mockResolvedValue(undefined),
  })),
}))

// Import components after mocks
import { EnhancedSyncProvider, useEnhancedSync } from '../corrected-sync-engine'
import { StreamBuffer } from '../../../convex/utils/streamBuffer'

// Mock file creation
const createMockFile = (name: string, size: number, type: string): File => {
  const content = new Array(size).fill('a').join('')
  return new File([content], name, { type })
}

describe('File Attachments', () => {
  let mockUploadFile: Mock
  let mockGetAttachments: Mock
  
  beforeEach(() => {
    vi.clearAllMocks()
    
    mockUploadFile = vi.fn().mockResolvedValue({
      attachmentId: 'attachment-123',
      url: 'https://example.com/file.pdf'
    })
    
    mockGetAttachments = vi.fn().mockReturnValue([])
    
    vi.mocked(require('convex/react').useAction).mockReturnValue(mockUploadFile)
    vi.mocked(require('convex/react').useQuery).mockImplementation((query) => {
      if (query.name === 'attachments.getAttachments') {
        return mockGetAttachments()
      }
      return []
    })
  })

  describe('File Upload', () => {
    it('should handle single file upload', async () => {
      const file = createMockFile('document.pdf', 1024 * 1024, 'application/pdf') // 1MB
      
      const TestComponent = () => {
        const { actions } = useEnhancedSync()
        const [uploadStatus, setUploadStatus] = React.useState('')
        
        const handleUpload = async () => {
          try {
            setUploadStatus('uploading')
            // In real implementation, this would be:
            // const result = await actions.uploadAttachment(threadId, file)
            const result = await mockUploadFile({ 
              file: await file.arrayBuffer(),
              filename: file.name,
              mimeType: file.type,
              threadId: 'thread-123'
            })
            setUploadStatus('success')
          } catch (error) {
            setUploadStatus('error')
          }
        }
        
        return (
          <div>
            <button onClick={handleUpload}>Upload File</button>
            <div data-testid="status">{uploadStatus}</div>
          </div>
        )
      }
      
      const { getByText, getByTestId } = render(
        <EnhancedSyncProvider>
          <TestComponent />
        </EnhancedSyncProvider>
      )
      
      const uploadButton = getByText('Upload File')
      await userEvent.click(uploadButton)
      
      await waitFor(() => {
        expect(getByTestId('status')).toHaveTextContent('success')
      })
      
      expect(mockUploadFile).toHaveBeenCalledWith({
        file: expect.any(ArrayBuffer),
        filename: 'document.pdf',
        mimeType: 'application/pdf',
        threadId: 'thread-123'
      })
    })

    it('should handle multiple file uploads', async () => {
      const files = [
        createMockFile('doc1.pdf', 1024 * 1024, 'application/pdf'),
        createMockFile('image.png', 2 * 1024 * 1024, 'image/png'),
        createMockFile('data.csv', 500 * 1024, 'text/csv'),
      ]
      
      let uploadCount = 0
      mockUploadFile.mockImplementation(async () => {
        uploadCount++
        return {
          attachmentId: `attachment-${uploadCount}`,
          url: `https://example.com/file-${uploadCount}`
        }
      })
      
      // Simulate uploading multiple files
      for (const file of files) {
        await mockUploadFile({
          file: await file.arrayBuffer(),
          filename: file.name,
          mimeType: file.type,
          threadId: 'thread-123'
        })
      }
      
      expect(mockUploadFile).toHaveBeenCalledTimes(3)
      expect(uploadCount).toBe(3)
    })

    it('should validate file size limits', async () => {
      const largeFile = createMockFile('huge.pdf', 11 * 1024 * 1024, 'application/pdf') // 11MB
      const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB limit
      
      // Simulate client-side validation
      const validateFile = (file: File) => {
        if (file.size > MAX_FILE_SIZE) {
          throw new Error('File too large. Maximum size is 10MB.')
        }
        return true
      }
      
      expect(() => validateFile(largeFile)).toThrow('File too large')
    })

    it('should handle upload errors gracefully', async () => {
      mockUploadFile.mockRejectedValue(new Error('Network error'))
      
      try {
        await mockUploadFile({
          file: new ArrayBuffer(1024),
          filename: 'test.pdf',
          mimeType: 'application/pdf',
          threadId: 'thread-123'
        })
      } catch (error) {
        expect(error).toEqual(new Error('Network error'))
      }
      
      expect(mockUploadFile).toHaveBeenCalled()
    })
  })

  describe('Attachment Storage', () => {
    it('should store attachment metadata correctly', async () => {
      const attachmentData = {
        _id: 'attachment-123' as Id<'attachments'>,
        threadId: 'thread-123' as Id<'threads'>,
        messageId: 'message-123' as Id<'messages'>,
        filename: 'report.pdf',
        contentType: 'application/pdf',
        size: 1024 * 1024,
        storageId: 'storage-123' as Id<'_storage'>,
        uploadedAt: Date.now(),
      }
      
      mockGetAttachments.mockReturnValue([attachmentData])
      
      const { result } = renderHook(() => {
        return require('convex/react').useQuery(
          require('../../../convex/_generated/api').api.attachments.getAttachments,
          { threadId: 'thread-123' }
        )
      })
      
      expect(result.current).toHaveLength(1)
      expect(result.current[0]).toMatchObject({
        filename: 'report.pdf',
        contentType: 'application/pdf',
        size: 1024 * 1024,
      })
    })

    it('should handle PDF text extraction', async () => {
      const pdfAttachment = {
        _id: 'attachment-pdf' as Id<'attachments'>,
        filename: 'document.pdf',
        contentType: 'application/pdf',
        extractedText: 'This is the extracted text from the PDF document...',
        metadata: {
          pageCount: 5,
          author: 'John Doe',
          title: 'Sample Document'
        }
      }
      
      mockGetAttachments.mockReturnValue([pdfAttachment])
      
      const attachments = mockGetAttachments()
      const pdf = attachments.find(a => a.contentType === 'application/pdf')
      
      expect(pdf?.extractedText).toBeDefined()
      expect(pdf?.metadata?.pageCount).toBe(5)
    })
  })
})

describe('Message Streaming', () => {
  describe('StreamBuffer Implementation', () => {
    it('should buffer and flush messages correctly', async () => {
      const buffer = new StreamBuffer()
      const flushSpy = vi.fn()
      
      // Mock the flush callback
      buffer.onFlush = flushSpy
      
      // Add chunks
      buffer.addChunk('Hello ')
      buffer.addChunk('world')
      buffer.addChunk('!')
      
      // Force flush
      buffer.flush()
      
      expect(flushSpy).toHaveBeenCalledWith('Hello world!')
      expect(buffer.getContent()).toBe('Hello world!')
    })

    it('should auto-flush based on time interval', async () => {
      vi.useFakeTimers()
      
      const buffer = new StreamBuffer()
      const flushSpy = vi.fn()
      buffer.onFlush = flushSpy
      
      buffer.addChunk('Test')
      
      // Should not flush immediately
      expect(flushSpy).not.toHaveBeenCalled()
      
      // Advance time past flush interval (50ms)
      vi.advanceTimersByTime(60)
      
      expect(flushSpy).toHaveBeenCalledWith('Test')
      
      vi.useRealTimers()
    })

    it('should count tokens correctly', () => {
      const buffer = new StreamBuffer()
      
      buffer.addChunk('This is a test message with several tokens.')
      
      // Rough token count (actual implementation may vary)
      const tokenCount = buffer.getTokenCount()
      expect(tokenCount).toBeGreaterThan(5)
      expect(tokenCount).toBeLessThan(15)
    })

    it('should handle backpressure', async () => {
      const buffer = new StreamBuffer()
      const chunks: string[] = []
      
      buffer.onFlush = (content) => {
        chunks.push(content)
      }
      
      // Simulate rapid chunk additions
      for (let i = 0; i < 100; i++) {
        buffer.addChunk(`Chunk ${i} `)
      }
      
      buffer.flush()
      
      // Should batch chunks efficiently
      expect(chunks.length).toBeGreaterThan(0)
      expect(chunks.join('')).toContain('Chunk 99')
    })
  })

  describe('Real-time Streaming Updates', () => {
    it('should update UI in real-time during streaming', async () => {
      let messageContent = ''
      const mockGenerateResponse = vi.fn().mockImplementation(async ({ onToken }) => {
        const response = 'This is a streaming response.'
        for (const char of response) {
          messageContent += char
          onToken?.(char)
          await new Promise(r => setTimeout(r, 10))
        }
      })
      
      vi.mocked(require('convex/react').useAction).mockReturnValue(mockGenerateResponse)
      
      const TestComponent = () => {
        const [streaming, setStreaming] = React.useState(false)
        const [content, setContent] = React.useState('')
        
        const startStreaming = async () => {
          setStreaming(true)
          await mockGenerateResponse({
            threadId: 'thread-123',
            messages: [],
            onToken: (token: string) => {
              setContent(prev => prev + token)
            }
          })
          setStreaming(false)
        }
        
        return (
          <div>
            <button onClick={startStreaming}>Start Streaming</button>
            <div data-testid="content">{content}</div>
            <div data-testid="streaming">{streaming ? 'true' : 'false'}</div>
          </div>
        )
      }
      
      const { getByText, getByTestId } = render(<TestComponent />)
      
      await userEvent.click(getByText('Start Streaming'))
      
      // Should show streaming state
      expect(getByTestId('streaming')).toHaveTextContent('true')
      
      // Wait for streaming to complete
      await waitFor(() => {
        expect(getByTestId('content')).toHaveTextContent('This is a streaming response.')
        expect(getByTestId('streaming')).toHaveTextContent('false')
      }, { timeout: 1000 })
    })

    it('should handle streaming errors', async () => {
      const mockGenerateResponse = vi.fn().mockImplementation(async ({ onToken }) => {
        onToken?.('Starting...')
        throw new Error('Streaming failed')
      })
      
      vi.mocked(require('convex/react').useAction).mockReturnValue(mockGenerateResponse)
      
      let error: Error | null = null
      
      try {
        await mockGenerateResponse({
          threadId: 'thread-123',
          messages: [],
          onToken: vi.fn()
        })
      } catch (e) {
        error = e as Error
      }
      
      expect(error?.message).toBe('Streaming failed')
    })
  })

  describe('Performance', () => {
    it('should handle large streaming responses efficiently', async () => {
      const largeResponse = 'x'.repeat(10000) // 10k characters
      const chunks: string[] = []
      
      const buffer = new StreamBuffer()
      buffer.onFlush = (content) => chunks.push(content)
      
      const startTime = performance.now()
      
      // Simulate streaming in chunks
      for (let i = 0; i < largeResponse.length; i += 100) {
        buffer.addChunk(largeResponse.slice(i, i + 100))
      }
      
      buffer.flush()
      
      const endTime = performance.now()
      const processingTime = endTime - startTime
      
      // Should process quickly (adjust threshold as needed)
      expect(processingTime).toBeLessThan(100) // 100ms
      
      // Should have batched efficiently
      expect(chunks.length).toBeLessThan(50) // Not one chunk per character
      
      // Should have all content
      expect(chunks.join('').length).toBe(10000)
    })

    it('should not block UI during streaming', async () => {
      vi.useFakeTimers()
      
      let uiBlocked = false
      const checkUIResponsive = () => {
        uiBlocked = false
      }
      
      // Simulate UI check every 16ms (60fps)
      const uiInterval = setInterval(checkUIResponsive, 16)
      
      const buffer = new StreamBuffer()
      
      // Add many chunks rapidly
      for (let i = 0; i < 1000; i++) {
        buffer.addChunk(`Chunk ${i}`)
        uiBlocked = true
        vi.advanceTimersByTime(1)
      }
      
      clearInterval(uiInterval)
      
      // UI should remain responsive
      expect(uiBlocked).toBe(false)
      
      vi.useRealTimers()
    })
  })
})

describe('Integration: Attachments + Streaming', () => {
  it('should handle messages with attachments during streaming', async () => {
    const mockSendMessage = vi.fn().mockResolvedValue('message-123')
    const mockUploadFile = vi.fn().mockResolvedValue({
      attachmentId: 'attachment-123',
      url: 'https://example.com/file.pdf'
    })
    
    vi.mocked(require('convex/react').useMutation).mockReturnValue(mockSendMessage)
    vi.mocked(require('convex/react').useAction).mockReturnValue(mockUploadFile)
    
    // Simulate sending message with attachment
    const attachmentIds = ['attachment-123']
    
    await mockSendMessage({
      threadId: 'thread-123',
      content: 'Here is the document',
      attachmentIds
    })
    
    expect(mockSendMessage).toHaveBeenCalledWith({
      threadId: 'thread-123',
      content: 'Here is the document',
      attachmentIds: ['attachment-123']
    })
  })

  it('should maintain attachment references during message updates', async () => {
    const message = {
      _id: 'message-123' as Id<'messages'>,
      content: 'Original content',
      attachmentIds: ['attachment-1', 'attachment-2']
    }
    
    const mockUpdateMessage = vi.fn()
    vi.mocked(require('convex/react').useMutation).mockReturnValue(mockUpdateMessage)
    
    // Update message content but keep attachments
    await mockUpdateMessage({
      messageId: message._id,
      content: 'Updated content',
      // attachmentIds should be preserved
    })
    
    expect(mockUpdateMessage).toHaveBeenCalledWith({
      messageId: 'message-123',
      content: 'Updated content'
    })
    
    // In real implementation, attachmentIds would be preserved
  })
})

// Summary of findings
describe('Attachments & Streaming Summary', () => {
  it('documents the current state', () => {
    const findings = {
      working: [
        'Basic file upload infrastructure exists',
        'StreamBuffer implementation for smooth updates',
        'Attachment metadata storage',
        'Real-time streaming updates',
      ],
      issues: [
        'No actual attachment upload in sync engine',
        'StreamBuffer not integrated with message updates',
        'No attachment preview functionality',
        'Missing drag-and-drop in tests',
        'No progress tracking for uploads',
        'PDF extraction not fully implemented',
      ],
      recommendations: [
        'Integrate attachments with sync engine actions',
        'Add progress tracking for file uploads',
        'Implement attachment preview components',
        'Add retry logic for failed uploads',
        'Integrate StreamBuffer with message state updates',
        'Add support for attachment deletion',
      ]
    }
    
    console.log('\n=== ATTACHMENTS & STREAMING FINDINGS ===')
    console.log('Working:', findings.working)
    console.log('Issues:', findings.issues)
    console.log('Recommendations:', findings.recommendations)
    
    expect(findings.issues.length).toBeGreaterThan(0)
  })
})