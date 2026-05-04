import sys
sys.stdout.reconfigure(encoding="utf-8", errors="replace")

import json
import psycopg2
import psycopg2.extras
from collections import defaultdict, deque

SOURCE_URL = "postgresql://new_wdze_user:diDNfAsRRqjulJWWPiQg8aYC2ZzXW8vg@dpg-d7chio28qa3s73adcum0-a.frankfurt-postgres.render.com/new_wdze"
TARGET_URL = "postgresql://bwc_db_user:c6Z87O2cqDWaDNctxfmuK5MgtJ2bVMSj@dpg-d2nc2pa4d50c73e6j4ug-a.frankfurt-postgres.render.com/bwc_db"

print("Connecting …")
src = psycopg2.connect(SOURCE_URL)
src.autocommit = True
tgt = psycopg2.connect(TARGET_URL)
tgt.autocommit = False
psycopg2.extras.register_uuid()
sc = src.cursor()
tc = tgt.cursor()
print("Connected.\n")


def section(title):
    print(f"\n{'='*70}\n  {title}\n{'='*70}")

def row_count(cur, table):
    cur.execute(f'SELECT COUNT(*) FROM "{table}"')
    return cur.fetchone()[0]

def get_cols(cur, table):
    cur.execute("""
        SELECT column_name FROM information_schema.columns
        WHERE table_schema='public' AND table_name=%s
        ORDER BY ordinal_position
    """, (table,))
    return [r[0] for r in cur.fetchall()]

def adapt_row(row):
    """Wrap any dict/list values in Json() so psycopg2 can serialise JSONB."""
    return tuple(
        psycopg2.extras.Json(v, dumps=json.dumps) if isinstance(v, (dict, list)) else v
        for v in row
    )


# ═════════════════════════════════════════════════════════════════════════════
# STEP 0 — Drop everything in bwc_db
# ═════════════════════════════════════════════════════════════════════════════
section("STEP 0: Drop all tables, types, sequences in bwc_db")

tc.execute("SELECT tablename FROM pg_tables WHERE schemaname='public'")
for (t,) in tc.fetchall():
    try:
        tc.execute(f'DROP TABLE IF EXISTS "{t}" CASCADE')
        print(f"  Dropped table '{t}'")
    except Exception as e:
        tgt.rollback()
        print(f"  ERROR dropping table '{t}': {e}")

tc.execute("""
    SELECT t.typname FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname='public' AND t.typtype='e'
""")
for (e,) in tc.fetchall():
    try:
        tc.execute(f"DROP TYPE IF EXISTS {e} CASCADE")
        print(f"  Dropped enum '{e}'")
    except Exception as ex:
        tgt.rollback()
        print(f"  ERROR dropping enum '{e}': {ex}")

tc.execute("SELECT sequence_name FROM information_schema.sequences WHERE sequence_schema='public'")
for (s,) in tc.fetchall():
    try:
        tc.execute(f'DROP SEQUENCE IF EXISTS "{s}" CASCADE')
        print(f"  Dropped sequence '{s}'")
    except Exception as ex:
        tgt.rollback()
        print(f"  ERROR dropping sequence '{s}': {ex}")

tgt.commit()
print("Step 0 complete — bwc_db is clean.")


# ═════════════════════════════════════════════════════════════════════════════
# STEP 1 — Ensure pgcrypto extension (for gen_random_uuid)
# ═════════════════════════════════════════════════════════════════════════════
section("STEP 1: Extensions")
try:
    tc.execute("CREATE EXTENSION IF NOT EXISTS pgcrypto")
    tgt.commit()
    print("  pgcrypto OK")
except Exception as e:
    tgt.rollback()
    print(f"  pgcrypto note: {e}")


# ═════════════════════════════════════════════════════════════════════════════
# STEP 2 — Recreate enum types from new_wdze
# ═════════════════════════════════════════════════════════════════════════════
section("STEP 2: Create enum types")

