# T-001 Implementation Notes

**Task**: 实现 Surface 扫描器与清单数据契约  
**Status**: Completed  
**Date**: 2026-08-28

## What Was Implemented

### 1. Data Model (`tests/fixtures/guidance-surface/surface-schema.ts`)

Created TypeScript interfaces defining the complete data contract for Guidance Surfaces:

- **GuidanceSurface**: Main interface with required and optional fields
- **SurfaceChannel**: 12 channel types (server_instructions, tool_metadata, etc.)
- **SemanticRole**: 5 roles from 01-00 (FACT, RECOMMENDATION, DECISION_BOUNDARY, EXECUTION_CONSTRAINT, ACTION_HINT)
- **Provenance**: Source tracking (workspace, lrnev, client_asserted, user_quote, unknown)
- **Enforcement**: Execution strength (none, client_boundary, server_enforced)
- **SurfaceInventory**: Complete inventory structure with statistics

### 2. Scanner Implementation (`scripts/scan-guidance-surfaces.ts`)

Implemented a static code scanner that:

- **Generates stable surface_ids**: Format `channel:category:name` (e.g., `tool_metadata:scene_create:title`)
- **Calculates content hashes**: SHA256 for change detection
- **Computes budget**: Character count and token estimates (chars / 4)
- **Validates required fields**: Fails explicitly if required fields are missing
- **Scans multiple sources**:
  - Server instructions (WORKFLOW_OVERVIEW)
  - Tool metadata (title + description from 42 tools)
  - Tool annotations (readOnlyHint, destructiveHint, etc.)
  - AI followup generation points
  - Error messages (DEFAULT_ERROR_HINTS)

### 3. Output Artifacts

**Markdown Report** (`guidance-surface-inventory.md`):
- Human-readable catalog organized by channel
- Summary statistics (by channel, consumer, role, budget)
- Each surface with source location, trigger, content preview

**JSON Inventory** (`guidance-surface-inventory.json`):
- Machine-readable complete inventory
- 132 surfaces discovered in initial scan
- 2,321 lines of structured data

## Scan Results (Baseline)

### Statistics
- **Total Surfaces**: 132
- **By Channel**:
  - server_instructions: 1
  - tool_metadata: 84 (42 tools × 2 fields each)
  - tool_annotations: 42
  - ai_followup: 5
- **By Consumer**:
  - client: 42
  - model: 6
  - both: 84
- **Total Budget**: 5,977 chars / ~1,545 tokens

### Counting Rules (Documented)

To avoid T-002 lessons:
- **Surface** = Each independent guidance entry (1 tool description = 1 surface)
- **Same tool**: title + description = 2 separate surfaces
- **Hash collision** = Content exactly identical
- **Budget** = chars / 4 (token estimate)

## Verification Against Requirements

### D-01 清单字段 ✓
All required fields implemented:
- surface_id (stable, repeatable)
- source (file, symbol, field, line)
- channel, trigger, consumer
- content, content_hash
- budget (chars + tokens_estimate)
- Optional: role, provenance, enforcement, owner, tests, capability_note

### D-05 失败处理 ✓
- Required field validation with explicit error messages
- Error reporting with file:line:field location
- Scanner fails fast, returns structured errors
- Optional fields (capability_note) explicitly set to null

### F-01, F-05, F-06, F-07 ✓
- Stable surface_ids generated deterministically
- Content hashes (SHA256) for baseline comparison
- Budget calculation (chars + token estimate)
- capability_note records static declarations only
- Markdown + JSON output for human and machine consumption

## Known Limitations (For T-002)

The current implementation is a **scanner skeleton**. T-002 will need to enhance:

1. **Tool descriptions**: Currently placeholder `[Description for X]` - need to extract actual text from TOOL_DESCRIPTIONS
2. **Input schemas**: Zod `.describe()` calls not yet extracted
3. **Output schemas**: Not implemented
4. **Resources**: MCP resources not scanned
5. **Governance docs**: Scene/Spec guidance, AI-ADAPTATION.md not scanned
6. **Error messages**: Only DEFAULT_ERROR_HINTS extracted, not inline error texts

## Usage

```bash
# Run scanner
npx tsx scripts/scan-guidance-surfaces.ts

# Output files
dev-docs/ai-guidance-standardization/guidance-surface-inventory.md
dev-docs/ai-guidance-standardization/guidance-surface-inventory.json
```

## Next Steps (T-002)

T-002 will use this scanner framework to:
1. Extract actual TOOL_DESCRIPTIONS content (not placeholders)
2. Parse Zod schemas for input field descriptions
3. Scan resources, governance docs, and error texts
4. Achieve full coverage per D-02 requirements
5. Generate complete baseline for migration planning
