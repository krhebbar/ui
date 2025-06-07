```markdowm

Use the `@snap-in-config.mjs` file to:
1. Identify the external system name and API placeholders.
2. Use the websearch_tool to gather accurate API connection details (base URL, auth method, required headers, and token verification endpoint) for the external system.
3. Replace placeholders in the connection object of `snap-in-config.mjs` with actual values based on your research.
4. Ensure all changes adhere to the expected schema of the `snap-in-config`.
5. Run the following command to test the connection:

   shadcn test-connection --type=secret --verbose

```

``` bash
shadcn init \
  --project-type airdrop \
  --external-system-name "Notion" \
  --access-method api \
  --connection-type secret \
  --documentation-url https://developers.notion.com/ \
  --yes
```

```bash
shadcn init \
    --project-type airdrop \
    --external-system-name "Notion" \
    --access-method api \
    --connection-type secret \
    --documentation-url https://developers.notion.com/ \
    --yes \
    --cwd airdrop-notion
```

```
# Jira integration
shadcn init --external-system-name "Jira" --access-method api --connection-type oauth --yes

# GitHub integration  
shadcn init --external-system-name "GitHub" --access-method sdk --connection-type oauth --yes

# Slack integration
shadcn init --external-system-name "Slack" --access-method api --connection-type secret --yes
```