sc.execute("""
    SELECT t.typname,
           array_agg(e.enumlabel ORDER BY e.enumsortorder) AS vals
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    JOIN pg_enum e ON e.enumtypid = t.oid
    WHERE n.nspname='public' AND t.typtype='e'
    GROUP BY t.typname ORDER BY t.typname
""")
for enum_name, vals in sc.fetchall():
    try:
        tc.execute(f"CREATE TYPE {enum_name} AS ENUM ({', '.join(repr(v) for v in vals)})")
        tgt.commit()
        print(f"  Created enum '{enum_name}' ({len(vals)} values: {vals})")
    except Exception as e:
        tgt.rollback()
        print(f"  ERROR enum '{enum_name}': {e}")


# ═════════════════════════════════════════════════════════════════════════════
# STEP 3 — Recreate sequences from new_wdze
# ═════════════════════════════════════════════════════════════════════════════
section("STEP 3: Create sequences")

sc.execute("""
    SELECT sequence_name, data_type, start_value, minimum_value,
           maximum_value, increment, cycle_option
    FROM information_schema.sequences WHERE sequence_schema='public'
""")
for seq_name, data_type, start, min_val, max_val, inc, cycle in sc.fetchall():
    cycle_sql = "CYCLE" if cycle == "YES" else "NO CYCLE"
    try:
        tc.execute(f"""
            CREATE SEQUENCE "{seq_name}"
            AS {data_type}
            START WITH {start}
            MINVALUE {min_val}
            MAXVALUE {max_val}
            INCREMENT BY {inc}
            {cycle_sql}
        """)
        tgt.commit()
        print(f"  Created sequence '{seq_name}'")
    except Exception as e:
        tgt.rollback()
        print(f"  ERROR sequence '{seq_name}': {e}")


# ═════════════════════════════════════════════════════════════════════════════
# STEP 4 — Recreate tables (PK + UNIQUE + CHECK inline; FK deferred)
# ═════════════════════════════════════════════════════════════════════════════
section("STEP 4: Create tables (FK constraints deferred)")

sc.execute("SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename")
all_src_tables = [r[0] for r in sc.fetchall()]

fk_statements = []   # (table, con_name, con_def) — applied after data copy

for table in all_src_tables:
    # Exact column types via pg_catalog (handles enums, arrays, custom types, precision)
    sc.execute("""
        SELECT a.attname,
               pg_catalog.format_type(a.atttypid, a.atttypmod) AS col_type,
               a.attnotnull,
               pg_get_expr(d.adbin, d.adrelid) AS col_default
        FROM pg_catalog.pg_attribute a
        LEFT JOIN pg_catalog.pg_attrdef d
               ON d.adrelid = a.attrelid AND d.adnum = a.attnum
        WHERE a.attrelid = (
            SELECT c.oid FROM pg_catalog.pg_class c
            JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
            WHERE c.relname = %s AND n.nspname = 'public'
        )
        AND a.attnum > 0 AND NOT a.attisdropped
        ORDER BY a.attnum
    """, (table,))
    cols = sc.fetchall()

    # PK, UNIQUE, CHECK — inline
    sc.execute("""
        SELECT c.conname, pg_get_constraintdef(c.oid) AS def
        FROM pg_catalog.pg_constraint c
        JOIN pg_catalog.pg_class t  ON t.oid = c.conrelid
        JOIN pg_catalog.pg_namespace n ON n.oid = t.relnamespace
        WHERE t.relname=%s AND n.nspname='public' AND c.contype IN ('p','u','c')
    """, (table,))
    non_fk = sc.fetchall()

    # FK — collect for later
    sc.execute("""
        SELECT c.conname, pg_get_constraintdef(c.oid) AS def
        FROM pg_catalog.pg_constraint c
        JOIN pg_catalog.pg_class t  ON t.oid = c.conrelid
        JOIN pg_catalog.pg_namespace n ON n.oid = t.relnamespace
        WHERE t.relname=%s AND n.nspname='public' AND c.contype='f'
    """, (table,))
    for con_name, con_def in sc.fetchall():
        fk_statements.append((table, con_name, con_def))

    col_parts = []
    for col_name, col_type, not_null, col_default in cols:
        part = f'  "{col_name}" {col_type}'
        if col_default is not None:
            part += f' DEFAULT {col_default}'
        if not_null:
            part += ' NOT NULL'
        col_parts.append(part)

    for con_name, con_def in non_fk:
        col_parts.append(f'  CONSTRAINT "{con_name}" {con_def}')

    ddl = f'CREATE TABLE IF NOT EXISTS "{table}" (\n' + ',\n'.join(col_parts) + '\n)'
    try:
        tc.execute(ddl)
        tgt.commit()
        print(f"  Created '{table}' ({len(cols)} cols, {len(sc.fetchall()) if False else '?'} FKs pending)")
    except Exception as e:
        tgt.rollback()
        print(f"  ERROR creating '{table}': {e}")
        print(f"    DDL: {ddl[:500]}")

