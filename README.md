# @reapi/mcp-openapi

A Model Context Protocol (MCP) server that loads and serves multiple OpenAPI specifications to enable LLM-powered IDE integrations. This server acts as a bridge between your OpenAPI specifications and LLM-powered development tools like Cursor and other code editors.

## Features

- Loads multiple OpenAPI specifications from a directory
- Exposes API operations and schemas through MCP protocol
- Enables LLMs to understand and work with your APIs directly in your IDE
- Supports dereferenced schemas for complete API context
- Maintains a catalog of all available APIs

## Installation

You can use this package directly with npx:

```bash
npx @reapi/mcp-openapi --dir /path/to/specs
```

Or install it globally:

```bash
npm install -g @reapi/mcp-openapi
reapi-mcp-openapi --dir /path/to/specs
```

## Usage

```bash
reapi-mcp-openapi [options]
```

### Options

- `-d, --dir <path>`: Directory containing your OpenAPI specification files (defaults to current directory)
- `--catalog-dir <path>`: Directory for storing the API catalog (defaults to '_catalog')
- `--dereferenced-dir <path>`: Directory for storing dereferenced specifications (defaults to '_dereferenced')
- `-h, --help`: Display help information
- `-V, --version`: Display version information

## How It Works

1. The server scans the specified directory for OpenAPI specification files
2. It processes and dereferences the specifications for complete context
3. Creates and maintains a catalog of all API operations and schemas
4. Exposes this information through the MCP protocol
5. IDE integrations can then use this information to:
   - Provide API context to LLMs
   - Enable intelligent code completion
   - Assist in API integration
   - Generate API-aware code snippets

## Examples

1. Start the server with default settings:
```bash
npx @reapi/mcp-openapi
```

2. Specify a custom directory containing your API specs:
```bash
npx @reapi/mcp-openapi --dir ./my-apis
```

3. Custom catalog and dereferenced directories:
```bash
npx @reapi/mcp-openapi --dir ./apis --catalog-dir _my_catalog --dereferenced-dir _my_dereferenced
```

## Requirements

- Node.js >= 16

## Integration

This server implements the Model Context Protocol, making it compatible with LLM-powered development tools. It's designed to work seamlessly with:

- Cursor IDE
- Other MCP-compatible code editors
- LLM-powered development tools

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request. 