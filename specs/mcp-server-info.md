Linking Framelink MCP for Figma in Codex CLI

1) Set your Figma API key in the shell before launching Codex:
export FIGMA_API_KEY="your_real_figma_key_here"

2) Register the MCP server with Codex (stdio):
codex mcp add "Framelink MCP for Figma" --command npx -- -y figma-developer-mcp --figma-api-key=${FIGMA_API_KEY} --stdio

3) Verify the server is registered:
codex mcp list

4) Launch Codex in the same shell session so it inherits FIGMA_API_KEY:
codex

Notes:
- If you use the Codex IDE extension, ensure its environment includes FIGMA_API_KEY.
- If you store server config in .vscode/mcp.json, restart the MCP host after edits.
