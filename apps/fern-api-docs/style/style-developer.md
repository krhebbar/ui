## Developer-specific style

- Don't change text inside inline code phrases or code blocks.
- Always specify a language for codeblocks.
- Wrap adjacent codeblocks in a `<CodeBlocks>` element.
- If a codeblock is preceded by a title, move the title to the codeblock.
  Example before:
  ```
  **Request**
    ```bash
    curl -X POST -H "Content-Type: application/json"
    ```
  Example after:
  ```
    ```bash Request
    curl -X POST -H "Content-Type: application/json"
    ``` 
  ```
