#!/bin/bash

# Test Snap-in Environment Variable Injection Flow

set -e # Exit on any error

# Source the shared utilities
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=./test-utils.sh
source "$SCRIPT_DIR/test-utils.sh"

# Test specific configuration
TEST_NAME="snapin-env-injection-flow"
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0

# Main test function
test_snapin_env_injection() {
    log_test_start "Snap-in Env Injection Project Initialization"
    TOTAL_TESTS=$((TOTAL_TESTS + 1))

    # This test requires ensuring that the snapin.config.mjs and manifest.yaml
    # correctly reference process.env.VAR_NAME for secrets or configurations.
    # The --yes flag should facilitate a setup where such environment variables are expected.
    # We might need specific flags if the CLI supports them e.g. --template env-heavy-template
    # For this example, we assume a snap-in that by default uses env vars for some critical config.
    # Example: node $CLI_PATH init --yes --project-type snapin --name "my-env-snapin" --template "template-with-env-vars"
    # The validation for this test in `validate_env_file` might need to be more specific,
    # or `validate_config_file` needs to check for `process.env` usage.

    # For now, using "pat" as connection_type for validate_env_file to check for a token variable.
    # This implies the snap-in is configured for PAT auth, which typically uses env vars.
    if run_with_timeout 120 node "$CLI_PATH" init --yes --project-type snapin --auth-type pat --name "my-env-snapin"; then
        local project_name="my-env-snapin" # Matches --name or discovered
        if [ ! -d "$TEST_DIR/$project_name" ]; then
            project_name=$(ls -td -- "$TEST_DIR"/*/ | head -n 1 | xargs -n 1 basename)
            if [ -z "$project_name" ] || [ ! -d "$TEST_DIR/$project_name" ]; then
                log_test_result "Snap-in Env Injection Project Initialization" "FAIL"
                log_error "Project directory not found after init."
                FAILED_TESTS=$((FAILED_TESTS + 1))
                return 1
            fi
        fi
        local project_path="$TEST_DIR/$project_name"

        if validate_project_structure "$project_path" "snapin" && \
           validate_config_file "$project_path/snapin.config.mjs" "snapin" && \
           grep -q "process.env" "$project_path/snapin.config.mjs" && \
           validate_manifest_yaml "$project_path/manifest.yaml" && \
           validate_env_file "$project_path/.env" "pat"; then # Using "pat" to ensure token env vars are checked
            log_test_result "Snap-in Env Injection Project Initialization" "PASS"
            PASSED_TESTS=$((PASSED_TESTS + 1))
            log_info "Found 'process.env' in snapin.config.mjs as expected."
        else
            log_test_result "Snap-in Env Injection Project Initialization" "FAIL"
            FAILED_TESTS=$((FAILED_TESTS + 1))
            log_error "Validation failed for Snap-in Env Injection project. Check for 'process.env' in config and .env vars."
        fi
    else
        log_test_result "Snap-in Env Injection Project Initialization" "FAIL"
        FAILED_TESTS=$((FAILED_TESTS + 1))
        log_error "CLI init command failed for Snap-in Env Injection."
    fi
}

# Report summary
report_summary() {
    log_header "SNAP-IN ENV INJECTION FLOW TEST SUMMARY"
    echo -e "Total Tests: ${TOTAL_TESTS}"
    echo -e "${GREEN}Passed: ${PASSED_TESTS}${NC}"
    echo -e "${RED}Failed: ${FAILED_TESTS}${NC}"

    if [ "$FAILED_TESTS" -eq 0 ]; then
        log_success "All Snap-in Env Injection flow tests passed!"
        return 0
    else
        log_error "Some Snap-in Env Injection flow tests failed."
        return 1
    fi
}

# Main execution
main() {
    log_header "STARTING SNAP-IN ENV INJECTION FLOW TESTS"

    setup_test_environment "$TEST_NAME"

    cd "$TEST_DIR" || { log_error "Failed to navigate to test directory $TEST_DIR"; exit 1; }

    test_snapin_env_injection

    cd "$SCRIPT_DIR" || exit 1

    local result_status=0
    report_summary || result_status=1

    cleanup_all

    log_header "SNAP-IN ENV INJECTION FLOW TESTS COMPLETED"
    exit $result_status
}

# Trap for cleanup
trap 'cleanup_all; cd "$SCRIPT_DIR" || exit 1; log_error "Snap-in Env Injection tests interrupted."; exit 1;' SIGINT SIGTERM

# Run main
main
