# Multi-Tab Message Retention Design Review

## Current Implementation

### Architecture
```
┌─────────────────────────────────────────┐
│  useChat hook (one instance)            │
│  ├── messagesMapRef: Map<sessionId,     │
│  │                      Message[]>      │
│  ├── messages: Message[] (current)      │
│  └── updateMessages()                   │
└─────────────────────────────────────────┘
```

### How It Works
1. **Storage**: `messagesMapRef` stores all messages for all sessions
2. **Updates**: `updateMessages()` updates both state and Map atomically
3. **Switching**: `useEffect` loads session's messages from Map when `sessionId` changes
4. **Cleanup**: Map entry cleared when tab is closed (via `deleteSession`)

---

## Analysis for Long Conversations

### Memory Usage

| Scenario | Est. Memory |
|----------|-------------|
| 1 tab, 100 short messages | ~50 KB |
| 1 tab, 100 long messages (~4K chars) | ~400 KB |
| 5 tabs, 100 msgs each | ~2 MB |
| 10 tabs, 200 msgs each | ~8 MB |

**Assessment**: ✅ **Acceptable for expected use case**
- Ephemeral design means memory freed on app quit
- Low tab count expected (design assumption)
- Modern systems handle this easily

### Performance Characteristics

#### Tab Switching
```typescript
useEffect(() => {
  const sessionMessages = messagesMapRef.current.get(sessionId) || [];
  setMessages(sessionMessages);  // O(1) ref update + re-render
}, [sessionId]);
```
- **Time complexity**: O(1) Map lookup
- **Render impact**: Full message list re-render
- **Bottleneck**: React rendering long lists, not the Map

#### Message Streaming
```typescript
updateMessages((prev) =>
  prev.map((msg) =>
    msg.id === assistantMessageId
      ? { ...msg, content: msg.content + chunk }
      : msg
  )
);
```
- **Time complexity**: O(n) per chunk (finds message by ID)
- **Updates**: One state update + one Map update per chunk
- **Assessment**: ⚠️ **Could be optimized** for very long responses

---

## Potential Issues

### 1. Unbounded Memory Growth
**Risk**: Low
**Impact**: Users with many long conversations could use significant RAM

**Current safeguards**:
- Ephemeral (memory freed on quit)
- Tab limit not enforced but UI discourages many tabs

**Recommendation**: Add soft limit (e.g., max 500 messages per session)

### 2. Message Array Copying
**Risk**: Low
**Impact**: Each update creates new array (immutable pattern)

```typescript
// Current: Creates new array every chunk
updateMessages((prev) =>
  prev.map((msg) => ... )  // O(n) copy
);
```

**For 100 messages × 1000 chunks** = 100,000 array operations

**Assessment**: ✅ **Acceptable** - JavaScript engines optimize this well

### 3. Tab Switch During Streaming
**Risk**: Medium
**Impact**: If user switches tabs while AI is responding:
- Abort controller might not be properly cleaned up
- Messages continue streaming to Map but not visible

**Current behavior**: 
- Streaming continues in background (to Map)
- User sees complete message when returning to tab
- Abort only happens if user clicks "stop" or closes tab

**Assessment**: ✅ **Acceptable** - Messages still saved correctly

---

## Recommendations

### Option 1: Keep Current Design (Recommended)
**Rationale**:
- Simple, works well for expected use case
- No premature optimization needed
- Ephemeral nature limits memory exposure

**Add minor safeguard**:
```typescript
// In updateMessages, optional limit
const MAX_MESSAGES = 500;
if (updated.length > MAX_MESSAGES) {
  updated = updated.slice(-MAX_MESSAGES);
}
```

### Option 2: Optimize for Very Long Conversations
If users report performance issues with long chats:

1. **Virtualize message list** - Only render visible messages
2. **Message pagination** - Load older messages on scroll
3. **Separate storage** - Use IndexedDB for large conversations

### Option 3: Streaming Optimization
Replace array search with direct reference:
```typescript
// Current: O(n) search per chunk
prev.map((msg) => msg.id === id ? ... : msg)

// Optimized: O(1) reference update
const msg = messagesMapRef.current.get(sessionId)
  .find(m => m.id === assistantMessageId);
if (msg) msg.content += chunk;
// Then trigger re-render
```

---

## Conclusion

**Verdict**: ✅ **Current design is sound for v1**

The message retention design is appropriate for:
- Ephemeral sessions (memory freed on quit)
- Low tab count (not expecting mass tabs)
- Typical conversation lengths

**No changes required** unless user feedback indicates performance issues with very long conversations (>500 messages).

---

*Review Date: 2026-02-12*
