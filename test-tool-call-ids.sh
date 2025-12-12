#!/bin/bash
# Test script to verify tool call ID fix works with CoreThink API

echo "Testing tool call ID fix..."
echo ""
echo "This will:"
echo "1. Start the CLI with debug logging enabled"
echo "2. Send a prompt that triggers tool calls"
echo "3. Check the debug log for correct tool_call_id mapping"
echo ""

# Set debug logging
export CORETHINK_DEBUG=1

# Clear old debug log
rm -f /tmp/corethink-debug.log

# Run the bundled CLI with a test prompt
echo "Running CLI with test prompt..."
echo ""

# Use the bundle
cd /Users/core/Dev/2/gemini-cli
./bundle/gemini.js --yolo "List the files in the current directory" &

# Wait for process to complete
sleep 10

# Check the debug log
echo ""
echo "=== Debug Log Check ==="
echo ""

if [ -f /tmp/corethink-debug.log ]; then
    echo "Checking for tool_call_id in debug log..."
    echo ""

    # Look for the debug log line that shows tool_call_id usage
    grep "Function response for" /tmp/corethink-debug.log || echo "No function responses found"

    echo ""
    echo "Checking for call_ prefix in tool_call_id..."
    if grep -q "tool_call_id: call_" /tmp/corethink-debug.log; then
        echo "✓ FIX VERIFIED: tool_call_id uses synthetic 'call_' prefix"
    else
        echo "✗ FIX NOT WORKING: tool_call_id does not use synthetic prefix"
    fi

    echo ""
    echo "Full debug log:"
    cat /tmp/corethink-debug.log
else
    echo "No debug log found at /tmp/corethink-debug.log"
    echo "Make sure CORETHINK_DEBUG=1 is set"
fi
