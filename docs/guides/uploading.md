# Uploading a Combat Log

## Before the Raid

Enable advanced combat logging in the WoW client and start logging with `/combatlog`. Pizza Logs targets WotLK 3.3.5a-style logs, especially Warmane Lordaeron.

## Upload

1. Open the Pizza Logs home page.
2. Enter your character name and select the Warmane realm. Guild attribution and completion notifications are optional under **Upload options and file help**.
3. Select `WoWCombatLog.txt`, another `.txt`/`.log` combat log, or a `.zip` containing the log.
4. Keep the tab open while the upload, quick classification, full parse, and save stages complete.
5. Choose **View raid report** after completion. New and duplicate uploads both provide this action; **Upload another** starts a separate upload.

The home page puts uploading before site statistics. **Watch guild intro** opens the optional cinematic; reduced-motion users choose whether to play it. Browser notification permission is requested only through the explicit notification control, and uploads work without it.

The compressed file may be at most 100 MiB. ZIPs may contain at most 32 files, must not be encrypted or nested, and must include a recognizable `.txt` combat log. Pizza Logs chooses the largest usable text member without extracting the archive.

## Duplicate Uploads

An exact file re-upload is detected by SHA-256 and links to the existing report. Encounter fingerprints separately protect against persisting the same pull twice. Back-to-back pulls with the same roster remain distinct because fingerprints include the exact normalized pull start.

## Common Problems

- **Unsupported file:** use `.txt`, `.log`, or `.zip`; renaming unrelated content is not enough because the parser validates content/magic.
- **No encounters detected:** confirm combat logging was enabled and the file covers recognized raid boss activity.
- **Unknown difficulty/outcome:** the report lacked non-conflicting boss-specific evidence; Pizza Logs deliberately does not guess.
- **Upload capacity busy:** another bounded parse is running; retry shortly rather than repeatedly opening new uploads.
- **Historic report differs after a parser fix:** stored rows are not automatically reparsed. Upload the source log again after the fix deploys.

Do not upload a log if its in-game character names and raid performance should not become public. See [PRIVACY.md](../../PRIVACY.md).
