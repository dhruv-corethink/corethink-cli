#!/bin/bash

# Simple verification script for CoreThink parameter mappings
# This bypasses the telemetry issue and directly verifies functionality

set -e

if [ -z "$CORETHINK_API_KEY" ] || [ -z "$CORETHINK_API_URL" ]; then
    echo "❌ Error: CORETHINK_API_KEY and CORETHINK_API_URL must be set"
    exit 1
fi

echo "🧪 CoreThink Parameter Mapping Verification"
echo "=========================================="
echo ""

BUNDLE_PATH="$(dirname "$0")/../bundle/gemini.js"
TEST_DIR="/tmp/corethink-verify-$$"

mkdir -p "$TEST_DIR"
cd "$TEST_DIR"

echo "Test directory: $TEST_DIR"
echo ""

# Test 1: write_file parameter mapping
echo "✓ Test 1: write_file (path → file_path)"
timeout 90 node "$BUNDLE_PATH" --yolo "create a file called test1.txt with content hello" > /tmp/test1-output.log 2>&1 || true
sleep 1
if [ -f "test1.txt" ] && [ -s "test1.txt" ]; then
    echo "  ✅ PASS: File created successfully ($(cat test1.txt))"
else
    echo "  ❌ FAIL: File not created"
    [ -f /tmp/test1-output.log ] && tail -5 /tmp/test1-output.log
fi

# Test 2: read_file parameter mapping
echo ""
echo "✓ Test 2: read_file (path → file_path)"
echo "sample text" > test2.txt
timeout 90 node "$BUNDLE_PATH" --yolo "read test2.txt and tell me what it says" > /tmp/test2-output.log 2>&1 || true
sleep 1
if grep -qi "sample" /tmp/test2-output.log 2>/dev/null; then
    echo "  ✅ PASS: File read successfully"
else
    echo "  ❌ FAIL: File not read"
fi

# Test 3: replace parameter mapping
echo ""
echo "✓ Test 3: replace (path → file_path, old → old_string, new → new_string)"
echo "Hello World" > test3.txt
timeout 90 node "$BUNDLE_PATH" --yolo "change World to CoreThink in test3.txt" > /tmp/test3-output.log 2>&1 || true
sleep 1
if [ -f "test3.txt" ] && grep -q "CoreThink" test3.txt 2>/dev/null; then
    echo "  ✅ PASS: Text replaced successfully ($(cat test3.txt))"
else
    echo "  ❌ FAIL: Text not replaced ($(cat test3.txt 2>/dev/null || echo 'file missing'))"
fi

# Test 4: Read-write workflow
echo ""
echo "✓ Test 4: Read-write workflow"
echo "1.0.0" > version.txt
timeout 90 node "$BUNDLE_PATH" --yolo "read version.txt and change it to 1.0.1" > /tmp/test4-output.log 2>&1 || true
sleep 1
if [ -f "version.txt" ] && grep -q "1.0.1" version.txt 2>/dev/null; then
    echo "  ✅ PASS: Workflow completed successfully ($(cat version.txt))"
else
    echo "  ❌ FAIL: Workflow didn't complete ($(cat version.txt 2>/dev/null || echo 'file missing'))"
fi

echo ""
echo "=========================================="
echo "Verification complete!"
echo ""
echo "Note: These tests verify parameter mapping functionality works"
echo "even though the integration test telemetry may have issues."

# Cleanup
cd /
rm -rf "$TEST_DIR"
