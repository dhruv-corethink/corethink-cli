#!/bin/bash
set -e

echo "🎨 Applying CoreThink rebranding..."

# 1. Update all package names in source files
echo "📝 Updating import statements..."
find packages -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i '' 's/@google\/gemini-cli-test-utils/corethink-cli-test-utils/g' {} +
find packages -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i '' 's/@google\/gemini-cli-core/corethink-cli-core/g' {} +
find packages -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i '' 's/@google\/gemini-cli-a2a-server/corethink-cli-a2a-server/g' {} +
find packages -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i '' 's/@google\/gemini-cli/corethink-cli/g' {} +

echo "✅ Import statements updated!"
echo "🎉 Rebranding complete!"
