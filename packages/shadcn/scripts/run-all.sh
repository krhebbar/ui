#!/bin/bash

# Master Test Runner for DevRev CLI
# Executes both Airdrop and Snap-in project creation tests

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Script paths
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
AIRDROP_SCRIPT="$SCRIPT_DIR/test-airdrop-flow.sh"
SNAPIN_SCRIPT="$SCRIPT_DIR/test-snapin-flow.sh"

# Test results
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0

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
    echo -e "\n${BLUE}============================================${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}============================================${NC}"
}

# Check prerequisites
check_prerequisites() {
    log_info "Checking prerequisites..."
    
    # Check if we're in the right directory
    if [ ! -f "../package.json" ]; then
        log_error "Must be run from the packages/shadcn/scripts directory"
        exit 1
    fi
    
    # Check if test scripts exist
    if [ ! -f "$AIRDROP_SCRIPT" ]; then
        log_error "Airdrop test script not found at $AIRDROP_SCRIPT"
        exit 1
    fi
    
    if [ ! -f "$SNAPIN_SCRIPT" ]; then
        log_error "Snap-in test script not found at $SNAPIN_SCRIPT"
        exit 1
    fi
    
    # Make scripts executable
    chmod +x "$AIRDROP_SCRIPT"
    chmod +x "$SNAPIN_SCRIPT"
    
    log_success "Prerequisites check passed"
}

# Run Airdrop flow tests
run_airdrop_tests() {
    log_header "RUNNING AIRDROP FLOW TESTS"
    
    if bash "$AIRDROP_SCRIPT"; then
        log_success "Airdrop tests completed successfully"
        PASSED_TESTS=$((PASSED_TESTS + 1))
        return 0
    else
        log_error "Airdrop tests failed"
        FAILED_TESTS=$((FAILED_TESTS + 1))
        return 1
    fi
}

# Run Snap-in flow tests
run_snapin_tests() {
    log_header "RUNNING SNAP-IN FLOW TESTS"
    
    if bash "$SNAPIN_SCRIPT"; then
        log_success "Snap-in tests completed successfully"
        PASSED_TESTS=$((PASSED_TESTS + 1))
        return 0
    else
        log_error "Snap-in tests failed"
        FAILED_TESTS=$((FAILED_TESTS + 1))
        return 1
    fi
}

# Generate final report
generate_report() {
    log_header "TEST EXECUTION SUMMARY"
    
    TOTAL_TESTS=$((PASSED_TESTS + FAILED_TESTS))
    echo -e "Total Test Suites: ${TOTAL_TESTS}"
    echo -e "${GREEN}Passed: ${PASSED_TESTS}${NC}"
    echo -e "${RED}Failed: ${FAILED_TESTS}${NC}"
    
    if [ $FAILED_TESTS -eq 0 ]; then
        echo -e "\n${GREEN}🎉 ALL TESTS PASSED!${NC}"
        echo -e "${GREEN}Both Airdrop and Snap-in creation workflows are working correctly.${NC}"
        return 0
    else
        echo -e "\n${RED}❌ SOME TESTS FAILED${NC}"
        echo -e "${RED}Please review the test output above for details.${NC}"
        return 1
    fi
}

# Help function
show_help() {
    echo "DevRev CLI Test Suite"
    echo ""
    echo "Usage: $0 [options]"
    echo ""
    echo "Options:"
    echo "  -h, --help         Show this help message"
    echo "  --airdrop-only     Run only airdrop tests"
    echo "  --snapin-only      Run only snap-in tests"
    echo ""
    echo "Examples:"
    echo "  $0                 # Run all tests"
    echo "  $0 --airdrop-only  # Run only airdrop tests"
    echo "  $0 --snapin-only   # Run only snap-in tests"
}

# Main execution
main() {
    log_header "DEVREV CLI TEST SUITE"
    
    # Check prerequisites
    check_prerequisites
    
    # Run test suites
    run_airdrop_tests
    run_snapin_tests
    
    # Generate report
    generate_report
}

# Parse command line arguments
case "${1:-}" in
    -h|--help)
        show_help
        exit 0
        ;;
    --airdrop-only)
        check_prerequisites
        run_airdrop_tests
        ;;
    --snapin-only)
        check_prerequisites
        run_snapin_tests
        ;;
    "")
        main
        ;;
    *)
        log_error "Unknown option: $1"
        show_help
        exit 1
        ;;
esac 