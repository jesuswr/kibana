#!/usr/bin/env bash
set -euo pipefail

synchronize_lexer_grammar () {
  license_header="$1"
  source_file="$PARENT_DIR/elasticsearch/x-pack/plugin/esql/src/main/antlr/EsqlBaseLexer.g4"
  source_lib_dir="$PARENT_DIR/elasticsearch/x-pack/plugin/esql/src/main/antlr/lexer"
  destination_file="./src/platform/packages/shared/kbn-esql-ast/src/antlr/esql_lexer.g4"
  destination_lib_parent_dir="./src/platform/packages/shared/kbn-esql-ast/src/antlr"
  destination_lib_dir="$destination_lib_parent_dir/lexer"


  # Copy the files
  echo "Copying base lexer file..."
  cp "$source_file" "$destination_file"
  echo "Copying lexer lib files..."
  rm -rf "$destination_lib_dir"
  cp -r "$source_lib_dir" "$destination_lib_parent_dir"


  # Insert the license header
  temp_file=$(mktemp)
  printf "// DO NOT MODIFY THIS FILE BY HAND. IT IS MANAGED BY A CI JOB.\n\n%s" "$(cat $destination_file)" > "$temp_file"
  mv "$temp_file" "$destination_file"

  # Replace the line containing "lexer grammar" with "lexer grammar esql_lexer;"
  sed -i -e 's/lexer grammar.*$/lexer grammar esql_lexer;/' "$destination_file"

  # Replace the line containing "superClass" with "superClass=lexer_config;"
  sed -i -e 's/superClass.*$/superClass=lexer_config;/' "$destination_file"

  echo "File copied and modified successfully."
}

synchronize_parser_grammar () {
  license_header="$1"
  source_file="$PARENT_DIR/elasticsearch/x-pack/plugin/esql/src/main/antlr/EsqlBaseParser.g4"
  source_lib_dir="$PARENT_DIR/elasticsearch/x-pack/plugin/esql/src/main/antlr/parser"
  destination_file="./src/platform/packages/shared/kbn-esql-ast/src/antlr/esql_parser.g4"
  destination_lib_parent_dir="./src/platform/packages/shared/kbn-esql-ast/src/antlr"
  destination_lib_dir="$destination_lib_parent_dir/parser"

  # Copy the files
  echo "Copying base parser file..."
  cp "$source_file" "$destination_file"
  echo "Copying parser lib files..."
  rm -rf "$destination_lib_dir"
  cp -r "$source_lib_dir" "$destination_lib_parent_dir"

  # Insert the license header
  temp_file=$(mktemp)
  printf "// DO NOT MODIFY THIS FILE BY HAND. IT IS MANAGED BY A CI JOB.\n\n%s" "$(cat ${destination_file})" > "$temp_file"
  mv "$temp_file" "$destination_file"

  # Replace the line containing "parser grammar" with "parser grammar esql_parser;"
  sed -i -e 's/parser grammar.*$/parser grammar esql_parser;/' "$destination_file"

  # Replace tokenVocab=EsqlBaseLexer; with tokenVocab=esql_lexer;
  sed -i -e 's/tokenVocab=EsqlBaseLexer;/tokenVocab=esql_lexer;/' "$destination_file"

  # Replace the line containing "superClass" with "superClass=parser_config;"
  sed -i -e 's/superClass.*$/superClass=parser_config;/' "$destination_file"

  echo "File copied and modified successfully."
}

report_main_step () {
  echo "--- $1"
}

main () {
  cd "$PARENT_DIR"

  report_main_step "Cloning repositories"

  rm -rf elasticsearch
  git clone https://github.com/elastic/elasticsearch --depth 1

  cd "$KIBANA_DIR"

  license_header=$(cat "$KIBANA_DIR/licenses/ELASTIC-LICENSE-2.0-HEADER.txt")

  report_main_step "Synchronizing lexer grammar..."
  synchronize_lexer_grammar "$license_header"

  report_main_step "Synchronizing parser grammar..."
  synchronize_parser_grammar "$license_header"

  # Check for differences
  set +e
  git diff --exit-code --quiet "$destination_file"
  if [ $? -eq 0 ]; then
    echo "No differences found. Our work is done here."
    exit
  fi
  set -e

  report_main_step "Differences found. Checking for an existing pull request."

  KIBANA_MACHINE_USERNAME="kibanamachine"
  git config --global user.name "$KIBANA_MACHINE_USERNAME"
  git config --global user.email '42973632+kibanamachine@users.noreply.github.com'

  PR_TITLE='[ES|QL] Update grammars'
  PR_BODY='This PR updates the ES|QL grammars (lexer and parser) to match the latest version in Elasticsearch.'

  # Check if a PR already exists
  pr_search_result=$(gh pr list --search "$PR_TITLE" --state open --author "$KIBANA_MACHINE_USERNAME"  --limit 1 --json title -q ".[].title")

  if [ "$pr_search_result" == "$PR_TITLE" ]; then
    echo "PR already exists. Exiting."
    exit
  fi

  echo "No existing PR found. Proceeding."

  report_main_step "Building ANTLR artifacts."

  # Bootstrap Kibana
  .buildkite/scripts/bootstrap.sh

  # Build ANTLR stuff
  cd ./src/platform/packages/shared/kbn-esql-ast
  yarn build:antlr4:esql

  # Make a commit
  BRANCH_NAME="esql_grammar_sync_$(date +%s)"

  git checkout -b "$BRANCH_NAME"

  git add src/antlr/*
  git commit -m "Update ES|QL grammars"

  report_main_step "Changes committed. Creating pull request."

  git push origin "$BRANCH_NAME"

  # Create a PR
  gh pr create --title "$PR_TITLE" --body "$PR_BODY" --base main --head "${BRANCH_NAME}" --label 'release_note:skip' --label 'Team:ESQL' 
}

main
