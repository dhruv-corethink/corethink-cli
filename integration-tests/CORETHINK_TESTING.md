# CoreThink API Integration Testing

This directory contains E2E tests for verifying CoreThink API parameter
mappings.

## Overview

The CoreThink API uses OpenAI-compatible format with different parameter names
than Gemini's tool schemas. The tests in `corethink-parameter-mappings.test.ts`
verify that parameter mapping works correctly for all tools.

## Setup

### Prerequisites

1. CoreThink API credentials:

   ```bash
   export CORETHINK_API_KEY=sk_your_api_key_here
   export CORETHINK_API_URL=https://api.corethink.ai/v1/code
   ```

2. Build the bundle:
   ```bash
   npm run bundle
   ```

## Running Tests

### Run all CoreThink parameter mapping tests:

```bash
CORETHINK_API_KEY=sk_xxx CORETHINK_API_URL=https://api.corethink.ai/v1/code \
  npm run test:integration:sandbox:none -- corethink-parameter-mappings.test.ts
```

### Run with verbose output:

```bash
VERBOSE=true CORETHINK_API_KEY=sk_xxx CORETHINK_API_URL=https://api.corethink.ai/v1/code \
  npm run test:integration:sandbox:none -- corethink-parameter-mappings.test.ts --reporter=verbose
```

### Run specific test suite:

```bash
CORETHINK_API_KEY=sk_xxx CORETHINK_API_URL=https://api.corethink.ai/v1/code \
  npm run test:integration:sandbox:none -- corethink-parameter-mappings.test.ts -t "write_file"
```

### Run with debug logging:

```bash
CORETHINK_DEBUG=1 VERBOSE=true CORETHINK_API_KEY=sk_xxx CORETHINK_API_URL=https://api.corethink.ai/v1/code \
  npm run test:integration:sandbox:none -- corethink-parameter-mappings.test.ts
```

Debug logs will be written to `/tmp/corethink-debug.log`

## Test Coverage

The test suite covers parameter mappings for:

### ✓ File Operations

- **write_file**: Maps `path` → `file_path`
- **read_file**: Maps `path` → `file_path`
- **replace/edit**: Maps `path` → `file_path`, `old` → `old_string`, `new` →
  `new_string`

### ✓ Directory Operations

- **list_directory**: Maps `path`/`directory` → `dir_path`
- **glob**: Maps `path` → `pattern`, `directory` → `dir_path`
- **search_file_content**: Maps `path` → `file_path`, `search` → `pattern`

### ✓ Shell Commands

- **run_shell_command**: Maps `cmd` → `command`, `directory` → `dir_path`

### ✓ Workflows

- Read-then-write sequences
- Multiple file operations
- Error handling

## Test Structure

Each test:

1. Creates a TestRig with specific tool configuration
2. Executes a natural language prompt
3. Waits for expected tool calls
4. Verifies the results (file contents, tool calls, etc.)
5. Provides detailed debug output on failure

## Skipping Tests

If `CORETHINK_API_KEY` or `CORETHINK_API_URL` is not set, all tests in this
suite will be skipped automatically with a warning message.

## Troubleshooting

### Tests timing out

- Increase timeout: Add `--testTimeout=120000` to the command
- Check API connectivity:
  `curl -H "Authorization: Bearer $CORETHINK_API_KEY" $CORETHINK_API_URL`

### Parameter mapping failures

- Check debug logs: `tail -f /tmp/corethink-debug.log`
- Look for lines like: `Tool call: write_file, raw args: {...}` and
  `Tool call: write_file, final args: {...}`
- Verify the mapping transformed parameters correctly

### Tool calls not being made

- Check if the tool is enabled in test settings
- Verify API is responding (not rate limited)
- Look at stdout/stderr output for errors

## Performance Expectations

Typical test execution times:

- **CLI startup**: ~1.4s (tool discovery)
- **Single file write**: ~2-3s (API call + execution)
- **Read-write workflow**: ~5-7s (multiple API calls)
- **Full test suite**: ~2-5 minutes (depends on API latency)

## Adding New Tests

To add a test for a new tool parameter mapping:

1. Add the mapping to `packages/core/src/core/corethinkContentGenerator.ts`:

   ```typescript
   'your_tool': { 'openai_param': 'gemini_param' }
   ```

2. Add a test in `corethink-parameter-mappings.test.ts`:

   ```typescript
   it('should map parameters for your_tool', async () => {
     const rig = new TestRig();
     await rig.setup('your_tool mapping', {
       settings: { tools: { core: ['your_tool'] } },
     });

     const result = await rig.run('Use your_tool to do something');

     const foundToolCall = await rig.waitForToolCall('your_tool');
     expect(foundToolCall).toBeTruthy();
   });
   ```

3. Run the test to verify it works

4. Update this README to document the new mapping

## CI/CD Integration

To run these tests in CI:

```yaml
- name: Run CoreThink E2E Tests
  env:
    CORETHINK_API_KEY: ${{ secrets.CORETHINK_API_KEY }}
    CORETHINK_API_URL: ${{ secrets.CORETHINK_API_URL }}
  run: |
    npm run bundle
    npm run test:integration:sandbox:none -- corethink-parameter-mappings.test.ts
```

## Related Files

- **Test file**: `integration-tests/corethink-parameter-mappings.test.ts`
- **Mapping logic**: `packages/core/src/core/corethinkContentGenerator.ts`
- **Test helper**: `integration-tests/test-helper.ts`
- **Tool definitions**: `packages/core/src/tools/*.ts`
