/**
 * CoreThink Content Generator
 *
 * This module provides a ContentGenerator implementation that connects to
 * the CoreThink API backend instead of Google's Gemini API.
 *
 * POC Implementation - Minimal changes to get it working.
 */

import type {
  GenerateContentResponse,
  GenerateContentParameters,
  CountTokensResponse,
  CountTokensParameters,
  EmbedContentResponse,
  EmbedContentParameters,
  Content,
  Part,
  FunctionCall,
} from '@google/genai';
import { FinishReason } from '@google/genai';
import type { ContentGenerator } from './contentGenerator.js';
import * as fs from 'fs';

// Debug logging to file
function debugLog(message: string) {
  if (process.env['CORETHINK_DEBUG']) {
    const timestamp = new Date().toISOString();
    fs.appendFileSync('/tmp/corethink-debug.log', `[${timestamp}] ${message}\n`);
  }
}

// CoreThink API Configuration
const CORETHINK_API_URL = process.env['CORETHINK_API_URL'] || 'https://api.corethink.ai/v1/code';
const CORETHINK_API_KEY = process.env['CORETHINK_API_KEY'] || '';

// Track tool call IDs for correlating responses
// Maps function name to the most recent tool call ID
const toolCallIdMap = new Map<string, string>();

// OpenAI-compatible message format (used by CoreThink API)
interface OpenAIMessage {
  role: 'user' | 'assistant' | 'system' | 'tool' | 'function';
  content?: string | null;
  name?: string;
  tool_calls?: OpenAIToolCall[];
  tool_call_id?: string;
  function_call?: Record<string, unknown>;
}

interface OpenAIToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
}

interface OpenAITool {
  type: 'function';
  function: {
    name: string;
    description?: string;
    parameters?: Record<string, unknown>;
  };
}

// CoreThink API Request format
interface CoreThinkRequest {
  model?: string;
  messages: OpenAIMessage[];
  stream?: boolean;
  temperature?: number;
  max_tokens?: number;
  tools?: OpenAITool[];
  tool_choice?: string | Record<string, unknown>;
}

// CoreThink SSE Event format (OpenAI-compatible streaming)
interface CoreThinkStreamEvent {
  id?: string;
  object?: string;
  model?: string;
  choices?: Array<{
    index: number;
    delta: {
      role?: string;
      content?: string | null;
      reasoning?: string | null;  // CoreThink sends content here!
      tool_calls?: OpenAIToolCall[];
    };
    finish_reason?: string | null;
  }>;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  };
  // Legacy format support
  status?: string;
  content?: string;
  delta?: {
    content?: string;
    reasoning?: string;  // CoreThink sends content here!
    tool_calls?: OpenAIToolCall[];
  };
  response?: {
    model?: string;
    usage?: {
      prompt_tokens?: number;
      completion_tokens?: number;
      total_tokens?: number;
    };
  };
  tool_calls?: OpenAIToolCall[];
  finish_reason?: string;
  error?: string;
}

