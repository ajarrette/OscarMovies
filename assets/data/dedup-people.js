#!/usr/bin/env node
/* eslint-env node */
'use strict';

const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');
const { normalizeNameForComparison } = require('./name-normalization');

const DEFAULT_DB_PATH = path.join(__dirname, 'oscar-movies.db');
const DEFAULT_ALIAS_PATH = path.join(__dirname, 'people-aliases.json');
const DEFAULT_REPORT_DIR = path.join(__dirname, 'reports');

function parseArgs(argv) {
  const args = {
    dbPath: DEFAULT_DB_PATH,
    aliasFile: DEFAULT_ALIAS_PATH,
    reportDir: DEFAULT_REPORT_DIR,
    apply: false,
    limit: null,
    personId: null,
    allowAwardedTargets: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];

    if (arg === '--apply') {
      args.apply = true;
      continue;
    }

    if (arg === '--allow-awarded-targets') {
      args.allowAwardedTargets = true;
      continue;
    }

    if (arg === '--db') {
      const next = argv[i + 1];
      if (!next) {
        throw new Error('Missing value for --db');
      }
      args.dbPath = path.resolve(process.cwd(), next);
      i += 1;
      continue;
    }

    if (arg === '--alias-file') {
      const next = argv[i + 1];
      if (!next) {
        throw new Error('Missing value for --alias-file');
      }
      args.aliasFile = path.resolve(process.cwd(), next);
      i += 1;
      continue;
    }

    if (arg === '--report-dir') {
      const next = argv[i + 1];
      if (!next) {
        throw new Error('Missing value for --report-dir');
      }
      args.reportDir = path.resolve(process.cwd(), next);
      i += 1;
      continue;
    }

    if (arg === '--limit') {
      const next = argv[i + 1];
      if (!next) {
        throw new Error('Missing value for --limit');
      }

      const limit = Number.parseInt(next, 10);
      if (!Number.isFinite(limit) || limit <= 0) {
        throw new Error('--limit must be a positive integer');
      }

      args.limit = limit;
      i += 1;
      continue;
    }

    if (arg === '--person-id') {
      const next = argv[i + 1];
      if (!next) {
        throw new Error('Missing value for --person-id');
      }

      const personId = Number.parseInt(next, 10);
      if (!Number.isFinite(personId) || personId <= 0) {
        throw new Error('--person-id must be a positive integer');
      }

      args.personId = personId;
      i += 1;
      continue;
    }

    throw new Error(`Unknown argument: ${arg}`);
  }

  return args;
}

function loadAliasMap(filePath) {
  if (!fs.existsSync(filePath)) {
    return {
      aliases: new Map(),
      warnings: [`Alias file not found: ${filePath}`],
    };
  }

  const raw = fs.readFileSync(filePath, 'utf8');
  const parsed = JSON.parse(raw);

  if (parsed == null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error(
      'Alias file must be a JSON object of sourceName -> targetName',
    );
  }

  const aliases = new Map();
  const warnings = [];

  for (const [from, to] of Object.entries(parsed)) {
    const fromNormalized = normalizeNameForComparison(from);
    const toNormalized = normalizeNameForComparison(to);

    if (!fromNormalized || !toNormalized) {
      warnings.push(`Skipped blank alias entry: "${from}" -> "${to}"`);
      continue;
    }

    aliases.set(fromNormalized, {
      fromName: from,
      toName: to,
      toNormalized,
    });
  }

  return { aliases, warnings };
}

function discoverPersonReferenceTables(db) {
  const tables = db
    .prepare(
      `
      SELECT name
      FROM sqlite_schema
      WHERE type = 'table'
        AND name NOT LIKE 'sqlite_%'
        AND name != 'people'
      ORDER BY name ASC
    `,
    )
    .all();

  const refs = [];

  for (const { name } of tables) {
    const foreignKeys = db.prepare(`PRAGMA foreign_key_list("${name}")`).all();
    const personForeignKey = foreignKeys.find(
      (fk) => fk.table === 'people' && fk.to === 'id',
    );
    if (!personForeignKey) {
      continue;
    }

    const columns = db.prepare(`PRAGMA table_info("${name}")`).all();
    if (!columns.some((column) => column.name === personForeignKey.from)) {
      continue;
    }

    if (personForeignKey.from !== 'person_id') {
      continue;
    }

    refs.push({
      table: name,
      personColumn: personForeignKey.from,
    });
  }

  return refs;
}

