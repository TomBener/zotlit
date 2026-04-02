import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { loadCatalog } from "../../src/catalog.js";

test("loadCatalog keeps attachments inside root and marks only pdf as supported", () => {
  const root = mkdtempSync(join(tmpdir(), "zotlit-catalog-"));
  const attachmentsRoot = join(root, "attachments");
  mkdirSync(join(attachmentsRoot, "papers"), { recursive: true });
  const pdfPath = join(attachmentsRoot, "papers", "paper.pdf");
  const epubPath = join(attachmentsRoot, "papers", "book.epub");
  writeFileSync(pdfPath, "pdf");
  writeFileSync(epubPath, "epub");

  const bibliographyPath = join(root, "bibliography.json");
  writeFileSync(
    bibliographyPath,
    JSON.stringify([
      {
        id: "citekey",
        title: "Paper",
        author: [{ family: "Smith", given: "Jane" }],
        issued: { "date-parts": [[2024]] },
        "container-title": "Journal of Testing",
        file: `${pdfPath};${epubPath};/tmp/outside.pdf`,
        type: "article-journal",
        "zotero-item-key": "ITEM1",
      },
    ]),
    "utf-8",
  );

  const catalog = loadCatalog({
    bibliographyJsonPath: bibliographyPath,
    attachmentsRoot,
    dataDir: join(root, "data"),
    warnings: [],
  });

  assert.equal(catalog.records.length, 1);
  assert.deepEqual(catalog.records[0]?.authorSearchTexts, ["Smith Jane", "Jane Smith"]);
  assert.equal(catalog.records[0]?.journal, "Journal of Testing");
  assert.deepEqual(catalog.records[0]?.supportedPdfFiles, [pdfPath]);
  assert.equal(catalog.records[0]?.hasSupportedPdf, true);
  assert.equal(catalog.attachments.length, 2);
  assert.equal(catalog.attachments[0]!.supported, false);
  assert.equal(catalog.attachments[0]!.fileExt, "epub");
  assert.equal(catalog.attachments[1]!.supported, true);
  assert.equal(catalog.attachments[1]!.fileExt, "pdf");
});
