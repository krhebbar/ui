# DevRev Docs

Merging a change in this repository will update the following clients:

- [API Docs](https://developer.devrev.ai)

This repository contains

- DevRev's `Public` OpenAPI spec & `Beta` OpenAPI spec
- Fern configuration

## API definition

The API Definition contains an OpenAPI specification adapted to be compatible with Fern. The specs are in `/fern/apis`.

To make sure that the definition is valid, you can use the Fern CLI.

```bash
npm install -g fern-api # Installs CLI
fern check # Checks if the definition is valid
```

## Generators

Generators read in your API Definition and output artifacts (the TypeScript SDK Generator) and are tracked in [generators.yml](./fern/api/generators.yml).

To trigger the generators run:

```bash
# publish generated files
fern generate --version <version>
```

## Run a local instance

In the root of this repository:
```
cd custom-implementation/ && npm i && npm run build && cd ..
fern docs dev
```

### Troubleshooting

If you run into errors, you can add the ` --log-level debug` flag to get more information.

## Stylecheck (Beta)

The `stylecheck.py` script sends a markdown file to Claude Sonnet for revision according to defined style, structure, and terminology rules.

### GitHub action
If a PR has the label `stylecheck` and not the label `stylecheck-complete`, the `stylecheck.py` script runs on any `.md(x)` files changed in the PR. A summary of changes is posted as a comment on the timeline. Suggestions for the diff context are added. If there are any proposed revisions outside the diff context, the full text of the revision is included in the summary comment. 

When the action completes, it adds the `stylecheck-complete` tag. If you want stylecheck to run on new changes on a PR where it has already run, remove the `stylecheck-complete` label before pushing the new changes.

### Local execution
To run the script locally and not as part of a PR, set your environment variable `LLM_TOKEN` to your PAT from [OpenWebUI](https://openwebui.dev.devrev-eng.ai/) > **Settings** > **Account** > API Keys. Include the supplemental developer style rules with the `--style` option.
```
python stylecheck.py --style=style/developer.md <path/to/file.mdx>
```
