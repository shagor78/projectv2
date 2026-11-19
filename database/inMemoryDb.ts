import { is, isTable, getTableName } from 'drizzle-orm';
import { getTableConfig, PgColumn, PgDialect, type PgTable } from 'drizzle-orm/pg-core';

const dialect = new PgDialect();

type Row = Record<string, any>;
type TableStore = Map<string, Row[]>;
type SequenceStore = Map<string, number>;

interface ColumnMeta {
  sqlName: string;
  propName: string;
  isSerial: boolean;
  isUnique: boolean;
  hasDefault: boolean;
  defaultValue: any;
  defaultFn?: () => any;
  dataType: string;
}

interface ForeignKeyMeta {
  localCols: string[]; // propNames
  foreignTable: string;
  foreignCols: string[]; // propNames
  onDelete: string;
}

interface TableMeta {
  tableName: string;
  columns: ColumnMeta[];
  bySqlName: Map<string, ColumnMeta>;
  byPropName: Map<string, ColumnMeta>;
  uniqueSets: string[][]; // arrays of propNames
  foreignKeys: ForeignKeyMeta[];
}

function cloneValue<T>(val: T): T {
  if (val === null || val === undefined) return val;
  if (val instanceof Date) return new Date(val.getTime()) as unknown as T;
  if (Array.isArray(val)) return val.map((v) => cloneValue(v)) as unknown as T;
  if (typeof val === 'object') {
    const out: Record<string, any> = {};
    for (const [k, v] of Object.entries(val)) {
      out[k] = cloneValue(v);
    }
    return out as T;
  }
  return val;
}

function isSqlObject(val: unknown): val is { getSQL?: () => any; queryChunks?: any[] } {
  return (
    typeof val === 'object' &&
    val !== null &&
    (typeof (val as any).getSQL === 'function' || Array.isArray((val as any).queryChunks))
  );
}

function compileSql(expr: any): { sql: string; params: any[] } {
  const raw = typeof expr?.getSQL === 'function' ? expr.getSQL() : expr;
  return dialect.sqlToQuery(raw);
}

type TokenType =
  | 'ident'
  | 'string'
  | 'number'
  | 'param'
  | 'op'
  | 'punct'
  | 'eof';

interface Token {
  type: TokenType;
  value: string;
}

function tokenizeSql(input: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  const len = input.length;

  while (i < len) {
    const ch = input[i];
    if (/\s/.test(ch)) {
      i += 1;
      continue;
    }

    if (ch === '"') {
      i += 1;
      let val = '';
      while (i < len && input[i] !== '"') {
        val += input[i];
        i += 1;
      }
      i += 1; // closing "
      tokens.push({ type: 'ident', value: val });
      continue;
    }

    if (ch === "'") {
      i += 1;
      let val = '';
      while (i < len) {
        if (input[i] === "'" && input[i + 1] === "'") {
          val += "'";
          i += 2;
        } else if (input[i] === "'") {
          i += 1;
          break;
        } else {
          val += input[i];
          i += 1;
        }
      }
      tokens.push({ type: 'string', value: val });
      continue;
    }

    if (ch === '$' && /\d/.test(input[i + 1] || '')) {
      i += 1;
      let num = '';
      while (i < len && /\d/.test(input[i])) {
        num += input[i];
        i += 1;
      }
      tokens.push({ type: 'param', value: num });
      continue;
    }

    if (/\d/.test(ch) || (ch === '-' && /\d/.test(input[i + 1] || ''))) {
      let num = ch;
      i += 1;
      while (i < len && /[\d.]/.test(input[i])) {
        num += input[i];
        i += 1;
      }
      tokens.push({ type: 'number', value: num });
      continue;
    }

    if (/[a-zA-Z_]/.test(ch)) {
      let word = '';
      while (i < len && /[a-zA-Z0-9_]/.test(input[i])) {
        word += input[i];
        i += 1;
      }
      tokens.push({ type: 'ident', value: word });
      continue;
    }

    const two = input.slice(i, i + 2);
    if (['!=', '<>', '<=', '>='].includes(two)) {
      tokens.push({ type: 'op', value: two });
      i += 2;
      continue;
    }

    if (['=', '<', '>', '+', '-', '*', '/'].includes(ch)) {
      tokens.push({ type: 'op', value: ch });
      i += 1;
      continue;
    }

    if (['(', ')', ',', '.'].includes(ch)) {
      tokens.push({ type: 'punct', value: ch });
      i += 1;
      continue;
    }

    i += 1;
  }

  tokens.push({ type: 'eof', value: '' });
  return tokens;
}