function migrateTableReferences(db, tableName, sourceId, targetId) {
  const selectRows = db.prepare(
    `SELECT rowid AS _rowid FROM "${tableName}" WHERE person_id = ?`,
  );
  const rows = selectRows.all(sourceId);

  if (rows.length === 0) {
    return {
      table: tableName,
      touchedRows: 0,
      updatedRows: 0,
      droppedAsDuplicateRows: 0,
    };
  }

  const updateByRowid = db.prepare(
    `UPDATE "${tableName}" SET person_id = ? WHERE rowid = ?`,
  );
  const deleteByRowid = db.prepare(
    `DELETE FROM "${tableName}" WHERE rowid = ?`,
  );

  let updatedRows = 0;
  let droppedAsDuplicateRows = 0;

  for (const row of rows) {
    try {
      const updateResult = updateByRowid.run(targetId, row._rowid);
      updatedRows += updateResult.changes;
    } catch (err) {
      const message = String(err && err.message ? err.message : err);
      if (!message.includes('SQLITE_CONSTRAINT')) {
        throw err;
      }

      const deleteResult = deleteByRowid.run(row._rowid);
      droppedAsDuplicateRows += deleteResult.changes;
    }
  }

  return {
    table: tableName,
    touchedRows: rows.length,
    updatedRows,
    droppedAsDuplicateRows,
  };
}

function buildTargetQuery(options) {
  if (options.allowAwardedTargets) {
    return `
      SELECT id, name, tmdb_id, wins, nominations
      FROM people
      WHERE tmdb_id IS NOT NULL
      ORDER BY id ASC
    `;
  }

  return `
    SELECT id, name, tmdb_id, wins, nominations
    FROM people
    WHERE tmdb_id IS NOT NULL
      AND COALESCE(wins, 0) = 0
      AND COALESCE(nominations, 0) = 0
    ORDER BY id ASC
  `;
}

function buildSourceQuery(options) {
  if (options.personId != null) {
    return {
      query: `
        SELECT id, name, tmdb_id, wins, nominations
        FROM people
        WHERE tmdb_id IS NULL
          AND id = ?
      `,
      params: [options.personId],
    };
  }

  if (options.limit != null) {
    return {
      query: `
        SELECT id, name, tmdb_id, wins, nominations
        FROM people
        WHERE tmdb_id IS NULL
        ORDER BY id ASC
        LIMIT ?
      `,
      params: [options.limit],
    };
  }

  return {
    query: `
      SELECT id, name, tmdb_id, wins, nominations
      FROM people
      WHERE tmdb_id IS NULL
      ORDER BY id ASC
    `,
    params: [],
  };
}

function chooseMergeTarget(source, targets, aliasMap, allTmdbTargets) {
  const sourceNormalized = normalizeNameForComparison(source.name);

  if (!sourceNormalized) {
    return {
      outcome: 'unmatched',
      reason: 'empty-source-name',
    };
  }

  const aliasHit = aliasMap.get(sourceNormalized);
  if (aliasHit) {
    const aliasTargets = targets.filter(
      (target) => target.normalizedName === aliasHit.toNormalized,
    );

    const fallbackAliasTargets =
      aliasTargets.length === 0
        ? allTmdbTargets.filter(
            (target) => target.normalizedName === aliasHit.toNormalized,
          )
        : [];
    const resolvedAliasTargets =
      aliasTargets.length > 0 ? aliasTargets : fallbackAliasTargets;

    if (resolvedAliasTargets.length === 1) {
      return {
        outcome: 'merge',
        reason: aliasTargets.length > 0 ? 'alias' : 'alias-awarded-target',
        target: resolvedAliasTargets[0],
        score: 1,
      };
    }

    if (resolvedAliasTargets.length > 1) {
      return {
        outcome: 'ambiguous',
        reason: 'alias-multiple-targets',
        candidates: resolvedAliasTargets.map((target) => ({
          id: target.id,
          name: target.name,
          tmdb_id: target.tmdb_id,
          score: 1,
          method: 'alias',
        })),
      };
    }

    return {
      outcome: 'unmatched',
      reason: 'alias-target-missing',
      aliasTargetName: aliasHit.toName,
    };
  }

  return {
    outcome: 'unmatched',
    reason: 'no-alias-match',
  };
}