# Fix up the printed FK count (already consumed cursor above)
print(f"  Total FK constraints to add later: {len(fk_statements)}")
print("Step 4 complete.")


# ═════════════════════════════════════════════════════════════════════════════
# STEP 5 — Copy all data in topological (FK-safe) order
# ═════════════════════════════════════════════════════════════════════════════
section("STEP 5: Copy all data")

# Build dependency graph
sc.execute("""
    SELECT t.relname AS tbl, ft.relname AS ref
    FROM pg_constraint c
    JOIN pg_class t  ON t.oid  = c.conrelid
    JOIN pg_class ft ON ft.oid = c.confrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE c.contype='f' AND n.nspname='public'
      AND t.relname != ft.relname
""")
table_needs = defaultdict(set)   # table → tables it must come after
dependents  = defaultdict(list)  # table → tables that need it first

for tbl, ref in sc.fetchall():
    if ref in all_src_tables:
        table_needs[tbl].add(ref)
        dependents[ref].append(tbl)

in_degree = {t: len(table_needs.get(t, set())) for t in all_src_tables}
queue = deque(t for t in all_src_tables if in_degree[t] == 0)
sorted_tables = []

while queue:
    t = queue.popleft()
    sorted_tables.append(t)
    for dep in dependents.get(t, []):
        in_degree[dep] -= 1
        if in_degree[dep] == 0:
            queue.append(dep)

remaining = [t for t in all_src_tables if t not in set(sorted_tables)]
if remaining:
    print(f"  Note: circular/unresolved deps, appending at end: {remaining}")
sorted_tables.extend(remaining)

total_rows = 0
for table in sorted_tables:
    src_col_list = get_cols(sc, table)
    tgt_col_set  = set(get_cols(tc, table))
    common = [c for c in src_col_list if c in tgt_col_set]

    if not common:
        print(f"  SKIP '{table}': no common columns")
        continue

    col_sql = ', '.join(f'"{c}"' for c in common)
    sc.execute(f'SELECT {col_sql} FROM "{table}"')
    rows = sc.fetchall()

    if not rows:
        print(f"  {table:<38}      0  (empty)")
        continue

    try:
        adapted = [adapt_row(r) for r in rows]
        psycopg2.extras.execute_values(
            tc,
            f'INSERT INTO "{table}" ({col_sql}) VALUES %s',
            adapted,
            page_size=500,
        )
        tgt.commit()
        total_rows += len(rows)
        print(f"  {table:<38} {len(rows):>6} rows")
    except Exception as e:
        tgt.rollback()
        print(f"  ERROR [{table}]: {e}")

print(f"\n  Total rows copied: {total_rows}")
print("Step 5 complete.")


# ═════════════════════════════════════════════════════════════════════════════
# STEP 6 — Create non-constraint indexes
# ═════════════════════════════════════════════════════════════════════════════
section("STEP 6: Create indexes")