type RowContext = Map<string, Row | null>;

function likeToRegex(pattern: string, caseInsensitive: boolean): RegExp {
  let regexStr = '^';
  for (let i = 0; i < pattern.length; i += 1) {
    const ch = pattern[i];
    if (ch === '\\' && i + 1 < pattern.length) {
      regexStr += pattern[i + 1].replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      i += 1;
    } else if (ch === '%') {
      regexStr += '.*';
    } else if (ch === '_') {
      regexStr += '.';
    } else {
      regexStr += ch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }
  }
  regexStr += '$';
  return new RegExp(regexStr, caseInsensitive ? 'is' : 's');
}

function valuesEqual(a: any, b: any): boolean {
  if (a === b) return true;
  if (a instanceof Date && b instanceof Date) return a.getTime() === b.getTime();
  if (a instanceof Date && typeof b === 'string') return a.getTime() === new Date(b).getTime();
  if (b instanceof Date && typeof a === 'string') return new Date(a).getTime() === b.getTime();
  return false;
}

function compareValues(a: any, b: any): number {
  if (a === b) return 0;
  if (a === null || a === undefined) return -1;
  if (b === null || b === undefined) return 1;
  if (a instanceof Date && b instanceof Date) return a.getTime() - b.getTime();
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  if (typeof a === 'boolean' && typeof b === 'boolean') return Number(a) - Number(b);
  return String(a).localeCompare(String(b));
}

