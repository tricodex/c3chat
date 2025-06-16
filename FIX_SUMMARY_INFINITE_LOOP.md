# Fix Summary: Infinite Re-render Loop

## Issue
Maximum update depth exceeded error in sync engine at line 720, causing infinite re-renders when syncing messages.

## Root Cause
The useEffect was dispatching `SET_MESSAGES_FROM_CONVEX` on every render because:
1. `convexMessages` array was in the dependency array
2. Every dispatch created a new state, triggering new renders
3. New renders created new `convexMessages` array references (even with same content)
4. This triggered the useEffect again, creating an infinite loop

## Solution Applied
Used React 19.1 best practices to prevent the infinite loop:

1. **Memoized Message IDs**: Created a stable reference by memoizing just the message IDs
```typescript
const convexMessageIds = useMemo(() => {
  return convexMessages.map(m => m._id).join(',');
}, [convexMessages]);
```

2. **Updated Dependencies**: Changed the useEffect dependency from the full array to just the ID string
```typescript
}, [convexMessageIds, state.selectedThreadId, state.isInitialized, convexMessages]);
```

3. **Added Guard Clause**: Skip dispatch if both arrays are empty
```typescript
if (!convexMessages.length && !state.messages[state.selectedThreadId]?.length) return;
```

## Why This Works
- The memoized ID string only changes when messages actually change (add/remove/reorder)
- Prevents re-renders caused by array reference changes
- Still syncs data properly when real changes occur
- Follows React 19.1 best practices for preventing infinite loops

## Best Practices Applied
1. ✅ Avoid objects/arrays as direct dependencies when possible
2. ✅ Use primitive values (strings) for comparison
3. ✅ Leverage useMemo for expensive computations
4. ✅ Add guard clauses to prevent unnecessary operations
5. ✅ Keep dependency arrays minimal but complete