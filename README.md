# roplace

Find mesh and texture IDs in public Roblox Marketplace model assets and download original asset files.

Website: https://luxbiter.github.io/roplace/

GitHub Pages serves `index.html` and `favicon.svg` from the `main` branch root. The browser calls the public API at `https://roblox-asset-fetcher.si-le.chatgpt.site`; GitHub Pages itself cannot run server code. The API source and model parser are in `server/api/` and `lib/`.

Only public assets are supported. Items without mesh or texture references return empty results. Files over 25 MB are rejected. Mesh files remain in Roblox's native format.
