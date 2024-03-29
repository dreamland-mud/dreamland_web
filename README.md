# dreamland_web
DreamLand MUD: static web site pages and searcher app.

[![Stand With Ukraine](https://raw.githubusercontent.com/vshymanskyy/StandWithUkraine/main/badges/StandWithUkraine.svg)](https://stand-with-ukraine.pp.ua)
[![Deploy Status](https://drone.dreamland.rocks/api/badges/dreamland-mud/dreamland_web/status.svg)](https://drone.dreamland.rocks/dreamland-mud/dreamland_web)


## Local development

To start searcher app locally on http://localhost:8001, run
```bash
cd searcher.js
npm i
npm run start
```
To generate static HTML pages from templates, run:
```bash
cd website.js
npm i
npm run website /path/to/dreamland/runtime
```

To start simple web server that will serve static content, run these commands from the main `dreamland_web` folder:
```bash
npm i
npm run start
```

Website is now available on http://localhost:8000

## Prerequisites

You will need some source files for the searcher to work:
```
/tmp/db_armor.json
/tmp/db_weapon.json
/tmp/db_magic.json
/tmp/db_pets.json
```
These can be generated by running `searcher dump` command inside your local copy of the [DreamLand MUD server](https://github.com/dreamland-mud/dreamland_code/). Alternatively, you can request samples from the project admins.

You will also need some area files to generate Maps page of the site. You can grab them from the [DreamLand World repo](https://github.com/dreamland-mud/dreamland_world).

To generate News section, the following files are needed:
```
/tmp/news.xml
/tmp/story1.xml
/tmp/story2.xml
```
Again, either run `webdump news`, `webdump story` on your local server, or ask admins for samples.

