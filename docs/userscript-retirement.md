# Browser Sync Retirement

Pizza Logs no longer uses Tampermonkey, bookmarklets, or open Warmane tabs for
gear and guild-roster data.

- Gear quick looks request Warmane through Pizza Logs when a class avatar is
  hovered, focused, or tapped. Successful snapshots are cached for five minutes.
- Guild roster refreshes run from the authenticated **Refresh from Warmane**
  control on `/admin` and save a durable database snapshot.
- The former browser import APIs and scheduled-task installers have been removed.

## Remove old local automation

Uninstall the **Pizza Logs Warmane Gear Auto Sync** and **Pizza Logs Warmane
Guild Roster Sync** scripts from the browser. Their old update URLs now serve
retired version `2.0.0`, which performs no network requests or background sync
and clears the browser-stored Pizza Logs admin secret.

If the former Windows launchers were installed, remove them with:

```powershell
npm run gear-sync:uninstall-task
npm run guild-roster-sync:uninstall-task
```

These cleanup commands are intentionally retained for existing machines. They
are not part of the current data-refresh architecture.
