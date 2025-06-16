import { useQuery, useMutation } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { Id } from '../../convex/_generated/dataModel';
import { useEffect, useState } from 'react';
import { Users, Edit3, Eye } from 'lucide-react';

interface CollaborationPresenceProps {
  threadId: Id<"threads">;
}

export function CollaborationPresence({ threadId }: CollaborationPresenceProps) {
  const [sessionId, setSessionId] = useState<Id<"activeSessions"> | null>(null);
  const activeSessions = useQuery(api.collaboration.getActiveSessions, { threadId });
  const joinSession = useMutation(api.collaboration.joinSession);
  const leaveSession = useMutation(api.collaboration.leaveSession);
  const updateTypingStatus = useMutation(api.collaboration.updateTypingStatus);

  // Join session on mount
  useEffect(() => {
    let mounted = true;
    
    const join = async () => {
      try {
        const id = await joinSession({ threadId });
        if (mounted) {
          setSessionId(id);
        }
      } catch (error) {
        console.error('Failed to join collaborative session:', error);
      }
    };

    join();

    return () => {
      mounted = false;
      // Leave session on unmount
      if (sessionId) {
        leaveSession({ sessionId }).catch(console.error);
      }
    };
  }, [threadId]);

  // Update typing status
  const handleTyping = async (isTyping: boolean) => {
    if (!sessionId) return;
    
    try {
      await updateTypingStatus({ sessionId, isTyping });
    } catch (error) {
      console.error('Failed to update typing status:', error);
    }
  };

  if (!activeSessions || activeSessions.length === 0) {
    return null;
  }

  const typingUsers = activeSessions.filter(s => s.isTyping && s.user);
  const viewingUsers = activeSessions.filter(s => !s.isTyping && s.user);

  return (
    <div className="flex items-center gap-4 px-4 py-2 bg-blue-50 border-b border-blue-100">
      <div className="flex items-center gap-2 text-sm text-blue-700">
        <Users className="w-4 h-4" />
        <span className="font-medium">
          {activeSessions.length} other{activeSessions.length === 1 ? ' person' : ' people'} here
        </span>
      </div>

      {/* Viewing users */}
      {viewingUsers.length > 0 && (
        <div className="flex items-center gap-2">
          <Eye className="w-3 h-3 text-blue-600" />
          <div className="flex -space-x-2">
            {viewingUsers.slice(0, 3).map((session) => (
              <div
                key={session._id}
                className="w-8 h-8 rounded-full bg-gray-300 border-2 border-white flex items-center justify-center text-xs font-medium"
                title={session.user?.name || 'Anonymous'}
              >
                {session.user?.image ? (
                  <img
                    src={session.user.image}
                    alt={session.user.name || 'User'}
                    className="w-full h-full rounded-full object-cover"
                  />
                ) : (
                  <span>{(session.user?.name || 'A')[0].toUpperCase()}</span>
                )}
              </div>
            ))}
            {viewingUsers.length > 3 && (
              <div className="w-8 h-8 rounded-full bg-blue-100 border-2 border-white flex items-center justify-center text-xs font-medium text-blue-700">
                +{viewingUsers.length - 3}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Typing indicator */}
      {typingUsers.length > 0 && (
        <div className="flex items-center gap-2 text-sm text-blue-600">
          <Edit3 className="w-3 h-3 animate-pulse" />
          <span>
            {typingUsers.map(s => s.user?.name || 'Someone').join(', ')}
            {typingUsers.length === 1 ? ' is' : ' are'} typing...
          </span>
        </div>
      )}
    </div>
  );
}