// CoreThink non-streaming response format (OpenAI-compatible)
interface CoreThinkResponse {
  id: string;
  model: string;
  choices: Array<{
    index: number;
    message: {
      role: string;
      content: string;
      tool_calls?: OpenAIToolCall[];
    };
    finish_reason: string;
  }>;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

/**
 * Ensure contents is an array of Content objects
 */
function ensureContentArray(contents: GenerateContentParameters['contents']): Content[] {
  if (!contents) {
    return [];
  }
  if (typeof contents === 'string') {
    return [{ role: 'user', parts: [{ text: contents }] }];
  }
  if (Array.isArray(contents)) {
    return contents as Content[];
  }
  return [contents as Content];
}

/**
 * Convert Gemini Content[] to OpenAI messages format
 * @internal Exported for testing
 */
export function convertToOpenAIMessages(contents: Content[]): OpenAIMessage[] {
  const messages: OpenAIMessage[] = [];
  // Track synthetic IDs for historical tool calls within this conversion
  const historicalToolCallIds = new Map<string, string>();
  // Track tool call IDs in order for multiple calls to same function
  let recentToolCallIds: string[] = [];

  for (const content of contents) {
    const role = content.role === 'model' ? 'assistant' : content.role as OpenAIMessage['role'];

    if (!content.parts || content.parts.length === 0) {
      continue;
    }

    // Check if this is a function response (tool result)
    // Handle multiple function responses in order
    const functionResponseParts = content.parts.filter(p => p.functionResponse);
    if (functionResponseParts.length > 0) {
      functionResponseParts.forEach((part, idx) => {
        const funcName = part.functionResponse!.name || 'unknown';
        // Look up the tool call ID in order of preference:
        // 1. Use the recent tool call ID by position (for multiple same-function calls)
        // 2. Historical synthetic ID (from this conversion)
        // 3. Stored ID from streaming response (toolCallIdMap)
        // 4. Function name as last resort
        const toolCallId =
          recentToolCallIds[idx] ||
          historicalToolCallIds.get(funcName) ||
          toolCallIdMap.get(funcName) ||
          funcName;

        // Skip orphaned tool responses (no corresponding tool call)
        if (
          !recentToolCallIds[idx] &&
          !historicalToolCallIds.has(funcName) &&
          !toolCallIdMap.has(funcName)
        ) {
          debugLog(`Skipping orphaned function response for ${funcName}`);
          return;
        }

        debugLog(`Function response for ${funcName}, using tool_call_id: ${toolCallId}`);
        messages.push({
          role: 'tool',
          tool_call_id: toolCallId,
          content: JSON.stringify(part.functionResponse!.response),
        });
      });
      // Clear recent tool calls after processing responses
      recentToolCallIds = [];
      continue;
    }

    // Check if this contains function calls
    const functionCallParts = content.parts.filter(p => p.functionCall);
    if (functionCallParts.length > 0) {
      const toolCalls: OpenAIToolCall[] = functionCallParts.map((p, idx) => {
        const syntheticId = `call_${idx}`;
        const funcName = p.functionCall!.name || '';
        // Store the synthetic ID so tool responses can reference it
        historicalToolCallIds.set(funcName, syntheticId);
        // Also store in order for multiple calls to same function
        recentToolCallIds.push(syntheticId);
        return {
          id: syntheticId,
          type: 'function' as const,
          function: {
            name: funcName,
            arguments: JSON.stringify(p.functionCall!.args || {}),
          },
        };
      });

      // Get any text content
      const textContent = content.parts
        .filter(p => p.text)
        .map(p => p.text)
        .join('');

      messages.push({
        role: 'assistant',
        content: textContent || null,
        tool_calls: toolCalls,
      });
      continue;
    }

    // Regular text message
    const textContent = content.parts
      .filter(p => p.text)
      .map(p => p.text)
      .join('');

    if (textContent) {
      messages.push({
        role,
        content: textContent,
      });
    }
  }

  return messages;
}

/**
 * Convert Gemini tools to OpenAI format
 */
function convertToOpenAITools(config: GenerateContentParameters['config']): OpenAITool[] | undefined {
  const typedConfig = config as { tools?: Array<{ functionDeclarations?: Array<{
    name: string;
    description?: string;
    parameters?: Record<string, unknown>;
  }> }> } | undefined;

  if (!typedConfig?.tools || !Array.isArray(typedConfig.tools)) {
    return undefined;
  }

  const openAITools: OpenAITool[] = [];

  for (const tool of typedConfig.tools) {
    if (tool.functionDeclarations) {
      for (const fn of tool.functionDeclarations) {
        openAITools.push({
          type: 'function',
          function: {
            name: fn.name,
            description: fn.description,
            parameters: fn.parameters,
          },
        });
      }
    }
  }

  return openAITools.length > 0 ? openAITools : undefined;
}

/**
 * Map common parameter name variations to expected names
 * CoreThink's model sometimes uses different parameter names
 */
function mapToolCallArguments(functionName: string, args: Record<string, unknown>): Record<string, unknown> {
  // Parameter name mappings for different tools
  const mappings: Record<string, Record<string, string>> = {
    'list_directory': { 'path': 'dir_path' },
    'read_file': { 'path': 'file_path' },
    'search_file_content': { 'path': 'file_path' },
    'glob': { 'path': 'pattern' },
    // delegate_to_agent mappings - CoreThink uses different parameter names
    'delegate_to_agent': {
      'agent': 'agent_name',
      'prompt': 'objective',
      'task': 'objective',
      'description': 'objective',
      'query': 'objective',
    },
    // complete_task mappings - CoreThink might use different parameter names for the output
    'complete_task': {
      'result': 'report',
      'output': 'report',
      'answer': 'report',
      'response': 'report',
      'findings': 'report',
      'summary': 'report',
    },
  };

  const toolMappings = mappings[functionName];
  if (!toolMappings) {
    return args;
  }

  const mappedArgs = { ...args };
  for (const [from, to] of Object.entries(toolMappings)) {
    if (from in mappedArgs && !(to in mappedArgs)) {
      mappedArgs[to] = mappedArgs[from];
      delete mappedArgs[from];
    }
  }

  // Special handling for delegate_to_agent: default to codebase_investigator if agent_name is missing
  if (functionName === 'delegate_to_agent' && !mappedArgs['agent_name']) {
    mappedArgs['agent_name'] = 'codebase_investigator';
    debugLog(`delegate_to_agent: defaulting agent_name to 'codebase_investigator'`);
  }

  return mappedArgs;
}

/**
 * Merge streaming tool call chunks into a single accumulated array.
 * OpenAI streaming sends tool calls in chunks by index - each chunk only contains
 * partial arguments that need to be concatenated.
 */
function mergeToolCallChunks(
  accumulated: OpenAIToolCall[],
  newChunks: Array<{ index?: number; id?: string; type?: string; function?: { name?: string; arguments?: string } }>,
): OpenAIToolCall[] {
  for (const chunk of newChunks) {
    const index = chunk.index ?? 0;

    // Extend the array if needed
    while (accumulated.length <= index) {
      accumulated.push({
        id: '',
        type: 'function',
        function: { name: '', arguments: '' },
      });
    }

    // Merge the chunk into the accumulated tool call at this index
    if (chunk.id) {
      accumulated[index].id = chunk.id;
    }
    if (chunk.type) {
      accumulated[index].type = chunk.type as 'function';
    }
    if (chunk.function?.name) {
      accumulated[index].function.name = chunk.function.name;
    }
    if (chunk.function?.arguments) {
      // Concatenate arguments - they come in chunks
      accumulated[index].function.arguments += chunk.function.arguments;
    }

    debugLog(`Merged tool call chunk at index ${index}: id=${accumulated[index].id}, name=${accumulated[index].function.name}, args length=${accumulated[index].function.arguments.length}`);
  }

  return accumulated;
}

/**
 * Coerce string numbers to actual numbers for parameters that expect numbers
 * CoreThink sometimes sends "215" instead of 215
 * Also parse JSON strings that should be arrays/objects
 */
function coerceArgumentTypes(args: Record<string, unknown>): Record<string, unknown> {
  const numericParams = ['offset', 'limit', 'line', 'start_line', 'end_line', 'max_results', 'depth'];
  const coercedArgs = { ...args };

  debugLog(`coerceArgumentTypes input keys: ${Object.keys(args).join(', ')}`);

  // Coerce string numbers to actual numbers
  for (const param of numericParams) {
    if (param in coercedArgs && typeof coercedArgs[param] === 'string') {
      const numValue = Number(coercedArgs[param]);
      if (!isNaN(numValue)) {
        debugLog(`Coercing ${param} from string "${coercedArgs[param]}" to number ${numValue}`);
        coercedArgs[param] = numValue;
      }
    }
  }

  // Try to parse any string value that looks like JSON array/object
  for (const [key, value] of Object.entries(coercedArgs)) {
    if (typeof value === 'string') {
      const trimmed = value.trim();
      debugLog(`Checking ${key}: type=${typeof value}, starts with: ${trimmed.substring(0, 20)}`);

      if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
        try {
          const parsed = JSON.parse(trimmed);
          debugLog(`Successfully parsed ${key} as ${Array.isArray(parsed) ? 'array' : 'object'}`);
          coercedArgs[key] = parsed;
        } catch (e) {
          debugLog(`Failed to parse ${key} as JSON: ${e instanceof Error ? e.message : 'unknown error'}`);
          // Try to fix common JSON issues (truncated, escaped)
          try {
            // Sometimes the model double-escapes JSON
            const unescaped = trimmed.replace(/\\"/g, '"').replace(/\\\\/g, '\\');
            const parsed = JSON.parse(unescaped);
            debugLog(`Successfully parsed ${key} after unescaping`);
            coercedArgs[key] = parsed;
          } catch {
            debugLog(`Still failed to parse ${key} after unescaping`);
          }
        }
      }
    }
  }

  return coercedArgs;
}

/**
 * Convert OpenAI tool calls to Gemini FunctionCall parts
 * Also stores the tool call IDs for later correlation with responses
 */
function convertToolCallsToGeminiParts(toolCalls: OpenAIToolCall[]): Part[] {
  return toolCalls.map(tc => {
    // Store the tool call ID for later use when sending responses
    if (tc.id && tc.function.name) {
      toolCallIdMap.set(tc.function.name, tc.id);
      debugLog(`Stored tool call ID: ${tc.function.name} -> ${tc.id}`);
    }

    debugLog(`Tool call raw arguments string: ${tc.function.arguments}`);
    let rawArgs: Record<string, unknown>;
    try {
      rawArgs = JSON.parse(tc.function.arguments || '{}');
    } catch (e) {
      debugLog(`Failed to parse tool arguments: ${e instanceof Error ? e.message : 'unknown'}`);
      rawArgs = {};
    }
    debugLog(`Tool call: ${tc.function.name}, raw args: ${JSON.stringify(rawArgs)}`);
    const mappedArgs = mapToolCallArguments(tc.function.name, rawArgs);
    const coercedArgs = coerceArgumentTypes(mappedArgs);
    debugLog(`Tool call: ${tc.function.name}, final args: ${JSON.stringify(coercedArgs)}`);
    return {
      functionCall: {
        name: tc.function.name,
        args: coercedArgs,
      } as FunctionCall,
    };
  });
}

/**
 * Convert finish reason from OpenAI format to Gemini format
 */
function convertFinishReason(reason?: string): FinishReason {
  switch (reason) {
    case 'stop':
      return FinishReason.STOP;
    case 'length':
      return FinishReason.MAX_TOKENS;
    case 'tool_calls':
    case 'function_call':
      return FinishReason.STOP; // Gemini uses STOP for tool calls too
    case 'content_filter':
      return FinishReason.SAFETY;
    default:
      return FinishReason.STOP;
  }
}

/**
 * Create a minimal GenerateContentResponse that satisfies the interface
 */
function createGeminiResponse(
  text: string,
  finishReason: FinishReason,
  usageMetadata?: {
    promptTokenCount?: number;
    candidatesTokenCount?: number;
    totalTokenCount?: number;
  },
  parts?: Part[],
): GenerateContentResponse {
  const responseParts = parts || [{ text }];
  const responseText = text;

  // Extract function calls from parts
  const functionCallsFromParts = responseParts
    .filter(p => p.functionCall)
    .map(p => p.functionCall as FunctionCall);

  // Create a response object that matches the expected shape
  // Use type assertion to satisfy TypeScript
  return {
    candidates: [{
      content: {
        role: 'model',
        parts: responseParts,
      },
      finishReason,
      index: 0,
    }],
    usageMetadata,
    // Add required getter properties
    get text() { return responseText; },
    get data() { return undefined; },
    get functionCalls() {
      return functionCallsFromParts.length > 0 ? functionCallsFromParts : undefined;
    },
    get executableCode() { return undefined; },
    get codeExecutionResult() { return undefined; },
  } as GenerateContentResponse;
}

/**
 * CoreThink Content Generator
 *
 * Implements the ContentGenerator interface to work with the CoreThink API.
 */
export class CoreThinkContentGenerator implements ContentGenerator {
  private apiUrl: string;
  private apiKey: string;

