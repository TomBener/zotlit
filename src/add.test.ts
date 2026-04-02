import test from "node:test";
import assert from "node:assert/strict";

import { addToZotero } from "./add.js";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
    },
  });
}

test("addToZotero creates a manual item from basic fields", async () => {
  const requests: Array<{ url: string; init?: RequestInit }> = [];
  const fetchMock: typeof fetch = async (input, init) => {
    const url = String(input);
    requests.push({ url, init });

    if (url === "https://api.zotero.org/items/new?itemType=journalArticle") {
      return jsonResponse({
        itemType: "journalArticle",
        title: "",
        creators: [],
        date: "",
        publicationTitle: "",
        url: "",
        accessDate: "",
        tags: [],
        collections: [],
        relations: {},
      });
    }

    if (url === "https://api.zotero.org/users/123456/items") {
      return jsonResponse({
        success: {
          "0": "ABCD2345",
        },
      });
    }

    throw new Error(`Unexpected URL: ${url}`);
  };

  const result = await addToZotero(
    {
      title: "Manual Entry",
      authors: ["Doe, Jane", "Research Center"],
      year: "2026",
      publication: "Journal of Testing",
      url: "https://example.com/article",
      urlDate: "2026-04-02",
    },
    {
      zoteroLibraryId: "123456",
      zoteroLibraryType: "user",
      zoteroApiKey: "secret",
    },
    fetchMock,
  );

  assert.deepEqual(result, {
    itemKey: "ABCD2345",
    title: "Manual Entry",
    itemType: "journalArticle",
    created: true,
    source: "manual",
    warnings: [],
  });

  const createRequest = requests.at(-1);
  assert.ok(createRequest);
  const body = JSON.parse(String(createRequest?.init?.body)) as Array<Record<string, unknown>>;
  assert.equal(body[0]?.title, "Manual Entry");
  assert.equal(body[0]?.date, "2026");
  assert.equal(body[0]?.publicationTitle, "Journal of Testing");
  assert.equal(body[0]?.url, "https://example.com/article");
  assert.equal(body[0]?.accessDate, "2026-04-02");
  assert.deepEqual(body[0]?.tags, [{ tag: "Added by AI Agent" }]);
  assert.deepEqual(body[0]?.creators, [
    {
      creatorType: "author",
      firstName: "Jane",
      lastName: "Doe",
    },
    {
      creatorType: "author",
      firstName: "Research",
      lastName: "Center",
    },
  ]);
});

test("addToZotero falls back to manual fields when DOI lookup fails", async () => {
  const requests: string[] = [];
  const fetchMock: typeof fetch = async (input) => {
    const url = String(input);
    requests.push(url);

    if (url === "https://doi.org/10.1000/missing") {
      return new Response("not found", { status: 404 });
    }
    if (url === "https://api.zotero.org/items/new?itemType=webpage") {
      return jsonResponse({
        itemType: "webpage",
        title: "",
        creators: [],
        date: "",
        websiteTitle: "",
        url: "",
        accessDate: "",
        tags: [],
        collections: [],
        relations: {},
      });
    }
    if (url === "https://api.zotero.org/users/123456/items") {
      return jsonResponse({
        success: {
          "0": "WXYZ6789",
        },
      });
    }

    throw new Error(`Unexpected URL: ${url}`);
  };

  const result = await addToZotero(
    {
      doi: "10.1000/missing",
      title: "Fallback Entry",
      authors: ["Center for History and New Media"],
      url: "https://example.com/fallback",
      urlDate: "2026-04-02",
    },
    {
      zoteroLibraryId: "123456",
      zoteroLibraryType: "user",
      zoteroApiKey: "secret",
    },
    fetchMock,
  );

  assert.equal(result.itemKey, "WXYZ6789");
  assert.equal(result.title, "Fallback Entry");
  assert.equal(result.itemType, "webpage");
  assert.equal(result.created, true);
  assert.equal(result.source, "manual-fallback");
  assert.equal(result.doi, "10.1000/missing");
  assert.match(result.warnings[0] || "", /DOI import failed/);
  assert.deepEqual(requests, [
    "https://doi.org/10.1000/missing",
    "https://api.zotero.org/items/new?itemType=webpage",
    "https://api.zotero.org/users/123456/items",
  ]);
});

test("addToZotero omits publisher for journal articles imported from DOI", async () => {
  const requests: Array<{ url: string; init?: RequestInit }> = [];
  const fetchMock: typeof fetch = async (input, init) => {
    const url = String(input);
    requests.push({ url, init });

    if (url === "https://doi.org/10.1016/j.econmod.2026.107590") {
      return jsonResponse({
        type: "article-journal",
        title: "Imported by DOI",
        publisher: "Elsevier BV",
        "container-title": ["Journal of Testing"],
        issued: { "date-parts": [[2026, 3, 30]] },
        author: [{ family: "Smith", given: "Ada" }],
      });
    }
    if (url === "https://api.zotero.org/items/new?itemType=journalArticle") {
      return jsonResponse({
        itemType: "journalArticle",
        title: "",
        creators: [],
        date: "",
        publicationTitle: "",
        publisher: "",
        url: "",
        accessDate: "",
        DOI: "",
        tags: [],
        collections: [],
        relations: {},
      });
    }
    if (url === "https://api.zotero.org/users/123456/items") {
      return jsonResponse({
        success: {
          "0": "TIME1234",
        },
      });
    }

    throw new Error(`Unexpected URL: ${url}`);
  };

  const result = await addToZotero(
    {
      doi: "10.1016/j.econmod.2026.107590",
    },
    {
      zoteroLibraryId: "123456",
      zoteroLibraryType: "user",
      zoteroApiKey: "secret",
    },
    fetchMock,
  );

  assert.equal(result.itemKey, "TIME1234");
  assert.equal(result.source, "doi");
  assert.deepEqual(result.warnings, []);

  const createRequest = requests.at(-1);
  assert.ok(createRequest);
  const body = JSON.parse(String(createRequest?.init?.body)) as Array<Record<string, unknown>>;
  assert.equal(body[0]?.publicationTitle, "Journal of Testing");
  assert.equal(body[0]?.publisher, "");
  assert.deepEqual(body[0]?.tags, [{ tag: "Added by AI Agent" }]);
});
