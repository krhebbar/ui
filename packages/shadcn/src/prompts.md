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
  --connection-type oauth \
  --sync-direction two-way \
  --documentation-url https://developers.notion.com/ \
  --yes \
  --cwd airdrop-notion
```
