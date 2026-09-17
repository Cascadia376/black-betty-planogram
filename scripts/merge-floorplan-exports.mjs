import { readFile, writeFile } from "node:fs/promises";

const [earlierPath, laterPath, outputPath] = process.argv.slice(2);

if (!earlierPath || !laterPath || !outputPath) {
  throw new Error("Usage: node scripts/merge-floorplan-exports.mjs <earlier.json> <later.json> <output.json>");
}

const collections = [
  "stores",
  "storeLayouts",
  "categorySpaces",
  "categorySpaceSections",
  "zones",
  "fixtures",
  "displayClassDefinitions",
  "displayAreas",
  "displayAreaSections",
  "displayAssignments",
  "campaignDisplayAssignments",
];

function parseExport(contents, source) {
  const exportFile = JSON.parse(contents);
  if (exportFile.format !== "black-betty-floorplans" || exportFile.version !== 1 || !exportFile.floorplans) {
    throw new Error(`${source} is not a supported Black Betty floorplan export.`);
  }
  return exportFile;
}

function mergeById(earlierRecords, laterRecords) {
  const merged = new Map();
  for (const record of earlierRecords) {
    if (!record.id) throw new Error("Every floorplan record must have an id.");
    merged.set(record.id, record);
  }
  for (const record of laterRecords) {
    if (!record.id) throw new Error("Every floorplan record must have an id.");
    merged.set(record.id, record);
  }
  return [...merged.values()];
}

function validateCollectionIds(floorplans) {
  for (const collection of collections) {
    const records = floorplans[collection] ?? [];
    if (new Set(records.map((record) => record.id)).size !== records.length) {
      throw new Error(`${collection} contains duplicate IDs after merge.`);
    }
  }
}

function validateReferences(floorplans) {
  const ids = (collection) => new Set((floorplans[collection] ?? []).map((record) => record.id));
  const storeIds = ids("stores");
  const layoutIds = ids("storeLayouts");
  const categorySpaceIds = ids("categorySpaces");
  const displayAreaIds = ids("displayAreas");

  for (const layout of floorplans.storeLayouts) {
    if (!storeIds.has(layout.storeId)) throw new Error(`Layout ${layout.id} references a missing store.`);
  }
  for (const space of floorplans.categorySpaces) {
    if (!storeIds.has(space.storeId) || !layoutIds.has(space.layoutId)) throw new Error(`Category space ${space.id} has a missing store or layout.`);
  }
  for (const section of floorplans.categorySpaceSections) {
    if (!categorySpaceIds.has(section.categorySpaceId)) throw new Error(`Category space section ${section.id} references a missing category space.`);
  }
  for (const displayArea of floorplans.displayAreas) {
    if (!storeIds.has(displayArea.storeId)) throw new Error(`Display area ${displayArea.id} references a missing store.`);
  }
  for (const section of floorplans.displayAreaSections) {
    if (!displayAreaIds.has(section.displayAreaId)) throw new Error(`Display area section ${section.id} references a missing display area.`);
  }
}

const earlier = parseExport(await readFile(earlierPath, "utf8"), earlierPath);
const later = parseExport(await readFile(laterPath, "utf8"), laterPath);
if (new Date(earlier.exportedAt) > new Date(later.exportedAt)) {
  throw new Error("The first export must be the earlier export so the newer file can win conflicts.");
}

const floorplans = Object.fromEntries(
  collections.map((collection) => [collection, mergeById(earlier.floorplans[collection] ?? [], later.floorplans[collection] ?? [])]),
);
validateCollectionIds(floorplans);
validateReferences(floorplans);

const merged = {
  format: "black-betty-floorplans",
  version: 1,
  exportedAt: later.exportedAt,
  mergePolicy: "newer-export-wins; records present in only one export are retained",
  sourceExports: [earlier.exportedAt, later.exportedAt],
  floorplans,
};

await writeFile(outputPath, `${JSON.stringify(merged, null, 2)}\n`);
