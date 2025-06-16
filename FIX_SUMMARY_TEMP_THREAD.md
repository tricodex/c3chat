# Fix Summary: Temporary Thread ID Error

## Issue
When creating a new thread, the TokenUsageBar component was trying to query Convex with a temporary thread ID (`temp_...`), causing a validation error.

## Root Cause
1. New threads are created with temporary IDs for optimistic UI updates
2. TokenUsageBar was directly querying `api.messages.list` without checking if the thread ID was temporary
3. Convex expects real IDs (format like `k57cn66htbsedcv0de7ndfac517hzhm3`), not temporary ones

## Solution Applied
Modified TokenUsageBar.tsx to skip the Convex query when the thread ID is temporary:

```typescript
// Skip query if threadId is temporary (starts with "temp_")
const isTemporaryThread = typeof threadId === 'string' && threadId.startsWith('temp_');
const messages = useQuery(
  api.messages.list, 
  isTemporaryThread ? "skip" : { threadId }
);
```

## Why This Works
1. Temporary threads don't have messages in Convex yet
2. The query is skipped until the thread gets a real ID
3. Once the thread is created on the server, it gets a real ID and the query runs normally

## Other Components Checked
- ✅ sync-engine already handles temp IDs in its messages query
- ✅ Header component already hides ModelSelector for optimistic threads
- ✅ FileUpload handles optional thread IDs correctly

## No Compromises Made
- This is a proper fix, not a workaround
- The UI remains responsive with optimistic updates
- No functionality is lost - token usage simply shows nothing until the thread is real
- The error is completely eliminated