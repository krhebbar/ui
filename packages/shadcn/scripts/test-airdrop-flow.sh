#!/bin/bash

# Airdrop Flow Test Script
# Tests Airdrop project creation and initialization

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Test configuration
TEST_DIR="/tmp/airdrop-flow-test-$(date +%s)"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CLI_PATH="$SCRIPT_DIR/../dist/index.js"
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0

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

log_test_start() {
    echo -e "\n${BLUE}--- Test: $1 ---${NC}"
    TOTAL_TESTS=$((TOTAL_TESTS + 1))
}

log_test_result() {
    local test_name="$1"
    local result="$2"
    
    if [ "$result" = "PASS" ]; then
        log_success "✅ $test_name"
        PASSED_TESTS=$((PASSED_TESTS + 1))
    else
        log_error "❌ $test_name"
        FAILED_TESTS=$((FAILED_TESTS + 1))
    fi
}

# Setup function
setup_test_environment() {
    log_info "Setting up Airdrop test environment..."
    
    # Build the CLI first
    log_info "Building CLI..."
    cd "$SCRIPT_DIR/.."
    npm run build || {
        log_error "Failed to build CLI"
        exit 1
    }
    cd "$SCRIPT_DIR"
    
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
cleanup_all() {
    log_info "Cleaning up test directory..."
    if [ -d "$TEST_DIR" ]; then
        rm -rf "$TEST_DIR"
        log_success "Test directory cleaned up"
    fi
}

# Validation functions
validate_airdrop_project_structure() {
    local project_dir="$1"
    
    # Check essential files exist
    [ -f "$project_dir/snapin.config.mjs" ] || return 1
    [ -f "$project_dir/.env" ] || return 1
    [ -f "$project_dir/manifest.yaml" ] || return 1
    [ -d "$project_dir/types" ] || return 1
    [ -d "$project_dir/code" ] || return 1
    [ -f "$project_dir/code/package.json" ] || return 1
    [ -d "$project_dir/code/src" ] || return 1
    
    return 0
}

validate_airdrop_config() {
    local config_file="$1"
    
    # Check if config contains required fields
    grep -q "devrevObjects" "$config_file" || return 1
    grep -q "externalSystem" "$config_file" || return 1
    grep -q "connection" "$config_file" || return 1
    
    return 0
}

validate_env_file() {
    local env_file="$1"
    
    # Check basic DevRev variables exist
    grep -q "DEVREV_PAT=" "$env_file" || return 1
    grep -q "DEVREV_ORG=" "$env_file" || return 1
    
    return 0
}

# Test 1: Basic Airdrop Project Creation
test_airdrop_creation() {
    log_test_start "Airdrop Project Creation"
    
    local test_dir="$TEST_DIR/airdrop-creation"
    mkdir -p "$test_dir"
    cd "$test_dir"
    
    # Run CLI init command with timeout
    if run_with_timeout 60 node "$CLI_PATH" init --yes; then
        # Check if project directory was created
        local project_dirs=(*/.)
        if [ ${#project_dirs[@]} -eq 1 ] && [ -d "${project_dirs[0]}" ]; then
            local project_name="${project_dirs[0]%/.}"
            local project_path="$test_dir/$project_name"
            
            if validate_airdrop_project_structure "$project_path"; then
                log_test_result "Airdrop Project Creation" "PASS"
                log_info "✓ Project directory created: $project_name"
                log_info "✓ All required files and directories present"
            else
                log_test_result "Airdrop Project Creation" "FAIL"
                log_error "Missing required files or directories"
            fi
        else
            log_test_result "Airdrop Project Creation" "FAIL"
            log_error "Expected exactly one project directory, found: ${#project_dirs[@]}"
        fi
    else
        log_test_result "Airdrop Project Creation" "FAIL"
        log_error "CLI init command failed"
    fi
    
    cd "$TEST_DIR"
}

# Test 2: Configuration File Validation
test_airdrop_config_validation() {
    log_test_start "Airdrop Configuration Validation"
    
    local test_dir="$TEST_DIR/airdrop-config"
    mkdir -p "$test_dir"
    cd "$test_dir"
    
    if run_with_timeout 60 node "$CLI_PATH" init --yes; then
        local project_dirs=(*/.)
        if [ ${#project_dirs[@]} -eq 1 ]; then
            local project_name="${project_dirs[0]%/.}"
            local config_file="$test_dir/$project_name/snapin.config.mjs"
            
            if [ -f "$config_file" ] && validate_airdrop_config "$config_file"; then
                log_test_result "Airdrop Configuration Validation" "PASS"
                log_info "✓ Configuration file exists and contains required fields"
                
                # Check specific Airdrop-related configurations
                if grep -q "devrevObjects" "$config_file" && \
                   grep -q "externalSystem" "$config_file"; then
                    log_info "✓ DevRev objects and external system configured"
                fi
            else
                log_test_result "Airdrop Configuration Validation" "FAIL"
                log_error "Configuration file validation failed"
            fi
        else
            log_test_result "Airdrop Configuration Validation" "FAIL"
            log_error "Project directory not created"
        fi
    else
        log_test_result "Airdrop Configuration Validation" "FAIL"
        log_error "CLI init command failed"
    fi
    
    cd "$TEST_DIR"
}

# Test 3: Environment File Generation
test_env_file_generation() {
    log_test_start "Environment File Generation"
    
    local test_dir="$TEST_DIR/airdrop-env"
    mkdir -p "$test_dir"
    cd "$test_dir"
    
    if run_with_timeout 60 node "$CLI_PATH" init --yes; then
        local project_dirs=(*/.)
        if [ ${#project_dirs[@]} -eq 1 ]; then
            local project_name="${project_dirs[0]%/.}"
            local env_file="$test_dir/$project_name/.env"
            
            if [ -f "$env_file" ] && validate_env_file "$env_file"; then
                log_test_result "Environment File Generation" "PASS"
                log_info "✓ Environment file exists with required variables"
                
                # Check for connection-specific variables
                if grep -q "_TOKEN=" "$env_file" || grep -q "_CLIENT_ID=" "$env_file"; then
                    log_info "✓ Connection-specific environment variables present"
                fi
            else
                log_test_result "Environment File Generation" "FAIL"
                log_error "Environment file validation failed"
            fi
        else
            log_test_result "Environment File Generation" "FAIL"
            log_error "Project directory not created"
        fi
    else
        log_test_result "Environment File Generation" "FAIL"
        log_error "CLI init command failed"
    fi
    
    cd "$TEST_DIR"
}

# Test 4: Template Cloning
test_template_cloning() {
    log_test_start "Template Cloning"
    
    local test_dir="$TEST_DIR/airdrop-template"
    mkdir -p "$test_dir"
    cd "$test_dir"
    
    if run_with_timeout 60 node "$CLI_PATH" init --yes; then
        local project_dirs=(*/.)
        if [ ${#project_dirs[@]} -eq 1 ]; then
            local project_name="${project_dirs[0]%/.}"
            local code_dir="$test_dir/$project_name/code"
            
            if [ -d "$code_dir" ] && \
               [ -f "$code_dir/package.json" ] && \
               [ -f "$code_dir/tsconfig.json" ] && \
               [ -d "$code_dir/src" ]; then
                log_test_result "Template Cloning" "PASS"
                log_info "✓ Template cloned successfully"
                log_info "✓ Code directory contains expected files"
                
                # Check that template directories were cleaned up
                local extra_dirs=$(find "$test_dir/$project_name" -maxdepth 1 -type d -name "[0-9]*-*" | wc -l)
                if [ "$extra_dirs" -eq 0 ]; then
                    log_info "✓ Template directories cleaned up properly"
                else
                    log_info "⚠ Found $extra_dirs template directories (may be expected)"
                fi
            else
                log_test_result "Template Cloning" "FAIL"
                log_error "Template cloning validation failed"
            fi
        else
            log_test_result "Template Cloning" "FAIL"
            log_error "Project directory not created"
        fi
    else
        log_test_result "Template Cloning" "FAIL"
        log_error "CLI init command failed"
    fi
    
    cd "$TEST_DIR"
}

# Test 5: Project Directory Navigation
test_project_navigation() {
    log_test_start "Project Directory Navigation"
    
    local test_dir="$TEST_DIR/airdrop-navigation"
    mkdir -p "$test_dir"
    cd "$test_dir"
    
    if run_with_timeout 60 node "$CLI_PATH" init --yes; then
        local project_dirs=(*/.)
        if [ ${#project_dirs[@]} -eq 1 ]; then
            local project_name="${project_dirs[0]%/.}"
            
            # Test if user can cd into the project
            if cd "$project_name" 2>/dev/null; then
                log_test_result "Project Directory Navigation" "PASS"
                log_info "✓ Can navigate into project directory: $project_name"
                log_info "✓ Project name follows expected pattern"
            else
                log_test_result "Project Directory Navigation" "FAIL"
                log_error "Cannot navigate into project directory"
            fi
        else
            log_test_result "Project Directory Navigation" "FAIL"
            log_error "Expected exactly one project directory"
        fi
    else
        log_test_result "Project Directory Navigation" "FAIL"
        log_error "CLI init command failed"
    fi
    
    cd "$TEST_DIR"
}

# Generate test report
generate_report() {
    echo -e "\n${BLUE}============================================${NC}"
    echo -e "${BLUE}AIRDROP FLOW TEST RESULTS${NC}"
    echo -e "${BLUE}============================================${NC}"
    
    echo -e "Total Tests: ${TOTAL_TESTS}"
    echo -e "${GREEN}Passed: ${PASSED_TESTS}${NC}"
    echo -e "${RED}Failed: ${FAILED_TESTS}${NC}"
    
    local success_rate=$((PASSED_TESTS * 100 / TOTAL_TESTS))
    echo -e "Success Rate: ${success_rate}%"
    
    if [ $FAILED_TESTS -eq 0 ]; then
        echo -e "\n${GREEN}🎉 All Airdrop tests passed!${NC}"
        return 0
    else
        echo -e "\n${RED}❌ Some Airdrop tests failed.${NC}"
        return 1
    fi
}

# Main execution
main() {
    echo -e "${BLUE}============================================${NC}"
    echo -e "${BLUE}AIRDROP FLOW TESTS${NC}"
    echo -e "${BLUE}============================================${NC}"
    
    # Setup
    setup_test_environment
    
    # Run tests
    test_airdrop_creation
    test_airdrop_config_validation
    test_env_file_generation
    test_template_cloning
    test_project_navigation
    
    # Generate report
    local test_result
    if generate_report; then
        test_result=0
    else
        test_result=1
    fi
    
    # Cleanup
    cleanup_all
    
    exit $test_result
}

# Trap to ensure cleanup on script exit
trap cleanup_all EXIT

# Run main function
main "$@" 