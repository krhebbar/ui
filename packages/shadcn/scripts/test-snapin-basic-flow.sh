#!/bin/bash

# Test Snap-in Basic Flow

set -e # Exit on any error

# Source the shared utilities
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=./test-utils.sh
source "$SCRIPT_DIR/test-utils.sh"

# Test specific configuration
TEST_NAME="snapin-basic-flow"
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0

# Main test function
test_snapin_basic() {
    log_test_start "Snap-in Basic Project Initialization"
    TOTAL_TESTS=$((TOTAL_TESTS + 1))

    # For a basic snap-in, we might select the default template or a 'basic' template if available.
    # We assume --yes will pick a default snap-in template.
    # Example: node $CLI_PATH init --yes --project-type snapin --template basic --project-name "my-basic-snapin"
    # The CLI needs to support --project-type and --template or similar flags for non-interactive mode.

    if run_with_timeout 120 node "$CLI_PATH" init --yes --project-type snapin --project-name "my-basic-snapin"; then
        local project_name="my-basic-snapin" # Matches --project-name or discovered
        if [ ! -d "$TEST_DIR/$project_name" ]; then
            project_name=$(ls -td -- "$TEST_DIR"/*/ | head -n 1 | xargs -n 1 basename)
            if [ -z "$project_name" ] || [ ! -d "$TEST_DIR/$project_name" ]; then
                log_test_result "Snap-in Basic Project Initialization" "FAIL"
                log_error "Project directory not found after init."
                FAILED_TESTS=$((FAILED_TESTS + 1))
                return 1
            fi
        fi
        local project_path="$TEST_DIR/$project_name"

        if validate_project_structure "$project_path" "snapin" && \
           validate_config_file "$project_path/snapin.config.mjs" "snapin" && \
           validate_manifest_yaml "$project_path/manifest.yaml" && \
           validate_env_file "$project_path/.env" "basic"; then # "basic" for general .env validation
            log_test_result "Snap-in Basic Project Initialization" "PASS"
            PASSED_TESTS=$((PASSED_TESTS + 1))
        else
            log_test_result "Snap-in Basic Project Initialization" "FAIL"
            FAILED_TESTS=$((FAILED_TESTS + 1))
            log_error "Validation failed for Snap-in basic project."
        fi
    else
        log_test_result "Snap-in Basic Project Initialization" "FAIL"
        FAILED_TESTS=$((FAILED_TESTS + 1))
        log_error "CLI init command failed for Snap-in basic."
    fi
}

# Report summary
report_summary() {
    log_header "SNAP-IN BASIC FLOW TEST SUMMARY"
    echo -e "Total Tests: ${TOTAL_TESTS}"
    echo -e "${GREEN}Passed: ${PASSED_TESTS}${NC}"
    echo -e "${RED}Failed: ${FAILED_TESTS}${NC}"

    if [ "$FAILED_TESTS" -eq 0 ]; then
        log_success "All Snap-in basic flow tests passed!"
        return 0
    else
        log_error "Some Snap-in basic flow tests failed."
        return 1
    fi
}

# Main execution
main() {
    log_header "STARTING SNAP-IN BASIC FLOW TESTS"

    setup_test_environment "$TEST_NAME"

    cd "$TEST_DIR" || { log_error "Failed to navigate to test directory $TEST_DIR"; exit 1; }

    test_snapin_basic

    cd "$SCRIPT_DIR" || exit 1

    local result_status=0
    report_summary || result_status=1

    cleanup_all

    log_header "SNAP-IN BASIC FLOW TESTS COMPLETED"
    exit $result_status
}

# Trap for cleanup
trap 'cleanup_all; cd "$SCRIPT_DIR" || exit 1; log_error "Snap-in basic tests interrupted."; exit 1;' SIGINT SIGTERM

# Run main
main