export function createInMemoryDatabase(schemaModule: Record<string, any>) {
  const tableMetas = new Map<string, TableMeta>();
  const store: TableStore = new Map();
  const sequences: SequenceStore = new Map();

  function registerTable(table: PgTable): TableMeta {
    const tableName = getTableName(table);
    const existing = tableMetas.get(tableName);
    if (existing) return existing;

    const cfg = getTableConfig(table);
    const sqlToProp = new Map<string, string>();
    for (const [propKey, colVal] of Object.entries(table)) {
      if (is(colVal, PgColumn)) {
        sqlToProp.set(colVal.name, propKey);
      }
    }

    const columns: ColumnMeta[] = cfg.columns.map((col) => {
      const propName = sqlToProp.get(col.name) || col.name;
      return {
        sqlName: col.name,
        propName,
        isSerial: col.columnType === 'PgSerial',
        isUnique: Boolean(col.isUnique),
        hasDefault: Boolean(col.hasDefault),
        defaultValue: col.default,
        defaultFn: col.defaultFn,
        dataType: col.dataType,
      };
    });

    const bySqlName = new Map(columns.map((c) => [c.sqlName, c]));
    const byPropName = new Map(columns.map((c) => [c.propName, c]));

    const uniqueSets: string[][] = [];
    for (const col of columns) {
      if (col.isUnique || col.isSerial) {
        uniqueSets.push([col.propName]);
      }
    }
    for (const idx of cfg.indexes) {
      if (idx.config.unique) {
        const cols = idx.config.columns
          .map((c: any) => sqlToProp.get(c.name) || c.name)
          .filter(Boolean);
        if (cols.length > 0) uniqueSets.push(cols);
      }
    }
    for (const uc of cfg.uniqueConstraints) {
      const cols = uc.columns.map((c: any) => sqlToProp.get(c.name) || c.name);
      if (cols.length > 0) uniqueSets.push(cols);
    }

    const foreignKeys: ForeignKeyMeta[] = cfg.foreignKeys.map((fk) => {
      const ref = fk.reference();
      const fTableName = getTableName(ref.foreignTable);
      return {
        localCols: ref.columns.map((c: any) => sqlToProp.get(c.name) || c.name),
        foreignTable: fTableName,
        foreignCols: ref.foreignColumns.map((c: any) => {
          const fMeta = tableMetas.get(fTableName);
          return fMeta?.bySqlName.get(c.name)?.propName || c.name;
        }),
        onDelete: fk.onDelete || 'no action',
      };
    });

    const meta: TableMeta = {
      tableName,
      columns,
      bySqlName,
      byPropName,
      uniqueSets,
      foreignKeys,
    };

    tableMetas.set(tableName, meta);
    if (!store.has(tableName)) store.set(tableName, []);
    if (!sequences.has(tableName)) sequences.set(tableName, 0);
    return meta;
  }

  for (const val of Object.values(schemaModule)) {
    if (isTable(val)) {
      registerTable(val as PgTable);
    }
  }
  // Re-resolve foreign key column propNames after all tables are registered
  for (const val of Object.values(schemaModule)) {
    if (isTable(val)) {
      const tableName = getTableName(val as PgTable);
      const meta = tableMetas.get(tableName)!;
      const cfg = getTableConfig(val as PgTable);
      meta.foreignKeys = cfg.foreignKeys.map((fk) => {
        const ref = fk.reference();
        const fTableName = getTableName(ref.foreignTable);
        const fMeta = tableMetas.get(fTableName);
        return {
          localCols: ref.columns.map((c: any) => meta.bySqlName.get(c.name)?.propName || c.name),
          foreignTable: fTableName,
          foreignCols: ref.foreignColumns.map(
            (c: any) => fMeta?.bySqlName.get(c.name)?.propName || c.name
          ),
          onDelete: fk.onDelete || 'no action',
        };
      });
    }
  }

  function getRows(tableName: string): Row[] {
    if (!store.has(tableName)) store.set(tableName, []);
    return store.get(tableName)!;
  }

  function resolveColumnValue(
    ctx: RowContext,
    tableIdent: string | null,
    colIdent: string
  ): any {
    if (tableIdent) {
      const row = ctx.get(tableIdent);
      if (!row) return null;
      const meta = tableMetas.get(tableIdent);
      const prop = meta?.bySqlName.get(colIdent)?.propName || colIdent;
      return row[prop];
    }
    for (const [tName, row] of ctx.entries()) {
      if (!row) continue;
      const meta = tableMetas.get(tName);
      const prop = meta?.bySqlName.get(colIdent)?.propName || colIdent;
      if (prop in row) return row[prop];
    }
    return null;
  }

  function evalSqlExpression(
    sqlText: string,
    params: any[],
    ctx: RowContext,
    groupRows?: RowContext[]
  ): any {
    const tokens = tokenizeSql(sqlText);
    let pos = 0;

    const peek = () => tokens[pos];
    const consume = () => tokens[pos++];
    const matchKeyword = (kw: string) => {
      const t = peek();
      if (t.type === 'ident' && t.value.toUpperCase() === kw.toUpperCase()) {
        pos += 1;
        return true;
      }
      return false;
    };

    function parseOr(): any {
      let left = parseAnd();
      while (matchKeyword('OR')) {
        const right = parseAnd();
        left = Boolean(left) || Boolean(right);
      }
      return left;
    }

    function parseAnd(): any {
      let left = parseNot();
      while (matchKeyword('AND')) {
        const right = parseNot();
        left = Boolean(left) && Boolean(right);
      }
      return left;
    }

    function parseNot(): any {
      if (matchKeyword('NOT')) {
        return !Boolean(parseNot());
      }
      return parseComparison();
    }

    function parseComparison(): any {
      const left = parseAdditive();

      if (matchKeyword('IS')) {
        const isNot = matchKeyword('NOT');
        if (matchKeyword('NULL')) {
          const isNull = left === null || left === undefined;
          return isNot ? !isNull : isNull;
        }
      }

      let negated = false;
      if (matchKeyword('NOT')) {
        negated = true;
      }

      if (matchKeyword('IN')) {
        consume(); // '('
        const items: any[] = [];
        if (peek().value !== ')') {
          items.push(parseOr());
          while (peek().value === ',') {
            consume();
            items.push(parseOr());
          }
        }
        if (peek().value === ')') consume();
        const found = items.some((item) => valuesEqual(left, item));
        return negated ? !found : found;
      }

      if (matchKeyword('ILIKE')) {
        const right = parseAdditive();
        if (left === null || left === undefined || right === null || right === undefined) {
          return false;
        }
        const matched = likeToRegex(String(right), true).test(String(left));
        return negated ? !matched : matched;
      }

      if (matchKeyword('LIKE')) {
        const right = parseAdditive();
        if (left === null || left === undefined || right === null || right === undefined) {
          return false;
        }
        const matched = likeToRegex(String(right), false).test(String(left));
        return negated ? !matched : matched;
      }

      if (negated) {
        // Unexpected NOT without IN/LIKE/ILIKE
        return false;
      }

      const t = peek();
      if (t.type === 'op' && ['=', '!=', '<>', '<', '<=', '>', '>='].includes(t.value)) {
        consume();
        const right = parseAdditive();
        if (t.value === '=') {
          if (left === null || left === undefined || right === null || right === undefined) return false;
          return valuesEqual(left, right);
        }
        if (t.value === '!=' || t.value === '<>') {
          if (left === null || left === undefined || right === null || right === undefined) return true;
          return !valuesEqual(left, right);
        }
        if (left === null || left === undefined || right === null || right === undefined) return false;
        const cmp = compareValues(left, right);
        if (t.value === '<') return cmp < 0;
        if (t.value === '<=') return cmp <= 0;
        if (t.value === '>') return cmp > 0;
        if (t.value === '>=') return cmp >= 0;
      }

      return left;
    }

    function parseAdditive(): any {
      let left = parsePrimary();
      while (peek().type === 'op' && (peek().value === '+' || peek().value === '-')) {
        const op = consume().value;
        const right = parsePrimary();
        left = op === '+' ? Number(left || 0) + Number(right || 0) : Number(left || 0) - Number(right || 0);
      }
      return left;
    }

    function parsePrimary(): any {
      const t = peek();

      if (t.type === 'punct' && t.value === '(') {
        consume();
        const val = parseOr();
        if (peek().value === ')') consume();
        return val;
      }

      if (t.type === 'param') {
        consume();
        return params[Number(t.value) - 1];
      }

      if (t.type === 'string') {
        consume();
        return t.value;
      }

      if (t.type === 'number') {
        consume();
        return Number(t.value);
      }

      if (t.type === 'ident') {
        const upper = t.value.toUpperCase();
        if (upper === 'TRUE') {
          consume();
          return true;
        }
        if (upper === 'FALSE') {
          consume();
          return false;
        }
        if (upper === 'NULL') {
          consume();
          return null;
        }

        // Function call
        if (tokens[pos + 1]?.value === '(') {
          const fnName = consume().value.toLowerCase();
          consume(); // '('
          const rowsForAgg = groupRows || [ctx];

          if (fnName === 'count') {
            if (peek().value === '*') {
              consume();
              if (peek().value === ')') consume();
              return groupRows ? groupRows.length : 1;
            }
            const argSqlIdx = pos;
            let depth = 1;
            while (pos < tokens.length && depth > 0) {
              if (tokens[pos].value === '(') depth += 1;
              else if (tokens[pos].value === ')') depth -= 1;
              if (depth > 0) pos += 1;
            }
            const innerTokens = tokens.slice(argSqlIdx, pos);
            if (peek().value === ')') consume();
            if (innerTokens.length === 0) return rowsForAgg.length;
            let cnt = 0;
            for (const rCtx of rowsForAgg) {
              const v = evalTokenSlice(innerTokens, params, rCtx);
              if (v !== null && v !== undefined) cnt += 1;
            }
            return cnt;
          }

          if (fnName === 'sum' || fnName === 'avg') {
            const start = pos;
            let depth = 1;
            while (pos < tokens.length && depth > 0) {
              if (tokens[pos].value === '(') depth += 1;
              else if (tokens[pos].value === ')') depth -= 1;
              if (depth > 0) pos += 1;
            }
            const innerTokens = tokens.slice(start, pos);
            if (peek().value === ')') consume();

            let total = 0;
            let nonNull = 0;
            for (const rCtx of rowsForAgg) {
              const v = evalTokenSlice(innerTokens, params, rCtx);
              if (v !== null && v !== undefined && !Number.isNaN(Number(v))) {
                total += Number(v);
                nonNull += 1;
              }
            }
            if (nonNull === 0) return null;
            return fnName === 'sum' ? total : total / nonNull;
          }

          const args: any[] = [];
          if (peek().value !== ')') {
            args.push(parseOr());
            while (peek().value === ',') {
              consume();
              args.push(parseOr());
            }
          }
          if (peek().value === ')') consume();

          if (fnName === 'coalesce') {
            return args.find((a) => a !== null && a !== undefined) ?? null;
          }
          if (fnName === 'round') {
            return args[0] === null || args[0] === undefined ? null : Math.round(Number(args[0]));
          }
          if (fnName === 'replace') {
            const src = args[0];
            if (src === null || src === undefined) return src;
            return String(src).split(String(args[1] ?? '')).join(String(args[2] ?? ''));
          }
          if (fnName === 'lower') {
            return args[0] === null || args[0] === undefined ? args[0] : String(args[0]).toLowerCase();
          }
          if (fnName === 'upper') {
            return args[0] === null || args[0] === undefined ? args[0] : String(args[0]).toUpperCase();
          }
          return args[0] ?? null;
        }

        // Qualified identifier "table"."col"
        const first = consume().value;
        if (peek().value === '.') {
          consume();
          const second = consume().value;
          return resolveColumnValue(ctx, first, second);
        }
        return resolveColumnValue(ctx, null, first);
      }

      return null;
    }

    return parseOr();
  }

  function evalTokenSlice(slice: Token[], params: any[], ctx: RowContext): any {
    if (slice.length === 1 && slice[0].type === 'ident') {
      return resolveColumnValue(ctx, null, slice[0].value);
    }
    if (
      slice.length === 3 &&
      slice[0].type === 'ident' &&
      slice[1].value === '.' &&
      slice[2].type === 'ident'
    ) {
      return resolveColumnValue(ctx, slice[0].value, slice[2].value);
    }
    const reconstructed = slice
      .map((t) =>
        t.type === 'ident'
          ? `"${t.value}"`
          : t.type === 'string'
            ? `'${t.value}'`
            : t.type === 'param'
              ? `$${t.value}`
              : t.value
      )
      .join(' ');
    return evalSqlExpression(reconstructed, params, ctx);
  }

  function buildInsertRow(meta: TableMeta, rawValues: Row): Row {
    const row: Row = {};
    for (const col of meta.columns) {
      const provided = rawValues[col.propName];
      if (provided !== undefined) {
        row[col.propName] = cloneValue(provided);
        if (col.isSerial && typeof provided === 'number') {
          const curSeq = sequences.get(meta.tableName) || 0;
          if (provided > curSeq) sequences.set(meta.tableName, provided);
        }
        continue;
      }

      if (col.isSerial) {
        const nextId = (sequences.get(meta.tableName) || 0) + 1;
        sequences.set(meta.tableName, nextId);
        row[col.propName] = nextId;
      } else if (col.defaultFn) {
        row[col.propName] = col.defaultFn();
      } else if (col.hasDefault) {
        if (isSqlObject(col.defaultValue)) {
          row[col.propName] = col.dataType === 'date' ? new Date() : null;
        } else if (col.defaultValue !== undefined) {
          row[col.propName] = cloneValue(col.defaultValue);
        } else {
          row[col.propName] = null;
        }
      } else {
        row[col.propName] = null;
      }
    }
    return row;
  }

  function findConflictRow(meta: TableMeta, candidate: Row, targetProps?: string[]): Row | null {
    const existingRows = getRows(meta.tableName);
    const setsToCheck = targetProps ? [targetProps] : meta.uniqueSets;

    for (const uniqueCols of setsToCheck) {
      const allPresent = uniqueCols.every(
        (prop) => candidate[prop] !== null && candidate[prop] !== undefined
      );
      if (!allPresent) continue;

      const match = existingRows.find((existing) =>
        uniqueCols.every((prop) => valuesEqual(existing[prop], candidate[prop]))
      );
      if (match) return match;
    }
    return null;
  }

  function deleteWithCascade(tableName: string, rowsToDelete: Row[]) {
    if (rowsToDelete.length === 0) return;
    const rows = getRows(tableName);
    const deleteSet = new Set(rowsToDelete);
    store.set(
      tableName,
      rows.filter((r) => !deleteSet.has(r))
    );

    // Cascade / set null on referencing child tables
    for (const childMeta of tableMetas.values()) {
      for (const fk of childMeta.foreignKeys) {
        if (fk.foreignTable !== tableName) continue;
        const childRows = getRows(childMeta.tableName);
        if (fk.onDelete === 'cascade') {
          const matchingChildren = childRows.filter((cr) =>
            rowsToDelete.some((pr) =>
              fk.localCols.every((lc, idx) => valuesEqual(cr[lc], pr[fk.foreignCols[idx]]))
            )
          );
          if (matchingChildren.length > 0) {
            deleteWithCascade(childMeta.tableName, matchingChildren);
          }
        } else if (fk.onDelete === 'set null') {
          for (const cr of childRows) {
            const matches = rowsToDelete.some((pr) =>
              fk.localCols.every((lc, idx) => valuesEqual(cr[lc], pr[fk.foreignCols[idx]]))
            );
            if (matches) {
              for (const lc of fk.localCols) {
                cr[lc] = null;
              }
            }
          }
        }
      }
    }
  }

  function makeSelectBuilder(projection?: Record<string, any>) {
    let fromTable: PgTable | null = null;
    const joins: Array<{ type: 'left' | 'inner'; table: PgTable; onExpr: any }> = [];
    let whereExpr: any = null;
    let groupByCols: any[] = [];
    let orderByExprs: any[] = [];
    let limitCount: number | null = null;
    let offsetCount: number = 0;

    const execute = async () => {
      if (!fromTable) return [];
      const baseMeta = registerTable(fromTable);
      const baseRows = getRows(baseMeta.tableName);

      let contexts: RowContext[] = baseRows.map((row) => {
        const ctx: RowContext = new Map();
        ctx.set(baseMeta.tableName, row);
        return ctx;
      });

      for (const j of joins) {
        const jMeta = registerTable(j.table);
        const jRows = getRows(jMeta.tableName);
        const compiled = compileSql(j.onExpr);
        const nextContexts: RowContext[] = [];

        for (const ctx of contexts) {
          let matchedAny = false;
          for (const jRow of jRows) {
            const candidate = new Map(ctx);
            candidate.set(jMeta.tableName, jRow);
            if (evalSqlExpression(compiled.sql, compiled.params, candidate)) {
              nextContexts.push(candidate);
              matchedAny = true;
            }
          }
          if (!matchedAny && j.type === 'left') {
            const emptyCtx = new Map(ctx);
            emptyCtx.set(jMeta.tableName, null);
            nextContexts.push(emptyCtx);
          }
        }
        contexts = nextContexts;
      }

      if (whereExpr) {
        const compiled = compileSql(whereExpr);
        contexts = contexts.filter((ctx) =>
          Boolean(evalSqlExpression(compiled.sql, compiled.params, ctx))
        );
      }

      const hasAggregate =
        projection &&
        Object.values(projection).some((val) => {
          if (!isSqlObject(val) || is(val, PgColumn)) return false;
          const { sql } = compileSql(val);
          return /\b(count|sum|avg)\s*\(/i.test(sql);
        });

      let results: any[] = [];

      if (groupByCols.length > 0 || hasAggregate) {
        const groups = new Map<string, RowContext[]>();

        if (groupByCols.length === 0) {
          groups.set('__all__', contexts);
        } else {
          for (const ctx of contexts) {
            const keyParts = groupByCols.map((col) => {
              if (is(col, PgColumn)) {
                const tName = getTableName(col.table);
                return JSON.stringify(resolveColumnValue(ctx, tName, col.name));
              }
              const compiled = compileSql(col);
              return JSON.stringify(evalSqlExpression(compiled.sql, compiled.params, ctx));
            });
            const gKey = keyParts.join('|');
            const arr = groups.get(gKey) || [];
            arr.push(ctx);
            groups.set(gKey, arr);
          }
        }

        for (const groupRows of groups.values()) {
          const repCtx = groupRows[0] || new Map();
          const rowOut: Row = {};
          for (const [key, val] of Object.entries(projection || {})) {
            if (isTable(val)) {
              const tName = getTableName(val as PgTable);
              const r = repCtx.get(tName);
              rowOut[key] = r ? cloneValue(r) : null;
            } else if (is(val, PgColumn)) {
              const tName = getTableName(val.table);
              rowOut[key] = cloneValue(resolveColumnValue(repCtx, tName, val.name));
            } else if (isSqlObject(val)) {
              const compiled = compileSql(val);
              rowOut[key] = evalSqlExpression(compiled.sql, compiled.params, repCtx, groupRows);
            } else {
              rowOut[key] = val;
            }
          }
          results.push(rowOut);
        }
      } else {
        if (orderByExprs.length > 0) {
          const compiledOrders = orderByExprs.map((expr) => {
            const { sql } = compileSql(expr);
            const isDesc = /\bdesc\s*$/i.test(sql);
            const cleanSql = sql.replace(/\s+(asc|desc)\s*$/i, '').trim();
            return { cleanSql, isDesc };
          });

          contexts = [...contexts].sort((a, b) => {
            for (const ord of compiledOrders) {
              const va = evalSqlExpression(ord.cleanSql, [], a);
              const vb = evalSqlExpression(ord.cleanSql, [], b);
              const cmp = compareValues(va, vb);
              if (cmp !== 0) return ord.isDesc ? -cmp : cmp;
            }
            return 0;
          });
        }

        if (offsetCount > 0) {
          contexts = contexts.slice(offsetCount);
        }
        if (limitCount !== null) {
          contexts = contexts.slice(0, limitCount);
        }

        results = contexts.map((ctx) => {
          if (!projection) {
            if (joins.length === 0) {
              return cloneValue(ctx.get(baseMeta.tableName)!);
            }
            const out: Row = {};
            for (const [tName, r] of ctx.entries()) {
              out[tName] = r ? cloneValue(r) : null;
            }
            return out;
          }
          const out: Row = {};
          for (const [key, val] of Object.entries(projection)) {
            if (isTable(val)) {
              const tName = getTableName(val as PgTable);
              const r = ctx.get(tName);
              out[key] = r ? cloneValue(r) : null;
            } else if (is(val, PgColumn)) {
              const tName = getTableName(val.table);
              out[key] = cloneValue(resolveColumnValue(ctx, tName, val.name));
            } else if (isSqlObject(val)) {
              const compiled = compileSql(val);
              out[key] = evalSqlExpression(compiled.sql, compiled.params, ctx);
            } else {
              out[key] = val;
            }
          }
          return out;
        });
      }

      if ((groupByCols.length > 0 || hasAggregate) && orderByExprs.length > 0) {
        if (limitCount !== null) {
          results = results.slice(0, limitCount);
        }
      }

      return results;
    };

    const builder: any = {
      from(table: PgTable) {
        fromTable = table;
        return builder;
      },
      leftJoin(table: PgTable, onExpr: any) {
        joins.push({ type: 'left', table, onExpr });
        return builder;
      },
      innerJoin(table: PgTable, onExpr: any) {
        joins.push({ type: 'inner', table, onExpr });
        return builder;
      },
      where(expr: any) {
        whereExpr = expr;
        return builder;
      },
      groupBy(...cols: any[]) {
        groupByCols = cols;
        return builder;
      },
      orderBy(...exprs: any[]) {
        orderByExprs = exprs;
        return builder;
      },
      limit(n: number) {
        limitCount = n;
        return builder;
      },
      offset(n: number) {
        offsetCount = n;
        return builder;
      },
      then(onFulfilled: any, onRejected: any) {
        return execute().then(onFulfilled, onRejected);
      },
      catch(onRejected: any) {
        return execute().catch(onRejected);
      },
      finally(onFinally: any) {
        return execute().finally(onFinally);
      },
    };

    return builder;
  }

  function makeInsertBuilder(table: PgTable) {
    const meta = registerTable(table);
    let valuesList: Row[] = [];
    let conflictMode: 'error' | 'nothing' | 'update' = 'error';
    let conflictTargetProps: string[] | undefined;
    let conflictSet: Row | null = null;
    let returnResult = false;

    const execute = async () => {
      const tableRows = getRows(meta.tableName);
      const affected: Row[] = [];

      for (const raw of valuesList) {
        const candidate = buildInsertRow(meta, raw);
        const existing = findConflictRow(meta, candidate, conflictTargetProps);

        if (existing) {
          if (conflictMode === 'nothing') {
            continue;
          }
          if (conflictMode === 'update' && conflictSet) {
            const ctx: RowContext = new Map([[meta.tableName, existing]]);
            for (const [k, v] of Object.entries(conflictSet)) {
              if (v === undefined) continue;
              if (isSqlObject(v)) {
                const compiled = compileSql(v);
                existing[k] = evalSqlExpression(compiled.sql, compiled.params, ctx);
              } else {
                existing[k] = cloneValue(v);
              }
            }
            affected.push(cloneValue(existing));
            continue;
          }
          const err: any = new Error(`duplicate key value violates unique constraint on ${meta.tableName}`);
          err.code = '23505';
          throw err;
        }

        tableRows.push(candidate);
        affected.push(cloneValue(candidate));
      }

      return returnResult ? affected : undefined;
    };

    const resolveTargetProps = (target: any): string[] | undefined => {
      if (!target) return undefined;
      const arr = Array.isArray(target) ? target : [target];
      return arr.map((col: any) => {
        if (is(col, PgColumn)) {
          return meta.bySqlName.get(col.name)?.propName || col.name;
        }
        return String(col);
      });
    };

    const builder: any = {
      values(vals: Row | Row[]) {
        valuesList = Array.isArray(vals) ? vals : [vals];
        return builder;
      },
      onConflictDoNothing(opts?: { target?: any }) {
        conflictMode = 'nothing';
        conflictTargetProps = resolveTargetProps(opts?.target);
        return builder;
      },
      onConflictDoUpdate(opts: { target: any; set: Row }) {
        conflictMode = 'update';
        conflictTargetProps = resolveTargetProps(opts.target);
        conflictSet = opts.set;
        return builder;
      },
      returning() {
        returnResult = true;
        return builder;
      },
      then(onFulfilled: any, onRejected: any) {
        return execute().then(onFulfilled, onRejected);
      },
      catch(onRejected: any) {
        return execute().catch(onRejected);
      },
      finally(onFinally: any) {
        return execute().finally(onFinally);
      },
    };

    return builder;
  }

  function makeUpdateBuilder(table: PgTable) {
    const meta = registerTable(table);
    let setValues: Row = {};
    let whereExpr: any = null;
    let returnResult = false;

    const execute = async () => {
      const tableRows = getRows(meta.tableName);
      const compiledWhere = whereExpr ? compileSql(whereExpr) : null;
      const updatedRows: Row[] = [];

      for (const row of tableRows) {
        const ctx: RowContext = new Map([[meta.tableName, row]]);
        if (compiledWhere && !evalSqlExpression(compiledWhere.sql, compiledWhere.params, ctx)) {
          continue;
        }
        for (const [k, v] of Object.entries(setValues)) {
          if (v === undefined) continue;
          if (isSqlObject(v)) {
            const compiledSet = compileSql(v);
            row[k] = evalSqlExpression(compiledSet.sql, compiledSet.params, ctx);
          } else {
            row[k] = cloneValue(v);
          }
        }
        updatedRows.push(cloneValue(row));
      }

      return returnResult ? updatedRows : undefined;
    };

    const builder: any = {
      set(vals: Row) {
        setValues = vals;
        return builder;
      },
      where(expr: any) {
        whereExpr = expr;
        return builder;
      },
      returning() {
        returnResult = true;
        return builder;
      },
      then(onFulfilled: any, onRejected: any) {
        return execute().then(onFulfilled, onRejected);
      },
      catch(onRejected: any) {
        return execute().catch(onRejected);
      },
      finally(onFinally: any) {
        return execute().finally(onFinally);
      },
    };

    return builder;
  }

  function makeDeleteBuilder(table: PgTable) {
    const meta = registerTable(table);
    let whereExpr: any = null;
    let returnResult = false;

    const execute = async () => {
      const tableRows = getRows(meta.tableName);
      const compiledWhere = whereExpr ? compileSql(whereExpr) : null;
      const toDelete = compiledWhere
        ? tableRows.filter((row) =>
            Boolean(
              evalSqlExpression(
                compiledWhere.sql,
                compiledWhere.params,
                new Map([[meta.tableName, row]])
              )
            )
          )
        : [...tableRows];

      const snapshot = toDelete.map((r) => cloneValue(r));
      deleteWithCascade(meta.tableName, toDelete);
      return returnResult ? snapshot : undefined;
    };

    const builder: any = {
      where(expr: any) {
        whereExpr = expr;
        return builder;
      },
      returning() {
        returnResult = true;
        return builder;
      },
      then(onFulfilled: any, onRejected: any) {
        return execute().then(onFulfilled, onRejected);
      },
      catch(onRejected: any) {
        return execute().catch(onRejected);
      },
      finally(onFinally: any) {
        return execute().finally(onFinally);
      },
    };

    return builder;
  }

  const dbApi: any = {
    select(projection?: Record<string, any>) {
      return makeSelectBuilder(projection);
    },
    insert(table: PgTable) {
      return makeInsertBuilder(table);
    },
    update(table: PgTable) {
      return makeUpdateBuilder(table);
    },
    delete(table: PgTable) {
      return makeDeleteBuilder(table);
    },
    async transaction<T>(fn: (tx: any) => Promise<T>): Promise<T> {
      const storeSnapshot: TableStore = new Map();
      for (const [k, rows] of store.entries()) {
        storeSnapshot.set(
          k,
          rows.map((r) => cloneValue(r))
        );
      }
      const seqSnapshot = new Map(sequences);
      try {
        return await fn(dbApi);
      } catch (err) {
        store.clear();
        for (const [k, rows] of storeSnapshot.entries()) {
          store.set(k, rows);
        }
        sequences.clear();
        for (const [k, v] of seqSnapshot.entries()) {
          sequences.set(k, v);
        }
        throw err;
      }
    },
  };

  const mockPool: any = {
    query: async () => ({ rows: [{ ok: 1 }] }),
    connect: async () => ({
      query: async () => ({ rows: [{ ok: 1 }] }),
      release: () => {},
    }),
    end: async () => {},
    on: () => {},
  };

  return { db: dbApi, pool: mockPool };
}
