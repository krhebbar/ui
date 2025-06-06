#!/bin/bash

# Test Airdrop PAT Flow

set -e # Exit on any error

# Source the shared utilities
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=./test-utils.sh
source "$SCRIPT_DIR/test-utils.sh"

# Test specific configuration
TEST_NAME="airdrop-pat-flow"
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0

# Main test function
test_airdrop_pat() {
    log_test_start "Airdrop PAT Project Initialization"
    TOTAL_TESTS=$((TOTAL_TESTS + 1))

    # Similar to OAuth, we assume CLI flags or --yes behavior for PAT.
    # Adjust if specific flags are needed e.g. --auth-type pat
    # For PAT, the prompts would involve selecting 'API Token/Secret' and providing env var names.
    # Example: node $CLI_PATH init --yes --project-type airdrop --auth-type pat --project-name "my-pat-airdrop"

    if run_with_timeout 120 node "$CLI_PATH" init --yes --auth-type pat --project-type airdrop --project-name "my-pat-airdrop"; then
        local project_name="my-pat-airdrop" # Matches --project-name or discovered if not matching
        if [ ! -d "$TEST_DIR/$project_name" ]; then
            project_name=$(ls -td -- "$TEST_DIR"/*/ | head -n 1 | xargs -n 1 basename)
            if [ -z "$project_name" ] || [ ! -d "$TEST_DIR/$project_name" ]; then
                log_test_result "Airdrop PAT Project Initialization" "FAIL"
                log_error "Project directory not found after init."
                FAILED_TESTS=$((FAILED_TESTS + 1))
                return 1
            fi
        fi
        local project_path="$TEST_DIR/$project_name"

        if validate_project_structure "$project_path" "airdrop" && \
           validate_config_file "$project_path/snapin.config.mjs" "airdrop" && \
           validate_manifest_yaml "$project_path/manifest.yaml" && \
           validate_env_file "$project_path/.env" "pat"; then # Key difference: "pat" for env validation
            log_test_result "Airdrop PAT Project Initialization" "PASS"
            PASSED_TESTS=$((PASSED_TESTS + 1))
        else
            log_test_result "Airdrop PAT Project Initialization" "FAIL"
            FAILED_TESTS=$((FAILED_TESTS + 1))
            log_error "Validation failed for Airdrop PAT project."
        fi
    else
        log_test_result "Airdrop PAT Project Initialization" "FAIL"
        FAILED_TESTS=$((FAILED_TESTS + 1))
        log_error "CLI init command failed for Airdrop PAT."
    fi
}

# Report summary
report_summary() {
    log_header "AIRDROP PAT FLOW TEST SUMMARY"
    echo -e "Total Tests: ${TOTAL_TESTS}"
    echo -e "${GREEN}Passed: ${PASSED_TESTS}${NC}"
    echo -e "${RED}Failed: ${FAILED_TESTS}${NC}"

    if [ "$FAILED_TESTS" -eq 0 ]; then
        log_success "All Airdrop PAT flow tests passed!"
        return 0
    else
        log_error "Some Airdrop PAT flow tests failed."
        return 1
    fi
}

# Main execution
main() {
    log_header "STARTING AIRDROP PAT FLOW TESTS"

    setup_test_environment "$TEST_NAME"

    cd "$TEST_DIR" || { log_error "Failed to navigate to test directory $TEST_DIR"; exit 1; }

    test_airdrop_pat

    cd "$SCRIPT_DIR" || exit 1

    local result_status=0
    report_summary || result_status=1

    cleanup_all

    log_header "AIRDROP PAT FLOW TESTS COMPLETED"
    exit $result_status
}

# Trap for cleanup
trap 'cleanup_all; cd "$SCRIPT_DIR" || exit 1; log_error "Airdrop PAT tests interrupted."; exit 1;' SIGINT SIGTERM

# Run main
main
