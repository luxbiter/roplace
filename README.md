# roplace

Find mesh and texture IDs referenced by public Roblox Marketplace model assets, and download public Roblox asset files by ID.

## Run locally

Requires Node.js 22 or later.

```bash
npm install
npm run dev
```

Open http://localhost:3000. For a production build, run `npm run build` and `npm start`.

## Notes

- Marketplace IDs and underlying file IDs can differ. The lookup reads publicly available XML or binary model files and lists the IDs it finds.
- Private, restricted, and unsupported assets may not return IDs. Not all Marketplace items contain mesh and texture references.
- Downloaded meshes remain in Roblox's native format; the site does not convert them to OBJ or FBX.
- Requests are limited to 25 MB per file. No Roblox login or cookie is required.
