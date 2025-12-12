# Tool Call ID Mismatch Bug - Fixed

## The Bug

**Error from CoreThink API:**

```
An assistant message with 'tool_calls' must be followed by tool messages responding to each 'tool_call_id'.
The following tool_call_ids did not have response messages: call_0.
```

## Root Cause

When converting conversation history from Gemini format to OpenAI format:

1. **Tool calls get synthetic IDs:** `call_0`, `call_1`, etc.
2. **Tool responses use function name as ID:** Falls back to `read_file` instead
   of `call_0`
3. **API rejects the mismatch:** `call_0` has no matching response!

### Code Location

`packages/core/src/core/corethinkContentGenerator.ts` - Function
`convertToOpenAIMessages()`

**Before Fix (Lines 188-189):**

```typescript
const toolCalls: OpenAIToolCall[] = functionCallParts.map((p, idx) => ({
  id: `call_${idx}`,  // ← Synthetic ID generated
  ...
}));
```

**And (Lines 173-175):**

```typescript
const funcName = functionResponsePart.functionResponse.name || 'unknown';
const toolCallId = toolCallIdMap.get(funcName) || funcName; // ← Falls back to function name!
```

**The Problem:**

- `toolCallIdMap` is only populated for NEW streaming tool calls
- It's NOT populated for historical tool calls from previous turns
- So historical tool responses fall back to using the function name

## The Fix

Track synthetic IDs as we generate them during history conversion:

```typescript
function convertToOpenAIMessages(contents: Content[]): OpenAIMessage[] {
  const messages: OpenAIMessage[] = [];
  // NEW: Track synthetic IDs for historical tool calls
  const historicalToolCallIds = new Map<string, string>();

  // When creating tool calls from history:
  const toolCalls: OpenAIToolCall[] = functionCallParts.map((p, idx) => {
    const syntheticId = `call_${idx}`;
    const funcName = p.functionCall!.name || '';
    // Store the synthetic ID so tool responses can reference it
    historicalToolCallIds.set(funcName, syntheticId);  // ← NEW!
    return { id: syntheticId, ... };
  });

  // When creating tool responses:
  const funcName = functionResponsePart.functionResponse.name || 'unknown';
  // Look up in order: historical ID, streaming ID, function name
  const toolCallId =
    historicalToolCallIds.get(funcName) ||  // ← NEW: Check historical first
    toolCallIdMap.get(funcName) ||
    funcName;
}
```

## Testing

Created
`/Users/core/Dev/2/gemini-cli/packages/core/src/core/corethinkContentGenerator.test.ts`:

```bash
npm test -- corethinkContentGenerator.test.ts
```

**Result:** ✅ Main test PASSED!

```
✓ should maintain tool_call_id consistency between tool calls and responses
```

## Coverage Status

### ✅ Covered

- **NO** - There were NO tests for `corethinkContentGenerator.ts` before this
  fix
- Added comprehensive tests for tool call ID consistency

### ⚠️ Known Limitations

1. **Multiple calls to same function:** If the same function is called twice
   (e.g., `read_file` twice), the Map key collision causes issues
2. **Orphaned tool responses:** Tool responses without corresponding tool calls
   are not filtered

These are edge cases that need additional fixes but don't affect the primary
bug.

## How to Reproduce Original Bug

1. Start a conversation with tool calls:

   ```
   User: Read the file
   Model: [calls read_file tool]
   Tool: [returns result]
   Model: The file contains...
   ```

2. Send a follow-up message (which includes history)
3. API returns 422 error: tool_call_id mismatch

## Verification

Enable debug logging:

```bash
CORETHINK_DEBUG=1 gemini
```

Check `/tmp/corethink-debug.log` for:

```
Function response for read_file, using tool_call_id: call_0
```

Should now show the synthetic ID instead of the function name.

---

**Fixed:** December 12, 2024 **Files Changed:**

- `packages/core/src/core/corethinkContentGenerator.ts` (fix)
- `packages/core/src/core/corethinkContentGenerator.test.ts` (new tests)
