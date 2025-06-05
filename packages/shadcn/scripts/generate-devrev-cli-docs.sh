#!/bin/bash

# Root command
ROOT_CMD="devrev"

# List of top-level subcommands to document
COMMANDS=(
  "snap_in"
  "snap_in_context"
  "snap_in_package"
  "snap_in_version"
)

# Output directory
OUTPUT_DIR="docs"
mkdir -p "$OUTPUT_DIR"

# Function to recursively dump help output
dump_help_recursive() {
  local cmd_path=("$@")
  local full_cmd="$ROOT_CMD ${cmd_path[*]}"
  local file_name="${cmd_path[*]// /_}.help.txt"
  local file_path="$OUTPUT_DIR/$file_name"

  echo "Generating docs for: $full_cmd"

  # Write help output to file
  echo "\$ $full_cmd --help" > "$file_path"
  $full_cmd --help >> "$file_path" 2>&1

  # Extract subcommands from help output
  local subcommands
  subcommands=$( $full_cmd --help 2>/dev/null | \
    awk '/Available Commands:/,/^$/' | \
    tail -n +2 | awk '{print $1}' | grep -v -e '^$' -e 'help' )

  # Recurse into subcommands
  for sub in $subcommands; do
    dump_help_recursive "${cmd_path[@]}" "$sub"
  done
}

# Iterate over each base command and generate documentation
for cmd in "${COMMANDS[@]}"; do
  dump_help_recursive "$cmd"
done

echo "Documentation generated in '$OUTPUT_DIR' folder."
