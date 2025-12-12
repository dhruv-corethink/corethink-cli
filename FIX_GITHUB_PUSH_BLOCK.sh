#!/bin/bash
# Fix GitHub push protection block

echo "Fixing GitHub push protection..."

# Option 1: Remove Google OAuth (if not needed)
echo ""
echo "Option 1: Remove Google OAuth integration"
echo "==========================================="
echo ""
echo "If you're NOT using Google authentication, run:"
echo ""
echo "git rm packages/core/src/code_assist/oauth2.ts"
echo "git rm packages/core/dist/src/code_assist/oauth2.js"
echo "git commit -m 'Remove Google OAuth (not needed for CoreThink)'"
echo "git push -u origin main"
echo ""

# Option 2: Allow the secrets
echo "Option 2: Allow the secrets (quickest)"
echo "======================================="
echo ""
echo "These are Google's public OAuth credentials (safe to commit)."
echo ""
echo "1. Open this URL:"
echo "   https://github.com/dhruv-corethink/corethink-cli/security/secret-scanning/unblock-secret/36khx9POP1ijjLaE9WCDxBcdrYv"
echo ""
echo "2. Click 'Allow secret' or 'Allow this secret'"
echo ""
echo "3. Open this URL:"
echo "   https://github.com/dhruv-corethink/corethink-cli/security/secret-scanning/unblock-secret/36khxB5sWAkXKsn3TZwSb4h2Lgh"
echo ""
echo "4. Click 'Allow secret' again"
echo ""
echo "5. Push again:"
echo "   git push -u origin main"
echo ""

# Option 3: Use environment variables
echo "Option 3: Use environment variables (cleanest)"
echo "==============================================="
echo ""
echo "This requires code changes - see FIX_OAUTH_SECRETS.md"
echo ""