  constructor(apiUrl?: string, apiKey?: string) {
    this.apiUrl = apiUrl || CORETHINK_API_URL;
    this.apiKey = apiKey || CORETHINK_API_KEY;

    if (!this.apiKey) {
      console.warn('Warning: CORETHINK_API_KEY not set. API calls will fail.');
    }
  }

  /**
   * Generate content (non-streaming)
   */
  async generateContent(
    request: GenerateContentParameters,
    _userPromptId: string,
  ): Promise<GenerateContentResponse> {
    const contentArray = ensureContentArray(request.contents);
    const openAIMessages = convertToOpenAIMessages(contentArray);
    const openAITools = convertToOpenAITools(request.config);

    const coreThinkRequest: CoreThinkRequest = {
      model: request.model || 'corethink',
      messages: openAIMessages,
      stream: false,
      temperature: request.config?.temperature,
      max_tokens: request.config?.maxOutputTokens,
      tools: openAITools,
    };

    // Add system instruction if present
    if (request.config?.systemInstruction) {
      const systemText = typeof request.config.systemInstruction === 'string'
        ? request.config.systemInstruction
        : (request.config.systemInstruction as { text?: string }).text || '';

      if (systemText) {
        coreThinkRequest.messages.unshift({
          role: 'system',
          content: systemText,
        });
      }
    }

    const response = await fetch(`${this.apiUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify(coreThinkRequest),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`CoreThink API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json() as CoreThinkResponse;

    // Get the first choice (OpenAI format)
    const choice = data.choices?.[0];
    if (!choice) {
      throw new Error('No response from CoreThink API');
    }

    // Handle tool calls if present
    const parts: Part[] = [];
    if (choice.message.content) {
      parts.push({ text: choice.message.content });
    }
    if (choice.message.tool_calls && choice.message.tool_calls.length > 0) {
      parts.push(...convertToolCallsToGeminiParts(choice.message.tool_calls));
    }

    return createGeminiResponse(
      choice.message.content || '',
      convertFinishReason(choice.finish_reason),
      {
        promptTokenCount: data.usage?.prompt_tokens,
        candidatesTokenCount: data.usage?.completion_tokens,
        totalTokenCount: data.usage?.total_tokens,
      },
      parts.length > 0 ? parts : undefined,
    );
  }

  /**
   * Generate content with streaming
   */
  async generateContentStream(
    request: GenerateContentParameters,
    _userPromptId: string,
  ): Promise<AsyncGenerator<GenerateContentResponse>> {
    debugLog(`=== generateContentStream called ===`);
    debugLog(`userPromptId: ${_userPromptId}`);
    const contentArray = ensureContentArray(request.contents);
    const openAIMessages = convertToOpenAIMessages(contentArray);
    debugLog(`Messages count: ${openAIMessages.length}`);
    const openAITools = convertToOpenAITools(request.config);
    debugLog(`Tools count: ${openAITools?.length || 0}`);
    if (openAITools && openAITools.length > 0) {
      debugLog(`Tool names: ${openAITools.map(t => t.function.name).join(', ')}`);
    }

    const coreThinkRequest: CoreThinkRequest = {
      model: request.model || 'corethink',
      messages: openAIMessages,
      stream: true,
      temperature: request.config?.temperature,
      max_tokens: request.config?.maxOutputTokens,
      tools: openAITools,
    };

    // Add system instruction if present
    if (request.config?.systemInstruction) {
      const systemText = typeof request.config.systemInstruction === 'string'
        ? request.config.systemInstruction
        : (request.config.systemInstruction as { text?: string }).text || '';

      if (systemText) {
        coreThinkRequest.messages.unshift({
          role: 'system',
          content: systemText,
        });
      }
    }

    const self = this;

    async function* streamGenerator(): AsyncGenerator<GenerateContentResponse> {
      const response = await fetch(`${self.apiUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${self.apiKey}`,
          'Accept': 'text/event-stream',
        },
        body: JSON.stringify(coreThinkRequest),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`CoreThink API error: ${response.status} - ${errorText}`);
      }

      if (!response.body) {
        throw new Error('No response body');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let accumulatedText = '';
      let accumulatedToolCalls: OpenAIToolCall[] = [];
      let lastUsageMetadata: {
        promptTokenCount?: number;
        candidatesTokenCount?: number;
        totalTokenCount?: number;
      } | undefined;
      try {
        debugLog('Starting stream processing');
        while (true) {
          debugLog('Waiting for next chunk...');
          const { done, value } = await reader.read();
          debugLog(`Got chunk, done: ${done}, bytes: ${value?.length}`);

          if (done) {
            debugLog('Stream ended (done=true)');
            break;
          }

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            const trimmedLine = line.trim();

            // Skip empty lines
            if (!trimmedLine) {
              continue;
            }

            debugLog(`Raw line: ${trimmedLine.substring(0, 100)}`);

            if (!trimmedLine.startsWith('data:')) {
              continue;
            }

            const data = trimmedLine.slice(5).trim();
            debugLog(`Parsed data: ${data.substring(0, 200)}`);

            if (data === '[DONE]') {
              // Yield final response with accumulated content
              if (accumulatedText || accumulatedToolCalls.length > 0) {
                const parts: Part[] = [];
                if (accumulatedText) {
                  parts.push({ text: accumulatedText });
                }
                if (accumulatedToolCalls.length > 0) {
                  parts.push(...convertToolCallsToGeminiParts(accumulatedToolCalls));
                }

                yield createGeminiResponse(
                  accumulatedText,
                  FinishReason.STOP,
                  lastUsageMetadata,
                  parts,
                );
              }
              return;
            }

            try {
              const event = JSON.parse(data) as CoreThinkStreamEvent;

              // Handle error events
              if (event.status === 'error') {
                throw new Error(event.error || 'Unknown streaming error');
              }

              // NOTE: Do NOT deduplicate by event.id - CoreThink uses the same ID
              // for all chunks in a generation session. Each chunk is unique.

              // OpenAI format: choices[0].delta.content or choices[0].delta.reasoning
              const choice = event.choices?.[0];
              if (choice) {
                // Track usage metadata
                if (event.usage) {
                  lastUsageMetadata = {
                    promptTokenCount: event.usage.prompt_tokens,
                    candidatesTokenCount: event.usage.completion_tokens,
                    totalTokenCount: event.usage.total_tokens,
                  };
                }

                // CoreThink uses 'reasoning' field instead of 'content' for streaming
                // Check both fields - use content if available, otherwise use reasoning
                const deltaContent = choice.delta?.content || choice.delta?.reasoning || '';

                // Accumulate and yield text content
                if (deltaContent) {
                  accumulatedText += deltaContent;
                  debugLog(`Yielding delta content: ${deltaContent.substring(0, 50)}`);
                  // Yield only the delta chunk, not accumulated text
                  yield createGeminiResponse(deltaContent, FinishReason.STOP);
                }

                // Accumulate tool calls from OpenAI format - must merge by index
                if (choice.delta?.tool_calls) {
                  debugLog(`Got tool_calls chunk: ${JSON.stringify(choice.delta.tool_calls)}`);
                  mergeToolCallChunks(accumulatedToolCalls, choice.delta.tool_calls);
                }

                // If we got a finish reason, we're done
                // Only yield final response if there are tool calls to report
                // (text was already yielded incrementally)
                if (choice.finish_reason && choice.finish_reason !== null) {
                  debugLog(`Got finish_reason: ${choice.finish_reason}, accumulated tool calls: ${accumulatedToolCalls.length}`);
                  // Yield final response with tool calls if we have them
                  if (accumulatedToolCalls.length > 0) {
                    const parts: Part[] = [];
                    if (accumulatedText) {
                      parts.push({ text: accumulatedText });
                    }
                    const toolParts = convertToolCallsToGeminiParts(accumulatedToolCalls);
                    debugLog(`Converting ${accumulatedToolCalls.length} tool calls to ${toolParts.length} parts`);
                    parts.push(...toolParts);
                    debugLog(`Yielding final response with ${parts.length} parts`);
                    yield createGeminiResponse(
                      accumulatedText,
                      convertFinishReason(choice.finish_reason),
                      lastUsageMetadata,
                      parts,
                    );
                  }
                  // NOTE: Don't yield final text response here - text was already yielded incrementally
                  // at line 632. Yielding again would cause duplicate output.
                  return; // Stop processing after finish_reason
                }
              } else {
                // Legacy format support
                if (event.content) {
                  accumulatedText += event.content;
                }
                if (event.delta?.content) {
                  accumulatedText += event.delta.content;
                }
                if (event.tool_calls) {
                  mergeToolCallChunks(accumulatedToolCalls, event.tool_calls);
                }
                if (event.delta?.tool_calls) {
                  mergeToolCallChunks(accumulatedToolCalls, event.delta.tool_calls);
                }
                if (event.response?.usage) {
                  lastUsageMetadata = {
                    promptTokenCount: event.response.usage.prompt_tokens,
                    candidatesTokenCount: event.response.usage.completion_tokens,
                    totalTokenCount: event.response.usage.total_tokens,
                  };
                }
                if (event.content || event.delta?.content) {
                  const chunkText = event.content || event.delta?.content || '';
                  yield createGeminiResponse(chunkText, FinishReason.STOP);
                }
                if (event.finish_reason) {
                  const parts: Part[] = [];
                  if (accumulatedText) {
                    parts.push({ text: accumulatedText });
                  }
                  if (accumulatedToolCalls.length > 0) {
                    parts.push(...convertToolCallsToGeminiParts(accumulatedToolCalls));
                  }
                  if (parts.length > 0) {
                    yield createGeminiResponse(
                      accumulatedText,
                      convertFinishReason(event.finish_reason),
                      lastUsageMetadata,
                      parts,
                    );
                  }
                }
              }
            } catch (parseError) {
              // Skip malformed JSON
              console.warn('Failed to parse SSE event:', data);
            }
          }
        }
      } finally {
        reader.releaseLock();
      }
    }

