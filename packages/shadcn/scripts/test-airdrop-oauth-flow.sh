#!/bin/bash

# Test Airdrop OAuth Flow

set -e # Exit on any error

# Source the shared utilities
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=./test-utils.sh
source "$SCRIPT_DIR/test-utils.sh"

# Test specific configuration
TEST_NAME="airdrop-oauth-flow"
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0

# Main test function
test_airdrop_oauth() {
    log_test_start "Airdrop OAuth Project Initialization"
    TOTAL_TESTS=$((TOTAL_TESTS + 1))

    # Mock user inputs for OAuth Airdrop
    # This uses a here string to feed answers to the prompts.
    # Adjust inputs based on actual prompts from 'packages/shadcn/src/commands/init/prompts.ts'
    # 1. Project type: airdrop (index 0)
    # 2. Airdrop project name: my-oauth-airdrop
    # 3. Sync direction: two-way (index 0)
    # 4. External system name: oauth-system
    # 5. External system slug: oauth-system-slug (auto-generated or custom)
    # 6. API base URL: https://api.oauth.com
    # 7. Test endpoint: /me
    # 8. Object types: tickets,users
    # 9. Connection type: oauth2 (index 0)
    # 10. DevRev objects: select default (e.g., account) - usually by just pressing enter if pre-selected
    # 11. Client ID Env Var: OAUTH_SYSTEM_SLUG_CLIENT_ID
    # 12. Client Secret Env Var: OAUTH_SYSTEM_SLUG_CLIENT_SECRET
    # 13. Auth URL: https://auth.oauth.com/authorize
    # 14. Token URL: https://auth.oauth.com/token
    # 15. Scope: read write

    # The actual prompts sequence and default values should be verified against prompts.ts
    # For non-interactive --yes, these are not directly used but configure the default behavior.
    # However, to ensure a specific OAuth flow, we might need to run without --yes or use specific flags if available.
    # For this example, we assume 'node $CLI_PATH init --yes' will pick reasonable defaults
    # that can be overridden or we rely on the default template to be OAuth.
    # A more robust approach would be to use flags if the CLI supports them for non-interactive setup of OAuth.

    # For now, we'll use --yes and assume the default Airdrop template is OAuth, or it prompts appropriately.
    # If CLI `init` command can take parameters to specify these, that would be better.
    # Example: node $CLI_PATH init --type airdrop --auth oauth ...

    if run_with_timeout 120 node "$CLI_PATH" init --yes --project-type airdrop --auth-type oauth --name "my-oauth-airdrop"; then
        # Assuming the project is created in a subdirectory named "my-oauth-airdrop"
        local project_name="my-oauth-airdrop" # This should match the --name flag if used, or default naming
        # If --name doesn't create a dir with that name, find the created dir:
        if [ ! -d "$TEST_DIR/$project_name" ]; then
             # Find the directory created by the init command
            project_name=$(ls -td -- "$TEST_DIR"/*/ | head -n 1 | xargs -n 1 basename)
            if [ -z "$project_name" ] || [ ! -d "$TEST_DIR/$project_name" ]; then
                log_test_result "Airdrop OAuth Project Initialization" "FAIL"
                log_error "Project directory not found after init."
                FAILED_TESTS=$((FAILED_TESTS + 1))
                return 1
            fi
        fi
        local project_path="$TEST_DIR/$project_name"

        if validate_project_structure "$project_path" "airdrop" && \
           validate_config_file "$project_path/snapin.config.mjs" "airdrop" && \
           validate_manifest_yaml "$project_path/manifest.yaml" && \
           validate_env_file "$project_path/.env" "oauth"; then
            log_test_result "Airdrop OAuth Project Initialization" "PASS"
            PASSED_TESTS=$((PASSED_TESTS + 1))
        else
            log_test_result "Airdrop OAuth Project Initialization" "FAIL"
            FAILED_TESTS=$((FAILED_TESTS + 1))
            log_error "Validation failed for Airdrop OAuth project."
        fi
    else
        log_test_result "Airdrop OAuth Project Initialization" "FAIL"
        FAILED_TESTS=$((FAILED_TESTS + 1))
        log_error "CLI init command failed for Airdrop OAuth."
    fi
}

# Report summary
report_summary() {
    log_header "AIRDROP OAUTH FLOW TEST SUMMARY"
    echo -e "Total Tests: ${TOTAL_TESTS}"
    echo -e "${GREEN}Passed: ${PASSED_TESTS}${NC}"
    echo -e "${RED}Failed: ${FAILED_TESTS}${NC}"

    if [ "$FAILED_TESTS" -eq 0 ]; then
        log_success "All Airdrop OAuth flow tests passed!"
        return 0
    else
        log_error "Some Airdrop OAuth flow tests failed."
        return 1
    fi
}

# Main execution
main() {
    log_header "STARTING AIRDROP OAUTH FLOW TESTS"

    setup_test_environment "$TEST_NAME"

    # Navigate to test directory
    cd "$TEST_DIR" || { log_error "Failed to navigate to test directory $TEST_DIR"; exit 1; }

    test_airdrop_oauth

    # Navigate back to script directory or a safe path before cleanup
    cd "$SCRIPT_DIR" || exit 1

    local result_status=0
    report_summary || result_status=1 # Capture failing status

    cleanup_all # Sources TEST_DIR from test-utils.sh

    log_header "AIRDROP OAUTH FLOW TESTS COMPLETED"
    exit $result_status
}

# Trap to ensure cleanup on script exit or interruption
trap 'cleanup_all; cd "$SCRIPT_DIR" || exit 1; log_error "Airdrop OAuth tests interrupted."; exit 1;' SIGINT SIGTERM

# Run main function
main
