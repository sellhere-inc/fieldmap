# Sell Here — Field Map

A standalone map for logging where our contacts are: **farmers, buyers and warehouses**.
Points are plotted on a dark Mapbox map with a satellite toggle; tapping one opens its
details.

This is **not** part of the Sell Here product. Its farmers are deliberately not the app's
farmers, it has its own tables, and nothing it does can change how the Expo app, `admin/`
or `website/` behave. See the header of `../supabase/delta-07-field-map.sql` for how that
isolation is guaranteed.

## What gets recorded

| Kind | Fields |
| --- | --- |
| Farmer | name, crops cultivated (each with an optional average yield), remarks |
| Buyer | name, remarks |
| Warehouse | name, remarks |

Crop names are free text with autocomplete drawn from crops already entered — the
catalogue in `public.crops` is deliberately not referenced, so this app stays independent
and can record things the catalogue does not carry. Average yield is free text too,
because real answers look like "~200 nuts per tree" or "2-3 quintal in season".

Every kind also has a **Visit status**: **Met** or **Planned — yet to meet**.
Planned contacts keep their own remarks and can have crops recorded if known.
Existing contacts default to Met.

| Kind | Met pin | Planned pin |
| --- | --- | --- |
| Farmer | Green | Light green |
| Buyer | Blue | Light blue |
| Warehouse | Orange | Light orange |

Planned pins, their labels, and expanded details have dotted outlines.
The top filters show only each type's darker met color.

## Setup

```bash
cd fieldmap
cp .env.example .env     # fill in the anon key and a Mapbox public token
npm install
npm run dev              # http://localhost:5174
```

Before deploying this version, run `supabase/delta-08-field-map-planned-visits.sql`
in the Supabase SQL editor after `delta-07-field-map.sql`. It adds the visit status
column, defaults existing records to Met, and keeps the existing membership policies.

Node 22 (`.nvmrc` at the repo root) — Vite 7 will not run on 18.