function ensurePeopleColumns(db) {
  const columns = db
    .prepare('PRAGMA table_info(people)')
    .all()
    .map((column) => column.name);

  const required = ['tmdb_id', 'wins', 'nominations'];
  const missing = required.filter((name) => !columns.includes(name));
  if (missing.length > 0) {
    throw new Error(`Missing required people columns: ${missing.join(', ')}`);
  }
}

function toAwardCount(value) {
  return Number.isFinite(value) ? value : 0;
}

function run() {
  const options = parseArgs(process.argv.slice(2));

  const db = new Database(options.dbPath);
  db.pragma('foreign_keys = ON');
  db.pragma('journal_mode = WAL');

  const now = new Date();
  const reportBase = now.toISOString().replace(/[:.]/g, '-');

  try {
    ensurePeopleColumns(db);

    const aliasData = loadAliasMap(options.aliasFile);

    const targetRows = db.prepare(buildTargetQuery(options)).all();
    const allTmdbTargetRows = db
      .prepare(
        `
        SELECT id, name, tmdb_id, wins, nominations
        FROM people
        WHERE tmdb_id IS NOT NULL
        ORDER BY id ASC
      `,
      )
      .all();
    const sourceQuery = buildSourceQuery(options);
    const sourceRows = db.prepare(sourceQuery.query).all(...sourceQuery.params);

    const targets = targetRows.map((row) => ({
      ...row,
      normalizedName: normalizeNameForComparison(row.name),
    }));
    const allTmdbTargets = allTmdbTargetRows.map((row) => ({
      ...row,
      normalizedName: normalizeNameForComparison(row.name),
    }));

    const merges = [];
    const ambiguous = [];
    const unmatched = [];

    for (const source of sourceRows) {
      const selected = chooseMergeTarget(
        source,
        targets,
        aliasData.aliases,
        allTmdbTargets,
      );

      if (selected.outcome === 'merge') {
        if (selected.target.id === source.id) {
          unmatched.push({
            source_id: source.id,
            source_name: source.name,
            reason: 'source-target-same-id',
          });
          continue;
        }

        merges.push({
          source_id: source.id,
          source_name: source.name,
          source_wins: toAwardCount(source.wins),
          source_nominations: toAwardCount(source.nominations),
          target_id: selected.target.id,
          target_name: selected.target.name,
          target_tmdb_id: selected.target.tmdb_id,
          target_wins: toAwardCount(selected.target.wins),
          target_nominations: toAwardCount(selected.target.nominations),
          combined_wins:
            toAwardCount(source.wins) + toAwardCount(selected.target.wins),
          combined_nominations:
            toAwardCount(source.nominations) +
            toAwardCount(selected.target.nominations),
          method: selected.reason,
          score: Number(selected.score.toFixed(6)),
        });
        continue;
      }

      if (selected.outcome === 'ambiguous') {
        ambiguous.push({
          source_id: source.id,
          source_name: source.name,
          reason: selected.reason,
          candidates: selected.candidates,
        });
        continue;
      }

      unmatched.push({
        source_id: source.id,
        source_name: source.name,
        reason: selected.reason,
        alias_target_name: selected.aliasTargetName ?? null,
      });
    }

    const refs = discoverPersonReferenceTables(db);

    const report = {
      timestamp: now.toISOString(),
      mode: options.apply ? 'apply' : 'dry-run',
      options: {
        dbPath: options.dbPath,
        aliasFile: options.aliasFile,
        reportDir: options.reportDir,
        limit: options.limit,
        personId: options.personId,
        allowAwardedTargets: options.allowAwardedTargets,
      },
      aliasWarnings: aliasData.warnings,
      discoveredReferenceTables: refs.map((ref) => ref.table),
      summary: {
        sourceCandidates: sourceRows.length,
        targetCandidates: targetRows.length,
        plannedMerges: merges.length,
        ambiguous: ambiguous.length,
        unmatched: unmatched.length,
      },
      plannedMerges: merges,
      ambiguous,
      unmatched,
      applyResults: null,
    };

    if (options.apply) {
      const mergeBySourceId = new Map();
      for (const merge of merges) {
        mergeBySourceId.set(merge.source_id, merge);
      }

      const deletePerson = db.prepare(
        'DELETE FROM people WHERE id = ? AND tmdb_id IS NULL',
      );
      const updateAwardsOnTarget = db.prepare(
        `
        UPDATE people
        SET
          wins = ?,
          nominations = ?
        WHERE id = ?
          AND tmdb_id IS NOT NULL
      `,
      );

      const applyResults = {
        merged: [],
        transferredWins: 0,
        transferredNominations: 0,
        foreignKeyViolations: 0,
      };

      const tx = db.transaction(() => {
        for (const merge of merges) {
          const tableUpdates = [];

          for (const ref of refs) {
            const result = migrateTableReferences(
              db,
              ref.table,
              merge.source_id,
              merge.target_id,
            );
            tableUpdates.push(result);
          }

          const winsToTransfer = toAwardCount(merge.source_wins);
          const nominationsToTransfer = toAwardCount(merge.source_nominations);
          const combinedWins = toAwardCount(merge.combined_wins);
          const combinedNominations = toAwardCount(merge.combined_nominations);

          const targetUpdate = updateAwardsOnTarget.run(
            combinedWins,
            combinedNominations,
            merge.target_id,
          );
          if (targetUpdate.changes !== 1) {
            throw new Error(
              `Failed to update target person ${merge.target_id} during merge`,
            );
          }

          const deleteResult = deletePerson.run(merge.source_id);
          if (deleteResult.changes !== 1) {
            throw new Error(
              `Failed to delete source person ${merge.source_id} after rewiring references`,
            );
          }

          applyResults.transferredWins += winsToTransfer;
          applyResults.transferredNominations += nominationsToTransfer;

          applyResults.merged.push({
            ...merge,
            target_wins_after: combinedWins,
            target_nominations_after: combinedNominations,
            transferred_wins: winsToTransfer,
            transferred_nominations: nominationsToTransfer,
            sourceDeleted: true,
            tableUpdates,
          });
        }

        const fkViolations = db.prepare('PRAGMA foreign_key_check').all();
        applyResults.foreignKeyViolations = fkViolations.length;
        applyResults.foreignKeyViolationRows = fkViolations;

        if (fkViolations.length > 0) {
          throw new Error('Foreign key violations detected after merge');
        }
      });

      tx();

      for (const merged of applyResults.merged) {
        const sourcePlan = mergeBySourceId.get(merged.source_id);
        if (sourcePlan) {
          sourcePlan.applied = true;
        }
      }

      report.applyResults = applyResults;
    }

    fs.mkdirSync(options.reportDir, { recursive: true });
    const reportPath = path.join(
      options.reportDir,
      `people-dedupe-report-${reportBase}.json`,
    );

    fs.writeFileSync(
      reportPath,
      `${JSON.stringify(report, null, 2)}\n`,
      'utf8',
    );

    console.log(`Mode: ${report.mode}`);
    console.log(`DB: ${options.dbPath}`);
    console.log(`Sources considered: ${report.summary.sourceCandidates}`);
    console.log(`Targets considered: ${report.summary.targetCandidates}`);
    console.log(`Planned merges: ${report.summary.plannedMerges}`);
    console.log(`Ambiguous: ${report.summary.ambiguous}`);
    console.log(`Unmatched: ${report.summary.unmatched}`);

    if (!options.apply) {
      console.log(
        'Dry run complete. Re-run with --apply to mutate the database.',
      );
    } else {
      const mergedCount = report.applyResults
        ? report.applyResults.merged.length
        : 0;
      console.log(`Applied merges: ${mergedCount}`);
      const fkViolations = report.applyResults
        ? report.applyResults.foreignKeyViolations
        : 'n/a';
      console.log(`Foreign key violations: ${fkViolations}`);
    }

    if (report.aliasWarnings.length > 0) {
      console.log('Alias warnings:');
      for (const warning of report.aliasWarnings) {
        console.log(`  - ${warning}`);
      }
    }

    console.log(`Report: ${reportPath}`);
  } finally {
    db.close();
  }
}

try {
  run();
} catch (err) {
  console.error(err.message);
  process.exit(1);
}
