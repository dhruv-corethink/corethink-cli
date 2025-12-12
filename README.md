# CoreThink CLI

[![License](https://img.shields.io/github/license/dhruv-corethink/corethink-cli)](https://github.com/dhruv-corethink/corethink-cli/blob/main/LICENSE)
[![Version](https://img.shields.io/npm/v/corethink-cli)](https://www.npmjs.com/package/corethink-cli)

CoreThink CLI is an AI-powered command-line assistant that brings advanced AI
capabilities directly into your terminal. Built on the foundation of Google's
Gemini CLI, CoreThink CLI provides developers with powerful code understanding,
generation, and automation features.

## 🚀 Why CoreThink CLI?

- **🧠 Powerful AI Models**: Access to advanced language models with large
  context windows
- **🔧 Built-in Tools**: File operations, shell commands, web fetching, and more
- **🔌 Extensible**: MCP (Model Context Protocol) support for custom
  integrations
- **💻 Terminal-first**: Designed for developers who live in the command line
- **🛡️ Open source**: Apache 2.0 licensed

## 📦 Installation

### Pre-requisites

- Node.js version 20 or higher
- macOS, Linux, or Windows

### Quick Install

#### Install globally with npm

```bash
npm install -g corethink-cli
```

#### Run instantly with npx

```bash
npx corethink-cli
```

## 🎯 Getting Started

After installation, simply run:

```bash
corethink
```

This launches the interactive CLI where you can:

- Ask questions and get AI-powered answers
- Edit code across multiple files
- Run shell commands with AI assistance
- Analyze and understand codebases
- Generate new code from descriptions

### Quick Examples

```bash
# Interactive mode
corethink

# One-shot query
corethink "explain the main function in app.js"

# YOLO mode (auto-approve all actions)
corethink -y "refactor this code to use async/await"
```

## 📋 Key Features

### Code Understanding & Generation

- Query and edit large codebases
- Generate new apps from descriptions, PDFs, images, or sketches
- Debug issues and troubleshoot with natural language
- Refactor code with AI-guided suggestions

### Automation & Integration

- Execute shell commands safely with approval workflows
- Integrate with MCP servers for extended functionality
- Chain multiple operations together
- Custom extensions support

### Smart Context Management

- Automatic context gathering from your workspace
- File tree analysis and navigation
- Git integration for version control awareness
- Multi-file editing with conflict resolution

## 🔧 Configuration

CoreThink CLI stores its configuration in:

- `~/.config/corethink/` (Linux/macOS)
- `%APPDATA%\corethink\` (Windows)

Configuration includes:

- API keys and authentication
- Model preferences
- Extension settings
- Tool approval policies

## 🛠️ Advanced Usage

### Approval Modes

```bash
# Default: prompt for approval
corethink

# Auto-approve edits only
corethink --approval-mode auto_edit

# Auto-approve everything (YOLO mode)
corethink --approval-mode yolo
```

### Sandbox Mode

Run potentially dangerous commands in an isolated sandbox:

```bash
corethink --sandbox
```

### Extensions

Manage extensions to enhance functionality:

```bash
# List installed extensions
corethink extensions list

# Install an extension
corethink extensions install <extension-name>

# Enable/disable extensions
corethink extensions enable <extension-name>
corethink extensions disable <extension-name>
```

### MCP Server Integration

Add MCP servers for additional capabilities:

```bash
# Add an MCP server
corethink mcp add

# List configured MCP servers
corethink mcp list

# Remove an MCP server
corethink mcp remove
```

## 📖 Documentation

For detailed documentation, guides, and examples, visit the original
[Gemini CLI documentation](https://geminicli.com/docs/) (much of which applies
to CoreThink CLI as it's based on the same codebase).

## 🤝 Contributing

CoreThink CLI is based on Google's open-source Gemini CLI. Contributions are
welcome!

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## 📝 License

CoreThink CLI is released under the Apache 2.0 License. See [LICENSE](./LICENSE)
for details.

## 🙏 Acknowledgments

CoreThink CLI is built on the foundation of
[Google's Gemini CLI](https://github.com/google-gemini/gemini-cli), an excellent
open-source project that pioneered terminal-based AI assistance. We're grateful
to the Gemini CLI team and contributors for their outstanding work.

## 🔗 Links

- **NPM Package**: https://www.npmjs.com/package/corethink-cli
- **GitHub Repository**: https://github.com/dhruv-corethink/corethink-cli
- **Issues & Support**: https://github.com/dhruv-corethink/corethink-cli/issues

## ⚡ Quick Tips

- Use `corethink --help` to see all available options
- Press `Ctrl+C` to exit the interactive mode
- Use `/help` within the CLI for in-session help
- Check `~/.config/corethink/logs/` for debugging

---

**Built with ❤️ by the CoreThink team**