You need a **Mapbox public token** (starts with `pk.`) from
[account.mapbox.com/access-tokens](https://account.mapbox.com/access-tokens/). It is free
up to 50,000 map loads a month. Without it the app renders a setup card instead of a map.
Once deployed, restrict the token to your site's URL in the Mapbox dashboard.

## Granting someone access

Access is an allowlist (`public.field_members`), not a role — two manual steps:

1. **Supabase dashboard → Authentication → Users → Add user.** Set an email and password,
   and **leave the user metadata box empty.** This matters: the product's
   `on_auth_user_created` trigger creates a `public.profiles` row for every new auth user.
   With empty metadata that row has `full_name` and `phone` set to null, and
   `find_farmers()` matches those columns with `ILIKE` — `null ilike '%x%'` is never true —
   so the account can never surface in a wholesaler's farmer search. Fill the metadata in
   and it *will* show up inside the product as a farmer with no crops.

2. Add them to the allowlist in the SQL editor:

   ```sql
   insert into public.field_members (user_id, label)
   select id, 'Ron' from auth.users where email = 'ron@example.com'
   on conflict (user_id) do nothing;
   ```

To revoke, delete the row. Their login keeps working everywhere else; they just stop
seeing the map.

## Using it

New pins default to **Buyer** and **Planned — yet to meet**. Both can be changed
in the form; editing an existing pin retains its saved type and visit status.

- **Saved Google Maps link** — add an optional Google Maps link in the location
  form. Bare domains such as `example.com` and links without `www` are accepted;
  missing protocols default to HTTPS. **Open in Google Maps** uses that link when present and the pin coordinates
  otherwise. Links used to set the pin location are copied into this field automatically.
  You can replace or clear it while editing. Run `migrations/11-pin-google-maps-link.sql`
  in the Supabase SQL editor to enable saving this field.

- **Filter by tags** — open **Filter by tags** on the map or in Field Notes and
  check one or more tags. Pins with any selected tag appear; the others are hidden.
  The selection carries between both views and combines with their existing type,
  visit, or text filters. **Clear tag filter** removes the tag restriction.

- **Pin tags** — while adding or editing a location, select an existing tag or type
  a new one such as Restaurant and press **Create tag** (or Enter). Multiple tags
  are supported; tap a selected tag to remove it. Saving also includes any tag you
  have typed but not yet added. Tags appear in details and Field Notes cards, and
  searching Field Notes includes tags. The shared tag list remains available even
  when a tag is no longer assigned to a pin. Run `migrations/10-pin-tags.sql` in the
  Supabase SQL editor before using tags; existing pins start with no custom tags.

- **General notes** — open the General notes tab to create separate Markdown notes,
  search titles and text, pin notes, edit with Write/Preview, and download `.md` files.
  Use **Save note** to save changes. Notes are shared with all field team members.
  Drafts stay open while switching tabs; closing an unsaved note asks before discarding.
  Before using this feature, run `fieldmap/migrations/09-general-notes.sql` in the
  Supabase SQL editor after `delta-07-field-map.sql`. It creates the notes table with
  the existing field membership access policy. This migration must be applied separately
  from deploying the frontend.

- **Add a point** — tap `+`, enter **Latitude** and **Longitude** or paste a
  **Google Maps link**, then tap **Use this location**. Review the pin and select
  **Continue**. You can also long-press the map or use your current location.
  The same coordinate/link inputs are available when editing an existing location.
  A long press works from anywhere, so you can skip the `+` entirely.
- **Plan a visit** — add a point as above, choose **Planned — yet to meet**, select
  Farmer, Buyer, or Warehouse, and add a name and remarks. Save to keep the plan.
- **After meeting** — open the point, tap **Edit**, switch Visit status to **Met**, and
  save. The pin and outlines update while the name, remarks, location and crops remain.
- **Search** — tap the map’s search bar to open Field notes with search focused. Remarks lead each card, with the contact's
  name and tags below. Search names and remarks, filter by contact/visit tags, or sort by tag,
  planned first, or name. Tap a card for details; Back to list preserves the search
  and scroll position. On phones the list and its details fill the screen as a page;
  desktop uses a left sidebar. Back to map returns to the map, and browser Back works
  between map and list. The list uses existing records and needs no extra migration.
- **Filter** — the chips top-left toggle each kind on and off; the number is how many exist.
- **Satellite** — the button top-right swaps the basemap.
- **Edit or delete** — tap a marker, then use the buttons at the bottom of the sheet.

Browser geolocation is blocked on insecure origins, so **Use my location** only works on
`localhost` or the deployed HTTPS site — not over `http://<lan-ip>` from a phone.

## Deploying

The frontend builds to static files. Short Google Maps links (`maps.app.goo.gl` and
`goo.gl/maps`) use `netlify/functions/resolve-map-link.mjs`, which is deployed with
Netlify and also runs through the Vite dev/preview middleware. Other hosting providers
need an equivalent `/api/resolve-map-link` endpoint for short links. Full coordinate
links and manually entered coordinates need no server. Links containing only a place
name or ID ask for pin coordinates; the app does not substitute the viewport center.

Run `node tests/location-input.test.mjs` to check coordinate validation, Maps URL
parsing, and redirect restrictions.

```bash
npm run build     # -> dist/
```

`netlify.toml` is ready: set `fieldmap` as the base directory, then add
`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` and `VITE_MAPBOX_TOKEN` as environment
variables. Vite inlines them at build time, so changing one needs a redeploy rather than
a reload. Vercel works the same way with a `fieldmap` root directory.

The bundle is large (~650 kB gzipped) because Mapbox GL is most of it. That is the floor
for a real vector map; it caches after the first load.

## Design

Dark mode is used throughout: map controls, contact lists, forms, login, and
Markdown notes use dark surfaces with high-contrast text. Native inputs and browser
chrome use the dark color scheme. The Satellite button changes the basemap only.

**Fonts.** Poppins for English at the same weights the site loads, with **Anek Malayalam**
next in the stack:

```css
font-family: 'Poppins', 'Anek Malayalam', -apple-system, …;
```

Poppins carries no Malayalam glyphs, so the browser falls through to Anek Malayalam per
character. English and Malayalam can therefore sit in the same field — a farmer name or a
remark can be typed in either, or both, with no markup and no language toggle.

Animations are off throughout (AGENTS.md item 13). The only keyframes and transitions in
the built CSS come from vendor `mapbox-gl.css`.

## Layout

```
src/
  App.tsx           session, membership gate, and the idle/placing/form state machine
  supabase.ts       client, types, and every read and write
  MapCanvas.tsx     the Mapbox map, markers, style toggle
  useLongPress.ts   long-press on touch, done by hand (see the comment inside)
  PlaceList.tsx     remarks-first searchable contact list and tag sorting
  PlaceSheet.tsx    details for a tapped point
  PlaceForm.tsx     add and edit
  LoginScreen.tsx   email + password
```

There is no router and no state library, matching `admin/`.
