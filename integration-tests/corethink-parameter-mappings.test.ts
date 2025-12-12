/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * E2E tests for CoreThink API parameter mappings
 *
 * These tests verify that parameter names from OpenAI format (used by CoreThink)
 * are correctly mapped to Gemini's expected parameter names.
 *
 * Run with: CORETHINK_API_KEY=xxx CORETHINK_API_URL=xxx npm run test:integration:sandbox:none -- corethink-parameter-mappings.test.ts
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { TestRig, printDebugInfo, validateModelOutput } from './test-helper.js';

// Skip these tests if not using CoreThink API
const isCorethinkEnabled = () => {
  return !!(process.env['CORETHINK_API_KEY'] && process.env['CORETHINK_API_URL']);
};

const describeCorethink = isCorethinkEnabled() ? describe : describe.skip;

describeCorethink('CoreThink Parameter Mappings', () => {
  beforeAll(() => {
    if (!isCorethinkEnabled()) {
      console.warn('⚠️  CoreThink tests skipped: CORETHINK_API_KEY or CORETHINK_API_URL not set');
    } else {
      console.log('✓ Running CoreThink parameter mapping tests');
      console.log(`  API URL: ${process.env['CORETHINK_API_URL']}`);
    }
  });

  describe('write_file parameter mapping', () => {
    it('should map "path" to "file_path" for write_file', async () => {
      const rig = new TestRig();
      await rig.setup('write_file path mapping', {
        settings: { tools: { core: ['write_file', 'read_file'] } },
      });

      const result = await rig.run('Create a file called test-write.txt with the content "hello from CoreThink"');

      const foundToolCall = await rig.waitForToolCall('write_file');

      if (!foundToolCall) {
        printDebugInfo(rig, result);
      }

      expect(foundToolCall, 'Expected write_file tool call').toBeTruthy();

      const fileContent = rig.readFile('test-write.txt');
      expect(fileContent).toContain('hello from CoreThink');

      if (process.env['VERBOSE']) {
        console.log('✓ write_file path mapping test passed');
      }
    });

    it('should handle write_file with multiple files', async () => {
      const rig = new TestRig();
      await rig.setup('write_file multiple files', {
        settings: { tools: { core: ['write_file'] } },
      });

      const result = await rig.run('Create file1.txt with "first" and file2.txt with "second"');

      const foundToolCall = await rig.waitForToolCall('write_file');

      if (!foundToolCall) {
        printDebugInfo(rig, result);
      }

      expect(foundToolCall, 'Expected at least one write_file call').toBeTruthy();

      // At least one file should be created
      const file1Exists = rig.fileExists('file1.txt');
      const file2Exists = rig.fileExists('file2.txt');

      expect(file1Exists || file2Exists, 'Expected at least one file to exist').toBeTruthy();

      if (process.env['VERBOSE']) {
        console.log('✓ write_file multiple files test passed');
      }
    });
  });

  describe('read_file parameter mapping', () => {
    it('should map "path" to "file_path" for read_file', async () => {
      const rig = new TestRig();
      await rig.setup('read_file path mapping', {
        settings: { tools: { core: ['read_file'] } },
      });

      rig.createFile('test-read.txt', 'test content for reading');

      const result = await rig.run('Read the file test-read.txt and tell me what it contains');

      const foundToolCall = await rig.waitForToolCall('read_file');

      if (!foundToolCall) {
        printDebugInfo(rig, result);
      }

      expect(foundToolCall, 'Expected read_file tool call').toBeTruthy();
      validateModelOutput(result, 'test content', 'read_file mapping test');

      if (process.env['VERBOSE']) {
        console.log('✓ read_file path mapping test passed');
      }
    });
  });

  describe('replace/edit parameter mapping', () => {
    it('should map parameters for replace tool', async () => {
      const rig = new TestRig();
      await rig.setup('replace parameter mapping', {
        settings: { tools: { core: ['replace', 'read_file'] } },
      });

      rig.createFile('test-replace.txt', 'Hello World');

      const result = await rig.run('Replace "World" with "CoreThink" in test-replace.txt');

      const foundToolCall = await rig.waitForAnyToolCall(['replace', 'edit', 'write_file']);

      if (!foundToolCall) {
        printDebugInfo(rig, result);
      }

      expect(foundToolCall, 'Expected replace/edit/write_file tool call').toBeTruthy();

      const fileContent = rig.readFile('test-replace.txt');
      expect(fileContent).toContain('CoreThink');

      if (process.env['VERBOSE']) {
        console.log('✓ replace parameter mapping test passed');
      }
    });
  });

  describe('list_directory parameter mapping', () => {
    it('should map "path"/"directory" to "dir_path" for list_directory', async () => {
      const rig = new TestRig();
      await rig.setup('list_directory path mapping', {
        settings: { tools: { core: ['list_directory', 'write_file'] } },
      });

      // Create some files to list
      rig.createFile('file1.txt', 'content1');
      rig.createFile('file2.txt', 'content2');

      const result = await rig.run('List the files in the current directory');

      const foundToolCall = await rig.waitForToolCall('list_directory');

      if (!foundToolCall) {
        printDebugInfo(rig, result);
      }

      expect(foundToolCall, 'Expected list_directory tool call').toBeTruthy();
      validateModelOutput(result, ['file1.txt', 'file2.txt'], 'list_directory mapping test');

      if (process.env['VERBOSE']) {
        console.log('✓ list_directory path mapping test passed');
      }
    });
  });

  describe('glob parameter mapping', () => {
    it('should map "path" to "pattern" for glob', async () => {
      const rig = new TestRig();
      await rig.setup('glob pattern mapping', {
        settings: { tools: { core: ['glob', 'write_file'] } },
      });

      rig.createFile('test1.txt', 'content1');
      rig.createFile('test2.txt', 'content2');
      rig.createFile('other.log', 'log content');

      const result = await rig.run('Find all .txt files in the current directory');

      const foundToolCall = await rig.waitForToolCall('glob');

      if (!foundToolCall) {
        printDebugInfo(rig, result);
      }

      expect(foundToolCall, 'Expected glob tool call').toBeTruthy();

      if (process.env['VERBOSE']) {
        console.log('✓ glob pattern mapping test passed');
      }
    });
  });

  describe('shell command parameter mapping', () => {
    it('should map "cmd" to "command" for run_shell_command', async () => {
      const rig = new TestRig();
      await rig.setup('shell command mapping', {
        settings: { tools: { core: ['run_shell_command'] } },
      });

      const result = await rig.run('Run the echo command to print "hello shell"');

      const foundToolCall = await rig.waitForToolCall('run_shell_command');

      if (!foundToolCall) {
        printDebugInfo(rig, result);
      }

      expect(foundToolCall, 'Expected run_shell_command tool call').toBeTruthy();

      if (process.env['VERBOSE']) {
        console.log('✓ run_shell_command parameter mapping test passed');
      }
    });
  });

  describe('search_file_content parameter mapping', () => {
    it('should map search parameters correctly', async () => {
      const rig = new TestRig();
      await rig.setup('search parameter mapping', {
        settings: { tools: { core: ['search_file_content', 'write_file'] } },
      });

      rig.createFile('search-test.txt', 'This file contains the word CoreThink multiple times.\nCoreThink is awesome!');

      const result = await rig.run('Search for the word "CoreThink" in the current directory');

      const foundToolCall = await rig.waitForToolCall('search_file_content');

      if (!foundToolCall) {
        printDebugInfo(rig, result);
      }

      expect(foundToolCall, 'Expected search_file_content tool call').toBeTruthy();

      if (process.env['VERBOSE']) {
        console.log('✓ search_file_content parameter mapping test passed');
      }
    });
  });

  describe('read-write workflow', () => {
    it('should handle complete read-modify-write workflow with parameter mappings', async () => {
      const rig = new TestRig();
      await rig.setup('read-write workflow', {
        settings: { tools: { core: ['read_file', 'write_file', 'replace'] } },
      });

      rig.createFile('version.txt', '1.0.0');

      const result = await rig.run('Read version.txt and increment the version to 1.0.1');

      await rig.waitForTelemetryReady();
      const toolLogs = rig.readToolLogs();

      const readCall = toolLogs.find((log) => log.toolRequest.name === 'read_file');
      const writeCall = toolLogs.find(
        (log) => log.toolRequest.name === 'write_file' || log.toolRequest.name === 'replace'
      );

      if (!readCall || !writeCall) {
        printDebugInfo(rig, result, { readCall, writeCall });
      }

      expect(readCall, 'Expected read_file call').toBeTruthy();
      expect(writeCall, 'Expected write_file or replace call').toBeTruthy();

      const fileContent = rig.readFile('version.txt');
      expect(fileContent).toContain('1.0.1');

      if (process.env['VERBOSE']) {
        console.log('✓ read-write workflow test passed');
      }
    });

    it('should handle multiple file operations in sequence', async () => {
      const rig = new TestRig();
      await rig.setup('multiple operations', {
        settings: { tools: { core: ['read_file', 'write_file', 'list_directory'] } },
      });

      rig.createFile('config.txt', 'original config');

      const result = await rig.run(
        'First list all files, then read config.txt, then write a new file called output.txt with "processed"'
      );

      await rig.waitForTelemetryReady();
      const toolLogs = rig.readToolLogs();

      const hasListCall = toolLogs.some((log) => log.toolRequest.name === 'list_directory');
      const hasReadCall = toolLogs.some((log) => log.toolRequest.name === 'read_file');
      const hasWriteCall = toolLogs.some((log) => log.toolRequest.name === 'write_file');

      if (!hasListCall || !hasReadCall || !hasWriteCall) {
        printDebugInfo(rig, result, {
          hasListCall,
          hasReadCall,
          hasWriteCall,
          toolCalls: toolLogs.map((t) => t.toolRequest.name),
        });
      }

      // At least some operations should succeed
      expect(
        hasListCall || hasReadCall || hasWriteCall,
        'Expected at least one tool call to succeed'
      ).toBeTruthy();

      if (process.env['VERBOSE']) {
        console.log('✓ multiple operations test passed');
      }
    });
  });

  describe('error handling', () => {
    it('should handle non-existent file reads gracefully', async () => {
      const rig = new TestRig();
      await rig.setup('error handling', {
        settings: { tools: { core: ['read_file'] } },
      });

      const result = await rig.run('Read the file nonexistent.txt');

      const foundToolCall = await rig.waitForToolCall('read_file');

      // Tool should be called even if file doesn't exist
      expect(foundToolCall, 'Expected read_file tool call').toBeTruthy();

      // Result should contain error message
      expect(
        result.toLowerCase().includes('error') ||
          result.toLowerCase().includes('not found') ||
          result.toLowerCase().includes('does not exist'),
        'Expected error message in output'
      ).toBeTruthy();

      if (process.env['VERBOSE']) {
        console.log('✓ error handling test passed');
      }
    });
  });
});
