"""Keep independently managed MCP state out of application autogeneration."""


def include_migration_name(name, type_, parent_names):
    return type_ != 'table' or name != 'bwc_mcp_oauth_records'
