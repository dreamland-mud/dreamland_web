# DreamLand help MCP server

Public, read-only [MCP](https://modelcontextprotocol.io) server over the DreamLand help corpus: the same articles as https://dreamland.rocks/help.html, in English, Russian and Ukrainian.

Endpoint: `https://dreamland.rocks/mcp/help` (Streamable HTTP, no auth).

```bash
claude mcp add --transport http dreamland-help https://dreamland.rocks/mcp/help
```

Claude Desktop / claude.ai: Settings -> Connectors -> Add custom connector, URL as above.

## Tools

- `help_search(query, lang, limit)`: ids, titles, kinds and an excerpt. Same ranking as the site and the game client (`static/site/js/helpsearch.js`). A leading facet word narrows it: `spell fire`, `race elf`. A phrase that matches nothing as a whole falls back to its words.
- `help_get(id | keyword, lang)`: the article as Markdown with links to the site, plus See also. A keyword several articles share returns the list to pick from.
- `help_categories(lang)`, `help_list(category, kind, lang)`: browse.
- `item_search(type, query, level_min, level_max, slot, weapon_class, magic_type, stats, align, include_limited, sort, lang, limit)`: armor, weapons, magic items or pets with stats, who may use them, zone and the mob or room they come from. Same data and filters as https://dreamland.rocks/searcher.html (shared `static/site/js/itemsearch.js`); no vnums, limited items marked.

`lang` is `en`, `ru` or `ua` (`uk` works too). Untranslated text falls back to Russian, like the game.

## Data and freshness

Reads `static/data/help-index.json` and `help-body-{ru,en,ua}.json`, which `site.js/build-help.js` writes from the game's dump, and re-reads them when the index changes. The dump is rendered for a level-1 character, so nothing immortal-only or level-gated is served. A help edit reaches the server as: content deploy -> `plug reload web` (or the hourly dump) -> site data build (drone, or the 30-minute timer).

Items come from `static/data/db_{armor,weapon,magic,pets}.json`: `searcher.cpp` dumps them to `/tmp` at boot and every 4 hours, drone copies them here. Only items placed by zone resets, outside clan and hidden zones, are in them; noident items show no stats. Each file is re-read when it changes.

## Running

```bash
npm install
PORT=8003 HELP_DATA=../static/data node server.js
HELP_DATA=/path/to/data npm test              # starts the server and calls every tool
node test.js https://dreamland.rocks/mcp/help  # same checks against a running server
```

Live: `dreamland-help-mcp.service` (copy in this directory) on 127.0.0.1:8003, nginx `location /mcp/help` with a 5 r/s per-IP limit (`nginx.conf` here). Drone runs `npm install` on every deploy; the server exits when its own files change and systemd restarts it on the new code.
