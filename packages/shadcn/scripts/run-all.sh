#!/bin/bash

# Master Test Runner for DevRev CLI
# Executes various project creation and initialization test flows

set -e  # Exit on any error

# Colors for output
RED='[0;31m'
GREEN='[0;32m'
YELLOW='[1;33m'
BLUE='[0;34m'
NC='[0m' # No Color

# Script paths
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
UTILS_SCRIPT="$SCRIPT_DIR/test-utils.sh"

# New specific test scripts
AIRDROP_OAUTH_SCRIPT="$SCRIPT_DIR/test-airdrop-oauth-flow.sh"
AIRDROP_PAT_SCRIPT="$SCRIPT_DIR/test-airdrop-pat-flow.sh"
SNAPIN_BASIC_SCRIPT="$SCRIPT_DIR/test-snapin-basic-flow.sh"
SNAPIN_ENV_INJECTION_SCRIPT="$SCRIPT_DIR/test-snapin-env-injection.sh"

# Old general test scripts (can be kept for broader checks or phased out)
# AIRDROP_GENERAL_SCRIPT="$SCRIPT_DIR/test-airdrop-flow.sh"
# SNAPIN_GENERAL_SCRIPT="$SCRIPT_DIR/test-snapin-flow.sh"

# Test results
TOTAL_SUITES_ATTEMPTED=0
PASSED_SUITES=0
FAILED_SUITES=0

# Source utility functions for logging (optional, if run-all.sh uses them directly)
# If test-utils.sh is primarily for individual test scripts, this might not be needed here.
# However, for consistency in logging, it can be useful.
if [ -f "$UTILS_SCRIPT" ]; then
    # shellcheck source=./test-utils.sh
    source "$UTILS_SCRIPT"
else
    # Fallback basic logging if utils not found (should not happen)
    log_info() { echo "[INFO] $1"; }
    log_success() { echo "[SUCCESS] $1"; }
    log_error() { echo "[ERROR] $1"; }
    log_header() { echo -e "
==== $1 ===="; }
fi


# Check prerequisites
check_prerequisites() {
    log_info "Checking prerequisites..."
    
    if [ ! -f "../package.json" ]; then
        log_error "Must be run from the packages/shadcn/scripts directory"
        exit 1
    fi

    # Ensure all new scripts are executable
    test_scripts=(
        "$AIRDROP_OAUTH_SCRIPT"
        "$AIRDROP_PAT_SCRIPT"
        "$SNAPIN_BASIC_SCRIPT"
        "$SNAPIN_ENV_INJECTION_SCRIPT"
    )

    for script in "${test_scripts[@]}"; do
        if [ ! -f "$script" ]; then
            log_error "Test script not found: $script"
            exit 1
        fi
        chmod +x "$script"
    done
    
    log_success "Prerequisites check passed and scripts are executable."
}

# Function to run a single test script
# Usage: run_test_script <script_path> <description>
run_test_script() {
    local script_path="$1"
    local description="$2"

    log_header "RUNNING: $description"
    TOTAL_SUITES_ATTEMPTED=$((TOTAL_SUITES_ATTEMPTED + 1))
    
    if bash "$script_path"; then
        log_success "$description completed successfully."
        PASSED_SUITES=$((PASSED_SUITES + 1))
        return 0
    else
        log_error "$description failed."
        FAILED_SUITES=$((FAILED_SUITES + 1))
        return 1 # Indicate failure
    fi
}

# Generate final report
generate_report() {
    log_header "OVERALL TEST EXECUTION SUMMARY"
    
    echo -e "Total Test Suites Attempted: ${TOTAL_SUITES_ATTEMPTED}"
    echo -e "${GREEN}Passed Suites: ${PASSED_SUITES}${NC}"
    echo -e "${RED}Failed Suites: ${FAILED_SUITES}${NC}"
    
    if [ "$FAILED_SUITES" -eq 0 ] && [ "$TOTAL_SUITES_ATTEMPTED" -gt 0 ]; then
        echo -e "
${GREEN}🎉 ALL TEST SUITES PASSED! ${NC}"
        return 0
    elif [ "$TOTAL_SUITES_ATTEMPTED" -eq 0 ]; then
        echo -e "
${YELLOW}🤔 NO TEST SUITES WERE RUN. ${NC}"
        return 1 # Or specific code for no tests run
    else
        echo -e "
${RED}❌ SOME TEST SUITES FAILED. ${NC}"
        echo -e "${RED}Please review the output above for details on failed suites.${NC}"
        return 1
    fi
}

# Help function
show_help() {
    echo "DevRev CLI Test Suite Runner"
    echo ""
    echo "Usage: $0 [options]"
    echo ""
    echo "Options:"
    echo "  -h, --help                 Show this help message"
    echo "  --test <test_name>       Run a specific test. Available tests:"
    echo "                             airdrop-oauth, airdrop-pat,"
    echo "                             snapin-basic, snapin-env-injection"
    # Add more specific test names if needed
    echo ""
    echo "Examples:"
    echo "  $0                       # Run all defined test suites"
    echo "  $0 --test airdrop-oauth  # Run only the Airdrop OAuth flow tests"
}

# Main execution
main() {
    log_header "DEVREV CLI COMPREHENSIVE TEST SUITE"
    
    check_prerequisites
    
    local run_all_tests=true
    local specific_test_to_run=""

    # Parse command line arguments
    if [ "$#" -gt 0 ]; then
        if [ "$1" == "--test" ]; then
            if [ -n "$2" ]; then
                run_all_tests=false
                specific_test_to_run="$2"
                log_info "Running specific test: $specific_test_to_run"
            else
                log_error "No test name provided for --test option."
                show_help
                exit 1
            fi
        elif [ "$1" == "-h" ] || [ "$1" == "--help" ]; then
            show_help
            exit 0
        else
            log_error "Unknown option: $1"
            show_help
            exit 1
        fi
    fi

    # Define an array of tests to run. Each element is "script_path|description".
    declare -a tests_to_run
    tests_to_run=(
        "$AIRDROP_OAUTH_SCRIPT|Airdrop OAuth Flow Tests"
        "$AIRDROP_PAT_SCRIPT|Airdrop PAT Flow Tests"
        "$SNAPIN_BASIC_SCRIPT|Snap-in Basic Flow Tests"
        "$SNAPIN_ENV_INJECTION_SCRIPT|Snap-in Env Injection Flow Tests"
    )

    if [ "$run_all_tests" = true ]; then
        log_info "Running all test suites..."
        for test_info in "${tests_to_run[@]}"; do
            IFS='|' read -r script_path description <<< "$test_info"
            run_test_script "$script_path" "$description"
            # Optional: could add a sleep or a separator log here
        done
    else
        case "$specific_test_to_run" in
            "airdrop-oauth")
                run_test_script "$AIRDROP_OAUTH_SCRIPT" "Airdrop OAuth Flow Tests"
                ;;
            "airdrop-pat")
                run_test_script "$AIRDROP_PAT_SCRIPT" "Airdrop PAT Flow Tests"
                ;;
            "snapin-basic")
                run_test_script "$SNAPIN_BASIC_SCRIPT" "Snap-in Basic Flow Tests"
                ;;
            "snapin-env-injection")
                run_test_script "$SNAPIN_ENV_INJECTION_SCRIPT" "Snap-in Env Injection Flow Tests"
                ;;
            *)
                log_error "Unknown specific test name: $specific_test_to_run"
                show_help
                exit 1
                ;;
        esac
    fi
    
    generate_report
    # The exit status of generate_report will be the exit status of the script
}


# Run main function, passing all arguments to it
main "$@"
