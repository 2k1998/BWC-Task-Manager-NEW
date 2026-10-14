"""Local stdio MCP entry point. Authenticate separately with bwc-mcp-login."""
from contextlib import asynccontextmanager

from mcp.server.fastmcp import FastMCP

from .client import BwcClient
from .config import Settings
from .tools import register_tools


def create_server(client: BwcClient) -> FastMCP:
    """Build a server around an injectable client; own its lifetime."""
    @asynccontextmanager
    async def lifespan(server: FastMCP):
        try:
            yield {}
        finally:
            await client.close()

    server = FastMCP('BWC Task Manager', instructions=(
        'Manage BWC tasks and hierarchy accounts with the configured account permissions. '
        'Resolve company IDs, department names, and assignees using lookup tools. '
        'Dates use YYYY-MM-DD. Credentials are never returned to the model.'), lifespan=lifespan)
    register_tools(server, client)
    return server


def main() -> None:
    create_server(BwcClient(Settings.from_env())).run(transport='stdio')


if __name__ == '__main__':
    main()