sc.execute("""
    SELECT i.indexname, i.indexdef
    FROM pg_indexes i
    WHERE i.schemaname='public'
      AND NOT EXISTS (
          SELECT 1 FROM pg_constraint c
          JOIN pg_class t ON t.oid = c.conrelid
          JOIN pg_namespace n ON n.oid = t.relnamespace
          WHERE n.nspname='public' AND c.conname = i.indexname
      )
    ORDER BY i.tablename, i.indexname
""")
idx_ok = idx_err = 0
for idx_name, idx_def in sc.fetchall():
    try:
        tc.execute(idx_def)
        tgt.commit()
        idx_ok += 1
        print(f"  Created index '{idx_name}'")
    except Exception as e:
        tgt.rollback()
        idx_err += 1
        print(f"  SKIP '{idx_name}': {e}")

print(f"  Indexes: {idx_ok} created, {idx_err} skipped/errored")
print("Step 6 complete.")


# ═════════════════════════════════════════════════════════════════════════════
# STEP 7 — Add FK constraints (data is already in place)
# ═════════════════════════════════════════════════════════════════════════════
section("STEP 7: Add FK constraints")

fk_ok = fk_err = 0
for table, con_name, con_def in fk_statements:
    sql = f'ALTER TABLE "{table}" ADD CONSTRAINT "{con_name}" {con_def}'
    try:
        tc.execute(sql)
        tgt.commit()
        fk_ok += 1
    except Exception as e:
        tgt.rollback()
        fk_err += 1
        print(f"  ERROR FK '{con_name}' on '{table}': {e}")

print(f"  FK constraints: {fk_ok} added, {fk_err} failed")
print("Step 7 complete.")


# ═════════════════════════════════════════════════════════════════════════════
# STEP 8 — Reset sequences to max observed value
# ═════════════════════════════════════════════════════════════════════════════
section("STEP 8: Reset sequences")

tc.execute("SELECT sequence_name FROM information_schema.sequences WHERE sequence_schema='public'")
for (seq_name,) in tc.fetchall():
    tc.execute("""
        SELECT table_name, column_name
        FROM information_schema.columns
        WHERE column_default LIKE %s AND table_schema='public'
    """, (f"%{seq_name}%",))
    usages = tc.fetchall()
    for table_name, col_name in usages:
        try:
            tc.execute(f"""
                SELECT setval(
                    '{seq_name}',
                    COALESCE((SELECT MAX("{col_name}") FROM "{table_name}"), 1)
                )
            """)
            tgt.commit()
            print(f"  Reset '{seq_name}' → max of {table_name}.{col_name}")
        except Exception as e:
            tgt.rollback()
            print(f"  ERROR resetting '{seq_name}': {e}")

print("Step 8 complete.")


# ═════════════════════════════════════════════════════════════════════════════
# STEP 9 — Final row counts side by side
# ═════════════════════════════════════════════════════════════════════════════
section("STEP 9: Final row counts — new_wdze vs bwc_db")

sc.execute("SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename")
src_tables = {r[0] for r in sc.fetchall()}

tc.execute("SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename")
tgt_tables = {r[0] for r in tc.fetchall()}

all_tables = sorted(src_tables | tgt_tables)
print(f"\n  {'Table':<38} {'new_wdze':>10} {'bwc_db':>10}  Status")
print(f"  {'-'*38} {'-'*10} {'-'*10}  {'-'*6}")

mismatches = 0
for t in all_tables:
    sc_n = row_count(sc, t) if t in src_tables else "—"
    tc_n = row_count(tc, t) if t in tgt_tables else "—"
    flag = "MATCH" if sc_n == tc_n else "DIFF"
    if flag == "DIFF":
        mismatches += 1
    print(f"  {t:<38} {str(sc_n):>10} {str(tc_n):>10}  {flag}")

print(f"\n  Tables: {len(tgt_tables)} in bwc_db | Mismatches: {mismatches}")

src.close()
tgt.close()
print("\nMigration complete.")
