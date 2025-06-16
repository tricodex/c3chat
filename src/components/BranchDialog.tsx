import { useState } from 'react';
import { useMutation, useQuery } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { Id } from '../../convex/_generated/dataModel';
import { toast } from 'sonner';
import { GitBranch, X, MessageSquare, Clock } from 'lucide-react';

interface BranchDialogProps {
  threadId: Id<"threads">;
  messageId?: Id<"messages">;
  onClose: () => void;
  onBranchCreated?: (newThreadId: Id<"threads">) => void;
}

export function BranchDialog({ threadId, messageId, onClose, onBranchCreated }: BranchDialogProps) {
  const [isCreating, setIsCreating] = useState(false);
  const [branchName, setBranchName] = useState('');
  
  const thread = useQuery(api.threads.get, { threadId });
  const branches = useQuery(api.threads.getBranches, { threadId });
  const createBranch = useMutation(api.threads.createBranch);

  const handleCreateBranch = async () => {
    if (!thread) return;
    
    setIsCreating(true);
    try {
      const newThreadId = await createBranch({
        parentThreadId: threadId,
        branchPoint: messageId,
      });
      
      toast.success('Branch created successfully');
      
      if (onBranchCreated) {
        onBranchCreated(newThreadId);
      }
      
      onClose();
    } catch (error) {
      console.error('Failed to create branch:', error);
      toast.error('Failed to create branch');
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
        <div className="flex items-center justify-between p-6 border-b">
          <div className="flex items-center gap-2">
            <GitBranch className="w-5 h-5 text-blue-600" />
            <h2 className="text-lg font-semibold">Create Branch</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 rounded-md transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          {/* Current thread info */}
          <div className="bg-gray-50 rounded-lg p-4">
            <p className="text-sm text-gray-600 mb-1">Branching from:</p>
            <p className="font-medium">{thread?.title}</p>
            {messageId && (
              <p className="text-sm text-gray-500 mt-2">
                <MessageSquare className="w-3 h-3 inline mr-1" />
                Branch will include messages up to the selected point
              </p>
            )}
          </div>

          {/* Branch name input */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Branch name (optional)
            </label>
            <input
              type="text"
              value={branchName}
              onChange={(e) => setBranchName(e.target.value)}
              placeholder={`${thread?.title} (Branch)`}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Existing branches */}
          {branches && branches.length > 0 && (
            <div>
              <p className="text-sm font-medium text-gray-700 mb-2">
                Existing branches ({branches.length})
              </p>
              <div className="space-y-2 max-h-32 overflow-y-auto">
                {branches.map((branch) => (
                  <div
                    key={branch._id}
                    className="flex items-center justify-between p-2 bg-gray-50 rounded-md text-sm"
                  >
                    <span className="truncate">{branch.title}</span>
                    <span className="text-gray-500 text-xs flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {new Date(branch._creationTime).toLocaleDateString()}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Info */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
            <p className="text-sm text-blue-800">
              Branching creates a new conversation that starts from this point. 
              You can explore different paths without affecting the original conversation.
            </p>
          </div>
        </div>

        <div className="flex justify-end gap-3 p-6 border-t bg-gray-50">
          <button
            onClick={onClose}
            disabled={isCreating}
            className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleCreateBranch}
            disabled={isCreating}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
          >
            {isCreating ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                Creating...
              </>
            ) : (
              <>
                <GitBranch className="w-4 h-4" />
                Create Branch
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}