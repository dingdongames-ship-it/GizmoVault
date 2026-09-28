#!/usr/bin/env bash
# ==============================================================================
# GizmoVault — Automated Capacitor Android Production Release Build Script
# Builds Google Play Android App Bundle (.aab) with release signing
# ==============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

echo "================================================================="
echo "⚡ GizmoVault Android Production Release Automation"
echo "Project Root: ${PROJECT_ROOT}"
echo "================================================================="

cd "${PROJECT_ROOT}"

# ------------------------------------------------------------------------------
# 1. Validate Keystore & Signing Environment Variables
# ------------------------------------------------------------------------------
echo "==> [1/5] Validating release signing environment variables..."

MISSING_VARS=()

if [ -z "${KEYSTORE_FILE:-}" ]; then
  MISSING_VARS+=("KEYSTORE_FILE")
fi

if [ -z "${KEYSTORE_PASSWORD:-}" ]; then
  MISSING_VARS+=("KEYSTORE_PASSWORD")
fi

if [ -z "${KEY_ALIAS:-}" ]; then
  MISSING_VARS+=("KEY_ALIAS")
fi

if [ -z "${KEY_PASSWORD:-}" ]; then
  MISSING_VARS+=("KEY_PASSWORD")
fi

if [ ${#MISSING_VARS[@]} -ne 0 ]; then
  echo "❌ ERROR: Missing required release signing environment variable(s):" >&2
  for var in "${MISSING_VARS[@]}"; do
    echo "   - ${var}" >&2
  done
  echo "" >&2
  echo "Please set these variables before running the release build:" >&2
  echo "  export KEYSTORE_FILE=\"/path/to/gizmovault-release-key.jks\"" >&2
  echo "  export KEYSTORE_PASSWORD=\"your_keystore_password\"" >&2
  echo "  export KEY_ALIAS=\"your_key_alias\"" >&2
  echo "  export KEY_PASSWORD=\"your_key_password\"" >&2
  exit 1
fi

if [ ! -f "${KEYSTORE_FILE}" ]; then
  echo "❌ ERROR: Specified KEYSTORE_FILE does not exist at: ${KEYSTORE_FILE}" >&2
  exit 1
fi

echo "✔ Release signing credentials validated successfully."
echo "  Keystore: ${KEYSTORE_FILE}"
echo "  Key Alias: ${KEY_ALIAS}"

# ------------------------------------------------------------------------------
# 2. Run Web Application Build (Vite & TypeScript)
# ------------------------------------------------------------------------------
echo "==> [2/5] Running web application build (npm run build)..."
npm run build
echo "✔ Web bundle generated successfully in dist/client."

# ------------------------------------------------------------------------------
# 3. Synchronize Capacitor Android Native Project
# ------------------------------------------------------------------------------
echo "==> [3/5] Syncing Capacitor Android assets and native plugins..."
npx cap sync android
echo "✔ Capacitor Android sync completed."

# ------------------------------------------------------------------------------
# 4. Build Signed Android App Bundle (.aab) with Gradle
# ------------------------------------------------------------------------------
echo "==> [4/5] Running Gradle bundleRelease inside android directory..."

ANDROID_DIR="${PROJECT_ROOT}/android"
if [ ! -d "${ANDROID_DIR}" ] && [ -d "${PROJECT_ROOT}/client/android" ]; then
  ANDROID_DIR="${PROJECT_ROOT}/client/android"
fi

cd "${ANDROID_DIR}"

# Ensure gradlew executable permissions on Unix systems
if [ -f "./gradlew" ]; then
  chmod +x ./gradlew
  ./gradlew bundleRelease
elif [ -f "./gradlew.bat" ]; then
  ./gradlew.bat bundleRelease
else
  echo "❌ ERROR: Gradle wrapper (gradlew) not found in android directory (${ANDROID_DIR})." >&2
  exit 1
fi

# ------------------------------------------------------------------------------
# 5. Verify the Generated .aab Bundle
# ------------------------------------------------------------------------------
cd "${PROJECT_ROOT}"

AAB_PATH="android/app/build/outputs/bundle/release/app-release.aab"
if [ ! -f "${AAB_PATH}" ] && [ -f "client/android/app/build/outputs/bundle/release/app-release.aab" ]; then
  AAB_PATH="client/android/app/build/outputs/bundle/release/app-release.aab"
fi

echo "==> [5/5] Verifying generated release bundle..."

if [ ! -f "${AAB_PATH}" ]; then
  echo "❌ ERROR: Release build completed but expected .aab was not found at:" >&2
  echo "   ${AAB_PATH}" >&2
  exit 1
fi

AAB_SIZE=$(wc -c < "${AAB_PATH}" | tr -d ' ')
if [ "${AAB_SIZE}" -le 0 ]; then
  echo "❌ ERROR: Generated .aab file is empty (0 bytes): ${AAB_PATH}" >&2
  exit 1
fi

echo "================================================================="
echo "🎉 SUCCESS: Google Play Release App Bundle generated successfully!"
echo "   Artifact: ${AAB_PATH}"
echo "   Size: $((AAB_SIZE / 1024)) KB (${AAB_SIZE} bytes)"

if command -v sha256sum >/dev/null 2>&1; then
  SHA256=$(sha256sum "${AAB_PATH}" | awk '{print $1}')
  echo "   SHA-256: ${SHA256}"
elif command -v shasum >/dev/null 2>&1; then
  SHA256=$(shasum -a 256 "${AAB_PATH}" | awk '{print $1}')
  echo "   SHA-256: ${SHA256}"
fi

echo "================================================================="
echo "Ready for upload to Google Play Console: Production / Internal Track."
