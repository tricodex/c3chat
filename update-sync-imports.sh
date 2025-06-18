#!/bin/bash

# Script to update all sync engine imports to use the switcher

echo "Updating sync engine imports to use sync-engine-switcher..."

# List of files to update (excluding test files and the switcher itself)
files=(
  "src/components/ChatView.tsx"
  "src/components/MessageList.tsx"
  "src/components/IsolatedChatView.tsx"
  "src/components/MessageActions.tsx"
  "src/components/MessageEdit.tsx"
  "src/components/Header.tsx"
  "src/components/CommandPalette.tsx"
  "src/components/Sidebar.tsx"
  "src/components/AgentSelector.tsx"
  "src/components/ThreadList.tsx"
)

for file in "${files[@]}"; do
  if [ -f "$file" ]; then
    echo "Updating $file..."
    # Replace various import patterns
    sed -i '' 's|from ["'\'']@/lib/corrected-sync-engine["'\'']|from "@/lib/sync-engine-switcher"|g' "$file"
    sed -i '' 's|from ["'\'']../lib/corrected-sync-engine["'\'']|from "../lib/sync-engine-switcher"|g' "$file"
    sed -i '' 's|from ["'\'']../../lib/corrected-sync-engine["'\'']|from "../../lib/sync-engine-switcher"|g' "$file"
    sed -i '' 's|from ["'\'']./lib/corrected-sync-engine\.tsx["'\'']|from "./lib/sync-engine-switcher"|g' "$file"
  fi
done

echo "Done! All imports updated."