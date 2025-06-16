import { useMessages, useSelectedThread } from "./lib/corrected-sync-engine";

export function DebugMessages() {
  const selectedThread = useSelectedThread();
  const messages = useMessages(selectedThread?._id);
  
  console.log('Debug - Selected Thread:', selectedThread?._id);
  console.log('Debug - Messages Count:', messages.length);
  console.log('Debug - Messages:', messages.map(m => ({
    id: m._id,
    content: m.content.substring(0, 50) + '...',
    role: m.role,
    threadId: m.threadId
  })));
  
  return (
    <div style={{ 
      position: 'fixed', 
      bottom: 10, 
      right: 10, 
      background: 'black', 
      color: 'white', 
      padding: 10,
      fontSize: 12,
      maxWidth: 300,
      borderRadius: 5,
      zIndex: 9999
    }}>
      <div>Thread: {selectedThread?._id}</div>
      <div>Messages: {messages.length}</div>
      <div style={{ maxHeight: 200, overflow: 'auto' }}>
        {messages.map((m, i) => (
          <div key={i} style={{ borderBottom: '1px solid #333', padding: 2 }}>
            {m.role}: {m.content.substring(0, 30)}...
          </div>
        ))}
      </div>
    </div>
  );
}