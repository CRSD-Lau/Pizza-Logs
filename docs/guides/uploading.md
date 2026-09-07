# Uploading a Combat Log

## Before the Raid

Enable advanced combat logging in the WoW client and start logging with `/combatlog`. Pizza Logs targets WotLK 3.3.5a-style logs, especially Warmane Lordaeron.

## Upload

1. Open the Pizza Logs home page.
2. Enter your character name and select the Warmane realm. Guild attribution and completion notifications are optional under **Upload options and file help**.
3. Read **Upload rules** and tick the unchecked acknowledgement confirming permission to share the log, acceptance of the rules and public report visibility. Each new upload requires this acknowledgement.
4. Select `WoWCombatLog.txt`, another `.txt`/`.log` combat log, or a `.zip` containing exactly one log.
5. Keep the tab open while the upload, content validation, quick classification, full parse, and save stages complete.
6. Choose **View raid report** after completion. New and duplicate uploads both provide this action; **Upload another** starts a separate upload.

The home page puts uploading before site statistics. **Watch guild intro** opens the optional cinematic; reduced-motion users choose whether to play it. Browser notification permission is requested only through the explicit notification control, and uploads work without it.

The uploaded TXT, LOG or ZIP file may be at most 1 GiB; a ZIP may expand to at most 1 GiB. ZIP is recommended for faster transfer. ZIPs must contain exactly one `.txt` or `.log` combat log and may include safe empty folders, up to 32 total entries. Programs, scripts, unrelated files, multiple logs, encryption, nested archives and unsupported compression are rejected. Archive contents are streamed without extracting a directory tree.

The complete file must contain recognizable combat-log records in UTF-8 or Windows-1252. Binary data, malformed records and logs that exceed processing complexity limits are rejected. Being within the byte limit does not guarantee completion within processing or transfer time limits. Finish recording before uploading, keep the original file, and split very long logs into shorter valid recordings if needed. These checks reduce risk but do not constitute an antivirus scan or verify that combat events are authentic.

## Duplicate Uploads

An exact file re-upload is detected by SHA-256 and links to the existing report. Encounter fingerprints separately protect against persisting the same pull twice. Back-to-back pulls with the same roster remain distinct because fingerprints include the exact normalized pull start.

## Common Problems

- **Unsupported file:** use `.txt`, `.log`, or `.zip`; renaming unrelated content is not enough because the parser validates content/magic.
- **No encounters detected:** confirm combat logging was enabled and the file covers recognized raid boss activity.
- **Unknown difficulty/outcome:** the report lacked non-conflicting boss-specific evidence; Pizza Logs deliberately does not guess.
- **Upload capacity busy:** another bounded parse is running; retry shortly rather than repeatedly opening new uploads.
- **Historic report differs after a parser fix:** stored rows are not automatically reparsed. Upload the source log again after the fix deploys.

Do not upload a log if its in-game character names and raid performance should not become public. See [PRIVACY.md](../../PRIVACY.md).

## Bugs and Feedback

Pizza Logs is a community project; bugs and incomplete game data can produce incorrect or missing results. Accuracy and uninterrupted availability are not guaranteed. Use **Report a bug** in the footer or upload error panel to [open the repository bug form](https://github.com/CRSD-Lau/Pizza-Logs/issues/new?template=bug.yml) for Neil to review. Include reproduction steps, expected versus actual behavior, browser/device and a public report URL if available. Remove private details from screenshots and never attach private raw logs. Report security vulnerabilities and privacy concerns through a [private advisory](https://github.com/CRSD-Lau/Pizza-Logs/security/advisories/new).