    return streamGenerator();
  }

  /**
   * Count tokens (estimate based on character count)
   */
  async countTokens(request: CountTokensParameters): Promise<CountTokensResponse> {
    // Simple estimation: ~4 characters per token
    const contents = request.contents;
    let charCount = 0;

    if (contents) {
      const contentArray = Array.isArray(contents) ? contents : [contents];
      for (const content of contentArray) {
        if (typeof content === 'string') {
          charCount += content.length;
        } else if (content && typeof content === 'object' && 'parts' in content) {
          const typedContent = content as Content;
          if (typedContent.parts) {
            for (const part of typedContent.parts) {
              if (part.text) {
                charCount += part.text.length;
              }
            }
          }
        }
      }
    }

    const estimatedTokens = Math.ceil(charCount / 4);

    return {
      totalTokens: estimatedTokens,
    };
  }

  /**
   * Embed content (not implemented - returns empty embedding)
   */
  async embedContent(_request: EmbedContentParameters): Promise<EmbedContentResponse> {
    // Embeddings not supported in POC
    return {
      embeddings: [{
        values: [],
      }],
    } as EmbedContentResponse;
  }
}

/**
 * Create a CoreThink content generator
 */
export function createCoreThinkContentGenerator(
  apiUrl?: string,
  apiKey?: string,
): ContentGenerator {
  return new CoreThinkContentGenerator(apiUrl, apiKey);
}
