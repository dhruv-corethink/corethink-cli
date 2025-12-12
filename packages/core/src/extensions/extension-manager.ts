/**
 * Lightweight Extension Manager for CoreThink CLI
 * Replaces the heavy A2A server with a simple plugin system
 */

export interface Extension {
  name: string;
  version: string;
  description: string;
  commands: ExtensionCommand[];
  hooks?: ExtensionHooks;
}

export interface ExtensionCommand {
  name: string;
  description: string;
  handler: (args: string[]) => Promise<string>;
}

export interface ExtensionHooks {
  beforeChat?: (message: string) => Promise<string>;
  afterChat?: (response: string) => Promise<string>;
  onToolCall?: (tool: string, args: any) => Promise<any>;
}

export class ExtensionManager {
  private extensions = new Map<string, Extension>();
  private loadedExtensions = new Set<string>();

  /**
   * Load an extension from a local file or npm package
   */
  async loadExtension(extensionPath: string): Promise<void> {
    try {
      // Dynamic import of extension
      const extensionModule = await import(extensionPath);
      const extension: Extension = extensionModule.default || extensionModule;
      
      this.registerExtension(extension);
      console.log(`✅ Loaded extension: ${extension.name}`);
    } catch (error) {
      console.error(`❌ Failed to load extension from ${extensionPath}:`, error);
    }
  }

  /**
   * Register an extension instance
   */
  registerExtension(extension: Extension): void {
    this.extensions.set(extension.name, extension);
    this.loadedExtensions.add(extension.name);
  }

  /**
   * Execute an extension command
   */
  async executeCommand(commandName: string, args: string[]): Promise<string> {
    for (const extension of this.extensions.values()) {
      const command = extension.commands.find(cmd => cmd.name === commandName);
      if (command) {
        return await command.handler(args);
      }
    }
    throw new Error(`Command not found: ${commandName}`);
  }

  /**
   * Get all available commands from all extensions
   */
  getAvailableCommands(): Array<{extension: string, command: ExtensionCommand}> {
    const commands: Array<{extension: string, command: ExtensionCommand}> = [];
    
    for (const [name, extension] of this.extensions) {
      for (const command of extension.commands) {
        commands.push({ extension: name, command });
      }
    }
    
    return commands;
  }

  /**
   * Execute hooks for chat events
   */
  async executeHook(hookName: keyof ExtensionHooks, data: any): Promise<any> {
    let result = data;
    
    for (const extension of this.extensions.values()) {
      if (extension.hooks?.[hookName]) {
        result = await extension.hooks[hookName]!(result);
      }
    }
    
    return result;
  }

  /**
   * List all loaded extensions
   */
  listExtensions(): Extension[] {
    return Array.from(this.extensions.values());
  }

  /**
   * Unload an extension
   */
  unloadExtension(name: string): void {
    this.extensions.delete(name);
    this.loadedExtensions.delete(name);
    console.log(`🗑️  Unloaded extension: ${name}`);
  }
}

// Singleton instance
export const extensionManager = new ExtensionManager();