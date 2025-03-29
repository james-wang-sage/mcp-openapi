# @reapi/mcp-openapi

A Model Context Protocol (MCP) server that loads and serves multiple OpenAPI specifications to enable LLM-powered IDE integrations. This server acts as a bridge between your OpenAPI specifications and LLM-powered development tools like Cursor and other code editors.

## Features

- Loads multiple OpenAPI specifications from a directory
- Exposes API operations and schemas through MCP protocol
- Enables LLMs to understand and work with your APIs directly in your IDE
- Supports dereferenced schemas for complete API context
- Maintains a catalog of all available APIs

## Powered by [ReAPI](https://reapi.com)

This open-source MCP server is sponsored by [ReAPI](https://reapi.com), a next-generation API platform that simplifies API design and testing. While this server provides local OpenAPI integration for development, ReAPI offers two powerful modules:

### 🎨 API CMS
- Design APIs using an intuitive no-code editor
- Generate and publish OpenAPI specifications automatically
- Collaborate with team members in real-time
- Version control and change management

### 🧪 API Testing
- The most developer-friendly no-code API testing solution
- Create and manage test cases with an intuitive interface
- Powerful assertion and validation capabilities
- Serverless cloud test executor
- Perfect for both QA teams and developers
- CI/CD integration ready

Try ReAPI for free at [reapi.com](https://reapi.com) and experience the future of API development.

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

## Cursor Configuration

To integrate the MCP OpenAPI server with Cursor IDE, you have two options for configuration locations:

### Option 1: Project-specific Configuration (Recommended)
Create a `.cursor/mcp.json` file in your project directory. This option is recommended as it allows you to:
- Organize API specifications by project
- Maintain different sets of specs for different projects

```json
{
  "mcpServers": {
    "@reapi/mcp-openapi": {
      "command": "npx",
      "args": ["-y", "@reapi/mcp-openapi", "--dir", "./specs"],
      "env": {}
    }
  }
}
```

> **Tip**: Using a relative path like `./specs` makes the configuration portable and easier to share across team members.

### Option 2: Global Configuration
Create or edit `~/.cursor/mcp.json` in your home directory to make the server available across all projects:

```json
{
  "mcpServers": {
    "@reapi/mcp-openapi": {
      "command": "npx",
      "args": ["-y", "@reapi/mcp-openapi", "--dir", "/path/to/your/specs"],
      "env": {}
    }
  }
}
```

### Enable in Cursor Settings

After adding the configuration:

1. Open Cursor IDE
2. Go to Settings > Cursor Settings > MCP
3. Enable the @reapi/mcp-openapi server
4. Click the refresh icon next to the server to apply changes

The server is now ready to use. When you add new OpenAPI specifications to your directory, you can refresh the catalog by:

1. Opening Cursor's chat panel
2. Typing one of these prompts:
   ```
   "Please refresh the API catalog"
   "Reload the OpenAPI specifications"
   ```

> **Note**: Replace `/path/to/your/specs` with the actual path to your OpenAPI specification files.

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

### OpenAPI Specification Requirements

1. Place your OpenAPI 3.x specifications in the target directory:
   - Supports both JSON and YAML formats
   - Files should have `.json`, `.yaml`, or `.yml` extensions
   - Scanner will automatically discover and process all specification files

2. Specification ID Configuration:
   - By default, the filename (without extension) is used as the specification ID
   - To specify a custom ID, add `x-spec-id` in the OpenAPI info object:
   ```yaml
   openapi: 3.0.0
   info:
     title: My API
     version: 1.0.0
     x-spec-id: my-custom-api-id  # Custom specification ID
   ```
   
   > **Important**: Setting a custom `x-spec-id` is crucial when working with multiple specifications that have:
   > - Similar or identical endpoint paths
   > - Same schema names
   > - Overlapping operation IDs
   >
   > The spec ID helps distinguish between these similar resources and prevents naming conflicts. For example:
   > ```yaml
   > # user-service.yaml
   > info:
   >   x-spec-id: user-service
   > paths:
   >   /users:
   >     get: ...
   > 
   > # admin-service.yaml
   > info:
   >   x-spec-id: admin-service
   > paths:
   >   /users:
   >     get: ...
   > ```
   > Now you can reference these endpoints specifically as `user-service/users` and `admin-service/users`

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

## Integration

This server implements the Model Context Protocol, making it compatible with LLM-powered development tools. It's designed to work seamlessly with:

- Cursor IDE
- Other MCP-compatible code editors
- LLM-powered development tools

## Tools

1. `refresh-api-catalog`
   - Refresh the API catalog
   - Returns: Success message when catalog is refreshed

2. `get-api-catalog`
   - Get the API catalog, the catalog contains metadata about all openapi specifications, their operations and schemas
   - Returns: Complete API catalog with all specifications, operations, and schemas

3. `search-api-operations`
   - Search for operations across specifications
   - Inputs:
     - `query` (string): Search query
     - `specId` (optional string): Specific API specification ID to search within
   - Returns: Matching operations from the API catalog

4. `search-api-schemas`
   - Search for schemas across specifications
   - Inputs:
     - `query` (string): Search query
   - Returns: Matching schemas from the API catalog

5. `load-api-operation-by-operationId`
   - Load an operation by operationId
   - Inputs:
     - `specId` (string): API specification ID
     - `