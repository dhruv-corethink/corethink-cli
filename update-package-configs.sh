#!/bin/bash
set -e

echo "📦 Updating package.json files..."

# Update root package.json
jq '.name = "corethink-cli" | 
    .version = "1.0.1" | 
    .description = "CoreThink CLI - AI-powered command-line assistant with advanced code editing capabilities" |
    .private = false | 
    .repository.url = "git+https://github.com/dhruv-corethink/corethink-cli.git" |
    .publishConfig = {"access": "public"} |
    .bin = {"corethink": "bundle/corethink.js"} |
    .scripts."start:a2a-server" = "CODER_AGENT_PORT=41242 npm run start --workspace corethink-cli-a2a-server" |
    .scripts."predocs:settings" = "npm run build --workspace corethink-cli-core"' \
    package.json > package.json.tmp && mv package.json.tmp package.json

# Update CLI package.json
jq '.name = "corethink-cli" |
    .version = "1.0.1" |
    .description = "CoreThink CLI - AI-powered command-line assistant" |
    .repository.url = "git+https://github.com/dhruv-corethink/corethink-cli.git" |
    .bin = {"corethink": "dist/index.js"} |
    .dependencies."corethink-cli-core" = .dependencies."@google/gemini-cli-core" |
    del(.dependencies."@google/gemini-cli-core") |
    .devDependencies."corethink-cli-test-utils" = .devDependencies."@google/gemini-cli-test-utils" |
    del(.devDependencies."@google/gemini-cli-test-utils")' \
    packages/cli/package.json > packages/cli/package.json.tmp && mv packages/cli/package.json.tmp packages/cli/package.json

# Update Core package.json  
jq '.name = "corethink-cli-core" |
    .version = "1.0.1" |
    .description = "CoreThink CLI Core Library" |
    .repository.url = "git+https://github.com/dhruv-corethink/corethink-cli.git" |
    .devDependencies."corethink-cli-test-utils" = .devDependencies."@google/gemini-cli-test-utils" |
    del(.devDependencies."@google/gemini-cli-test-utils")' \
    packages/core/package.json > packages/core/package.json.tmp && mv packages/core/package.json.tmp packages/core/package.json

# Update A2A Server package.json
jq '.name = "corethink-cli-a2a-server" |
    .version = "1.0.1" |
    .description = "CoreThink CLI A2A Server" |
    .repository.url = "git+https://github.com/dhruv-corethink/corethink-cli.git" |
    .bin = {"corethink-cli-a2a-server": "dist/a2a-server.mjs"} |
    .dependencies."corethink-cli-core" = .dependencies."@google/gemini-cli-core" |
    del(.dependencies."@google/gemini-cli-core")' \
    packages/a2a-server/package.json > packages/a2a-server/package.json.tmp && mv packages/a2a-server/package.json.tmp packages/a2a-server/package.json

# Update Test Utils package.json
jq '.name = "corethink-cli-test-utils" |
    .version = "1.0.1"' \
    packages/test-utils/package.json > packages/test-utils/package.json.tmp && mv packages/test-utils/package.json.tmp packages/test-utils/package.json

echo "✅ Package configs updated!"
