import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { useState } from "react";
import { toast } from "sonner";

interface ThreadListProps {
  selectedThreadId: Id<"threads"> | null;
  onSelectThread: (threadId: Id<"threads">) => void;
}

export function ThreadList({ selectedThreadId, onSelectThread }: ThreadListProps) {
  const threads = useQuery(api.threads.list) || [];
  const createThread = useMutation(api.threads.create);
  const [isCreating, setIsCreating] = useState(false);
  const [newThreadTitle, setNewThreadTitle] = useState("");

  const handleCreateThread = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newThreadTitle.trim()) return;

    setIsCreating(true);
    try {
      const threadId = await createThread({ title: newThreadTitle.trim() });
      onSelectThread(threadId);
      setNewThreadTitle("");
      toast.success("New thread created!");
    } catch (error) {
      toast.error("Failed to create thread");
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="p-4 border-b">
        <h3 className="font-semibold text-lg">Threads</h3>
      </div>

      {/* New Thread Form */}
      <div className="p-4 border-b">
        <form onSubmit={handleCreateThread} className="space-y-2">
          <input
            type="text"
            value={newThreadTitle}
            onChange={(e) => setNewThreadTitle(e.target.value)}
            placeholder="New thread title..."
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            disabled={isCreating}
          />
          <button
            type="submit"
            disabled={isCreating || !newThreadTitle.trim()}
            className="w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isCreating ? "Creating..." : "New Thread"}
          </button>
        </form>
      </div>

      {/* Thread List */}
      <div className="flex-1 overflow-y-auto">
        {threads.length === 0 ? (
          <div className="p-4 text-center text-gray-500">
            No threads yet. Create your first thread above!
          </div>
        ) : (
          <div className="space-y-1 p-2">
            {threads.map((thread) => (
              <button
                key={thread._id}
                onClick={() => onSelectThread(thread._id)}
                className={`w-full text-left p-3 rounded-lg transition-colors ${
                  selectedThreadId === thread._id
                    ? "bg-blue-100 border-blue-300"
                    : "hover:bg-gray-100"
                }`}
              >
                <div className="font-medium truncate">{thread.title}</div>
                <div className="text-sm text-gray-500">
                  {new Date(thread.lastMessageAt).toLocaleDateString()}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
