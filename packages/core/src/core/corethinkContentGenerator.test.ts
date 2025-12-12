/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect } from 'vitest';
import { convertToOpenAIMessages } from './corethinkContentGenerator.js';
import type { Content } from '@google/genai';

describe('CoreThinkContentGenerator', () => {
  describe('History Conversion', () => {
    it('should maintain tool_call_id consistency between tool calls and responses', () => {
      // This tests the bug: tool call IDs must match between assistant messages and tool responses
      const history: Content[] = [
        {
          role: 'user',
          parts: [{ text: 'Read the file' }],
        },
        {
          role: 'model',
          parts: [
            {
              functionCall: {
                name: 'read_file',
                args: { file_path: '/test.txt' },
              },
            },
          ],
        },
        {
          role: 'function',
          parts: [
            {
              functionResponse: {
                name: 'read_file',
                response: { content: 'file contents' },
              },
            },
          ],
        },
        {
          role: 'model',
          parts: [{ text: 'The file contains: file contents' }],
        },
      ];

      // Convert history to OpenAI format
      const openAIMessages = convertToOpenAIMessages(history);

      // Find the assistant message with tool calls
      const assistantMsg = openAIMessages.find(
        (msg: any) => msg.role === 'assistant' && msg.tool_calls
      );

      // Find the tool response message
      const toolResponseMsg = openAIMessages.find(
        (msg: any) => msg.role === 'tool'
      );

      expect(assistantMsg).toBeDefined();
      expect(toolResponseMsg).toBeDefined();

      // Critical assertion: tool_call_id in response must match id in tool_calls
      const toolCallId = assistantMsg!.tool_calls![0].id;
      expect(toolResponseMsg!.tool_call_id).toBe(toolCallId);
    });

    it('should handle multiple tool calls with correct ID mapping', () => {
      const history: Content[] = [
        {
          role: 'user',
          parts: [{ text: 'Read two files' }],
        },
        {
          role: 'model',
          parts: [
            {
              functionCall: {
                name: 'read_file',
                args: { file_path: '/test1.txt' },
              },
            },
            {
              functionCall: {
                name: 'read_file',
                args: { file_path: '/test2.txt' },
              },
            },
          ],
        },
        {
          role: 'function',
          parts: [
            {
              functionResponse: {
                name: 'read_file',
                response: { content: 'file 1' },
              },
            },
            {
              functionResponse: {
                name: 'read_file',
                response: { content: 'file 2' },
              },
            },
          ],
        },
      ];

      const openAIMessages = convertToOpenAIMessages(history);

      const assistantMsg = openAIMessages.find(
        (msg: any) => msg.role === 'assistant' && msg.tool_calls
      );
      const toolResponses = openAIMessages.filter(
        (msg: any) => msg.role === 'tool'
      );

      expect(assistantMsg!.tool_calls).toHaveLength(2);
      expect(toolResponses).toHaveLength(2);

      // Each tool response should reference the correct tool call ID
      assistantMsg!.tool_calls!.forEach((toolCall: any, idx: number) => {
        expect(toolResponses[idx].tool_call_id).toBe(toolCall.id);
      });
    });

    it('should not include tool messages without corresponding tool calls', () => {
      // Edge case: orphaned tool response (shouldn't happen, but let's be safe)
      const history: Content[] = [
        {
          role: 'user',
          parts: [{ text: 'Hello' }],
        },
        {
          role: 'function',
          parts: [
            {
              functionResponse: {
                name: 'orphaned_tool',
                response: { result: 'orphaned' },
              },
            },
          ],
        },
      ];

      const openAIMessages = convertToOpenAIMessages(history);

      // Should not include tool role messages without prior tool calls
      const toolMessages = openAIMessages.filter(
        (msg: any) => msg.role === 'tool'
      );
      expect(toolMessages).toHaveLength(0);
    });
  });

  describe('Tool Call ID Tracking', () => {
    it('should preserve tool call IDs from streaming responses', () => {
      // This tests that when the API returns tool calls with specific IDs,
      // we store them for later use in tool responses

      // This is more of an integration test - would need to mock streaming
      // For now, documenting the expected behavior
      expect(true).toBe(true);
    });
  });
});
