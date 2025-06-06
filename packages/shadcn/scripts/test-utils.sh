#!/bin/bash

# Shared Test Utilities for DevRev CLI Tests

# Colors for output
RED='[0;31m'
GREEN='[0;32m'
YELLOW='[1;33m'
BLUE='[0;34m'
NC='[0m' # No Color

# Script configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CLI_PATH="$SCRIPT_DIR/../dist/index.js" # Adjusted path

# Logging functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

log_header() {
    echo -e "
${BLUE}============================================${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}============================================${NC}"
}

log_test_start() {
    echo -e "
${BLUE}--- Test: $1 --- ${NC}"
    # Increment total tests count if a global counter is used in the calling script
}

log_test_result() {
    local test_name="$1"
    local result="$2" # Should be "PASS" or "FAIL"

    if [ "$result" = "PASS" ]; then
        log_success "✅ $test_name"
        # Increment passed tests count if a global counter is used
    else
        log_error "❌ $test_name"
        # Increment failed tests count if a global counter is used
    fi
}

# Timeout helper function (macOS compatible)
run_with_timeout() {
    local timeout_duration=$1
    shift
    local cmd=("$@")

    "${cmd[@]}" &
    local cmd_pid=$!
    local count=0

    while [ $count -lt $timeout_duration ]; do
        if ! kill -0 $cmd_pid 2>/dev/null; then
            wait $cmd_pid
            return $?
        fi
        sleep 1
        count=$((count + 1))
    done

    # Kill process if it timed out
    kill $cmd_pid 2>/dev/null
    wait $cmd_pid 2>/dev/null
    return 124  # timeout exit code
}

# Setup function
# Usage: setup_test_environment <TEST_DIR_NAME>
setup_test_environment() {
    local test_dir_name="$1"
    export TEST_DIR="/tmp/$test_dir_name-$(date +%s)" # Export TEST_DIR so it's available to calling script

    log_info "Setting up test environment for ${test_dir_name}..."

    # Build the CLI if not already built (optional, can be a global setup step)
    if [ ! -f "$CLI_PATH" ]; then
        log_info "Building CLI..."
        (cd "$SCRIPT_DIR/.." && npm run build) || { # Run in subshell to avoid cd side effects
            log_error "Failed to build CLI"
            exit 1
        }
    fi

    # Check if CLI exists
    if [ ! -f "$CLI_PATH" ]; then
        log_error "CLI not found at $CLI_PATH"
        exit 1
    fi

    # Create test directory
    rm -rf "$TEST_DIR"
    mkdir -p "$TEST_DIR"
    log_success "Test environment ready at $TEST_DIR"
}

# Cleanup function
# Usage: cleanup_all
cleanup_all() {
    if [ -n "$TEST_DIR" ] && [ -d "$TEST_DIR" ]; then
        log_info "Cleaning up test directory: $TEST_DIR..."
        rm -rf "$TEST_DIR"
        log_success "Test directory cleaned up"
    else
        log_info "No test directory to clean up or TEST_DIR not set."
    fi
}

# Validation functions
validate_project_structure() {
    local project_dir="$1"
    local type="$2" # "airdrop" or "snapin"

    log_info "Validating project structure for $type at $project_dir..."

    # Check essential files exist
    [ -f "$project_dir/snapin.config.mjs" ] || { log_error "Missing snapin.config.mjs"; return 1; }
    [ -f "$project_dir/.env" ] || { log_error "Missing .env"; return 1; }
    [ -f "$project_dir/manifest.yaml" ] || { log_error "Missing manifest.yaml"; return 1; }
    [ -d "$project_dir/types" ] || { log_error "Missing types directory"; return 1; }
    [ -d "$project_dir/code" ] || { log_error "Missing code directory"; return 1; }
    [ -f "$project_dir/code/package.json" ] || { log_error "Missing code/package.json"; return 1; }
    [ -d "$project_dir/code/src" ] || { log_error "Missing code/src directory"; return 1; }

    log_success "Project structure validation passed."
    return 0
}

validate_config_file() {
    local config_file="$1"
    local type="$2" # "airdrop" or "snapin"

    log_info "Validating $type config file: $config_file..."

    grep -q "projectType" "$config_file" || { log_error "Missing projectType in config"; return 1; }
    grep -q "devrevObjects" "$config_file" || { log_error "Missing devrevObjects in config"; return 1; }
    grep -q "externalSystem" "$config_file" || { log_error "Missing externalSystem in config"; return 1; }
    grep -q "connection" "$config_file" || { log_error "Missing connection in config"; return 1; }

    if [ "$type" = "snap-in" ]; then
        # Snap-in specific checks (if any, for now, projectType should be 'snap-in')
        grep -q "projectType: 'snap-in'" "$config_file" || { log_error "projectType is not 'snap-in' in snapin.config.mjs"; return 1; }
    elif [ "$type" = "airdrop" ]; then
        # Airdrop specific checks (if any, for now, projectType should be 'airdrop')
        grep -q "projectType: 'airdrop'" "$config_file" || { log_error "projectType is not 'airdrop' in snapin.config.mjs"; return 1; }
    fi

    log_success "$type config file validation passed."
    return 0
}

validate_manifest_yaml() {
    local manifest_file="$1"
    log_info "Validating manifest file: $manifest_file..."

    [ -f "$manifest_file" ] || { log_error "Manifest file does not exist"; return 1; }
    [ -s "$manifest_file" ] || { log_error "Manifest file is empty"; return 1; }

    # Basic YAML validation - check for common fields
    if grep -q "name:" "$manifest_file" && grep -q "version:" "$manifest_file"; then
        log_success "Manifest file validation passed."
        return 0
    else
        log_error "Manifest file missing basic fields (name, version)."
        return 1
    fi
}

validate_env_file() {
    local env_file="$1"
    local connection_type="$2" # "oauth" or "pat" or "basic" (for general snap-in)

    log_info "Validating .env file: $env_file for $connection_type..."

    [ -f "$env_file" ] || { log_error ".env file does not exist"; return 1; }

    grep -q "DEVREV_PAT=" "$env_file" || { log_error "Missing DEVREV_PAT in .env"; return 1; }
    grep -q "DEVREV_ORG=" "$env_file" || { log_error "Missing DEVREV_ORG in .env"; return 1; }

    if [ "$connection_type" = "oauth" ]; then
        grep -q "_CLIENT_ID=" "$env_file" || { log_error "Missing _CLIENT_ID for OAuth in .env"; return 1; }
        grep -q "_CLIENT_SECRET=" "$env_file" || { log_error "Missing _CLIENT_SECRET for OAuth in .env"; return 1; }
    elif [ "$connection_type" = "pat" ]; then
        grep -q "_TOKEN=" "$env_file" || { log_error "Missing _TOKEN for PAT in .env"; return 1; }
    fi

    log_success ".env file validation passed."
    return 0
}

# Make functions available to sourcing scripts
export -f log_info log_success log_error log_header log_test_start log_test_result
export -f run_with_timeout setup_test_environment cleanup_all
export -f validate_project_structure validate_config_file validate_manifest_yaml validate_env_file
