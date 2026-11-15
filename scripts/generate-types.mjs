// Generate the checked-in offline schema snapshot from the exact migration files.
// For hosted deployment also run: npx supabase gen types typescript --linked.
import { createTestDatabase } from '../tests/db-harness.mjs';
import { writeFile } from 'node:fs/promises';
const db = await createTestDatabase();
const columns = (
  await db.query(
    "select table_name,column_name,data_type,udt_name,is_nullable,column_default,is_generated from information_schema.columns where table_schema='public' order by table_name,ordinal_position",
  )
).rows;
const mapType = (c) => {
  if (c.data_type === 'ARRAY') return c.udt_name.includes('int') ? 'number[]' : 'string[]';
  if (
    ['integer', 'bigint', 'numeric', 'smallint', 'real', 'double precision'].includes(c.data_type)
  )
    return 'number';
  if (c.data_type === 'boolean') return 'boolean';
  if (['json', 'jsonb'].includes(c.data_type)) return 'Json';
  return 'string';
};
const tables = [...new Set(columns.map((c) => c.table_name))];
let out =
  '// Generated from migrations using PostgreSQL information_schema. Do not hand edit.\nexport type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];\nexport interface Database { public: { Tables: {\n';
for (const table of tables) {
  const cs = columns.filter((c) => c.table_name === table);
  out += `${table}: {\nRow: {\n${cs.map((c) => `${c.column_name}: ${mapType(c)}${c.is_nullable === 'YES' ? ' | null' : ''}`).join(';\n')}\n};\nInsert: {\n${cs
    .filter((c) => c.is_generated === 'NEVER')
    .map(
      (c) =>
        `${c.column_name}${c.column_default || c.is_nullable === 'YES' ? '?' : ''}: ${mapType(c)}${c.is_nullable === 'YES' ? ' | null' : ''}`,
    )
    .join(
      ';\n',
    )}\n};\nUpdate: Partial<Database['public']['Tables']['${table}']['Insert']>;\nRelationships: [];\n};\n`;
}
out += '}; Views: Record<string, never>; Functions: {\n';
const functions = (
  await db.query(
    "select p.proname,p.proargnames,p.proargtypes::regtype[]::text as argtypes,pg_get_function_result(p.oid) as result from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' order by p.proname",
  )
).rows;
for (const f of functions) {
  out += `${f.proname}: { Args: Record<string, Json | undefined>; Returns: Json };\n`;
}
out += '}; Enums: Record<string, never>; CompositeTypes: Record<string, never> } }\n';
await writeFile('src/infrastructure/database.types.ts', out);
await writeFile(
  'scripts/schema-snapshot.json',
  JSON.stringify(
    {
      tables: tables.map((name) => ({
        name,
        columns: columns.filter((c) => c.table_name === name),
      })),
      functions,
    },
    null,
    2,
  ),
);
console.log(`Generated ${tables.length} table types and ${functions.length} RPC entries.`);
await db.close();
