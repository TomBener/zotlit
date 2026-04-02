# zotlit

`zotlit` is a Zotero CLI for AI agents.

It focuses on a small set of tasks:

- add a Zotero item and return its `itemKey`
- index local Zotero PDFs
- search indexed PDFs
- search bibliography metadata
- read or expand local passages by `itemKey` or file

## Features

- `add`
  Create a Zotero item from DOI metadata or basic fields.
- `sync`
  Build or refresh the local PDF index.
- `search`
  Search indexed PDFs with default search or `--exact` lexical search.
- `metadata`
  Search bibliography metadata without running `sync`.
- `read` / `expand`
  Read blocks from local manifests and expand around a hit.

Current scope:

- PDF only
- local indexing and search
- Zotero Web API writes for item creation

## Requirements

- Node.js `22+`
- JDK `11+`

Notes:

- `sync` uses Java during PDF extraction
- qmd may prepare local models on first use

## Install

From source:

```bash
npm install
npm run build
node dist/cli.js help
```

## Config

Default config file:

- `~/.zotlit/config.json`

Minimal example:

```json
{
  "bibliographyJsonPath": "~/Library/CloudStorage/Dropbox/bibliography/bibliography.json",
  "attachmentsRoot": "~/Library/Mobile Documents/com~apple~CloudDocs/Zotero",
  "dataDir": "~/Library/Mobile Documents/com~apple~CloudDocs/Zotlit",
  "zoteroLibraryId": "<library-id>",
  "zoteroLibraryType": "user",
  "zoteroApiKey": "<api-key>"
}
```

Write config can also come from environment variables:

- `ZOTLIT_ZOTERO_LIBRARY_ID`
- `ZOTLIT_ZOTERO_LIBRARY_TYPE`
- `ZOTLIT_ZOTERO_API_KEY`

For easier migration, `ZOTERO_LIBRARY_ID`, `ZOTERO_LIBRARY_TYPE`, and `ZOTERO_API_KEY` are also accepted.

## Commands

```bash
zotlit sync [--attachments-root <path>]
zotlit status
zotlit version
zotlit add [--doi <doi>] [--title <text>] [--author <name>] [--year <text>] [--publication <text>] [--url <url>] [--url-date <date>] [--item-type <type>]
zotlit search "<text>" [--exact] [--limit <n>] [--min-score <n>] [--rerank | --no-rerank]
zotlit metadata "<text>" [--limit <n>] [--field <field>] [--has-pdf]
zotlit read (--file <path> | --item-key <key>) [--offset-block <n>] [--limit-blocks <n>]
zotlit expand --file <path> --block-start <n> [--block-end <n>] [--radius <n>]
```

## Common Usage

Add by DOI:

```bash
zotlit add --doi "10.1111/dech.70058"
```

Add by fields:

```bash
zotlit add \
  --title "Working Paper Title" \
  --author "Jane Doe" \
  --year 2026 \
  --publication "Working Paper Series" \
  --url "https://example.com/paper" \
  --url-date "2026-04-02"
```

Build or refresh the local index:

```bash
zotlit sync
```

Search indexed PDFs:

```bash
zotlit search "state-owned enterprise governance"
zotlit search "dangwei shuji" --exact
```

Search metadata:

```bash
zotlit metadata "Development and Change" --field journal
```

Read and expand:

```bash
zotlit read --item-key KG326EEI
zotlit expand --file "~/Library/.../paper.pdf" --block-start 10 --radius 2
```

## Notes

- `add` returns `itemKey` immediately, so an agent can cite the item right away.
- New items created by `add` receive the tag `Added by AI Agent`.
- Creating an item in Zotero does not make it instantly searchable in local PDF search. `metadata` depends on your exported bibliography JSON, and PDF search depends on `sync`.
- `journalArticle` items keep `publicationTitle` but do not write `publisher`.

## License

MIT. See [LICENSE](./LICENSE).
