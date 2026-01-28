#!/bin/bash

# Fix test imports to use vitest globals

files=(
  "api/__tests__/resume-parse.test.ts"
  "components/__tests__/CandidatePane.test.tsx"
  "services/__tests__/AIService.test.ts"
  "services/__tests__/AutonomousSourcingAgent.test.ts"
  "services/__tests__/BackgroundJobService.test.ts"
  "services/__tests__/InferenceEngine.test.ts"
  "src/test/integration/AutonomousAgentWorkflow.test.ts"
)

for file in "${files[@]}"; do
  echo "Fixing $file..."

  # Replace the import line
  sed -i "1s/.*/\/\/ Using vitest globals: describe, it, expect, beforeEach, afterEach/" "$file"
  sed -i "2s/.*/import { vi } from 'vitest';/" "$file"
done

echo "Done! All test files fixed."
