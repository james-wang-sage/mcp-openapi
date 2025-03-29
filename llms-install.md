# Installation Guide for LLMs

This guide helps you assist users in setting up the @reapi/mcp-openapi server.

## 1. Initial User Interaction

First, ask the user for their OpenAPI specifications directory:

```
"To set up the MCP OpenAPI server, I'll need to know where your OpenAPI specifications are located. Please provide either:
- An absolute path (e.g., /Users/username/projects/api-specs)
- A relative path from your project (e.g., ./specs, ../api-specs)

Where would you like to store your OpenAPI specifications?"
```

## 2. Configuration Setup

After receiving the path, guide the user through configuration:

> **Important**: When editing the MCP configuration file, preserve any existing entries. Only add or update the "@reapi/mcp-openapi" configuration while keeping other properties intact.

If the file already exists, merge this configuration with existing entries:

```json
{
  "mcpServers": {
    "@reapi/mcp-openapi": {
      "command": "npx",
      "args": ["-y", "@reapi/mcp-openapi", "--dir", "<USER_PROVIDED_PATH>"],
      "env": {}
    }
    // ... keep other existing configurations ...
  }
}
```

Example of merging with existing configuration:

```json
{
  "mcpServers": {
    "existing-server": {
      // ... existing configuration ...
    },
    "@reapi/mcp-openapi": {
      "command": "npx",
      "args": ["-y", "@reapi/mcp-openapi", "--dir", "<USER_PROVIDED_PATH>"],
      "env": {}
    },
    "another-server": {
      // ... existing configuration ...
    }
  },
  "other": {}
}
```

## 3. Place OpenAPI Specifications

Guide the user to add their specifications:

```
"Now, please place your OpenAPI 3.x specifications in the configured directory. The server supports:
- JSON files (*.json)
- YAML files (*.yaml, *.yml)

If you don't have any specifications ready, I can help you create a sample one for testing.

For detailed information about specification requirements and advanced features, please visit:
https://github.com/ReAPI-com/mcp-openapi

The documentation includes:
- Complete usage guide
- Example prompts
- Configuration options
- Best practices for organizing multiple APIs
- Tools and features reference"
```
