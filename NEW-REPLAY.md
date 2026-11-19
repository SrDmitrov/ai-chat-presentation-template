# New replay from a Claude Code export

The standard procedure for turning a Claude Code `/export` text into a published replay artifact. Claude follows it when asked to make a replay from an export. A person can follow it by hand too, doing the Claude steps themselves. In Claude Code, `/fancy-replay <export.txt>` runs this procedure.

Roles: the **main session** plans, reviews and publishes. **Workers** are subagents that edit files, one phase each (`general-purpose`, model `sonnet`, effort `medium`). Give each worker this file, the phase to do and the project rules (`CLAUDE.md`, `.claude/rules/`), and tell it to do that phase only.

## 0. Get the export

1. In Claude Code, run `/export <name>` in the session to replay. It writes `<name>.txt`.
2. Copy it to `private-conversations/<name>.txt`. This folder is git-ignored. The file holds private data: never publish it.

## 1. Import a draft (main session)

```sh
node import-claude-code.mjs private-conversations/<name>.txt > $TMPDIR/<name>.chat
```

Read the whole draft and compare it with the export. Note:
- **Private data:** home directory and user name, company, client and project names, hostnames and URLs, ticket keys, emails, logins and passwords, tokens, GPS coordinates, session IDs and temp paths, plugin names that identify the setup.
- **Importer mistakes:** prompts read as `@slash`, answered questions that are not an `@ask`, wrapped lines that were not rejoined, tool output that became loose `@dim` lines.
- **Noise:** hook and plugin messages, compaction blocks, interrupted prompts, `Shell cwd was reset` lines, recap lines, long plans.

## 2. Decide with the user (main session)

Ask the user, in one round of questions:
- **Replacement names.** Default: a consistent fictional brand (company, product, domain `*.example`, ticket prefix, `~/work/<product>` path, fake coordinates). Keep IDs and commit hashes that mean nothing outside.
- **How much to cut.** Default: cut the noise, keep every user turn, question cards, tool calls with their code diffs, and results.
- **Whether to fix the importer.** Default: hand-edit the draft and log each importer mistake in `BACKLOG.md`. Fix the importer only when the user asks. A fix is worth it when the same mistake would repeat on the next export.

Then write a short plan: the importer fixes, the name map, the cut list, the output file `private-conversations/<new-name>.chat` (named after the fictional product, never the real one).

## 3. Phase A: fix the importer (worker, only if decided)

- Edit `import-claude-code.mjs` only. Keep it dependency-free and minimal.
- Test on `private-conversations/<name>.txt`, writing to `$TMPDIR` only. Each fixed mistake must be gone from the new draft.
- Regression: re-import a fixture export, if one exists, and diff it with the output before the change. Report the diff.
- Record mistakes it leaves unfixed in `BACKLOG.md` (main session).

## 4. Phase B: player changes (worker, only if the conversation needs them)

Only when the replay shows content the player cannot display well (an earlier case: diff lines needed colors and kept indentation). Edit `src/`, follow `CLAUDE.md` (the two dark-theme blocks in `src/player.css` stay identical), update `README.md`, run `node build.mjs`.

## 5. Phase C: write the conversation (worker)

Input: the re-imported draft in `$TMPDIR`. Output: `private-conversations/<new-name>.chat`. The worker:
- Sets the settings: `title`, `window: <product>-<platform> — claude`, `status: <model>`. Leave `subtitle` and `footer` empty (minimal design).
- Replaces every private item with the agreed name map, also inside diffs, URLs, paths and tool arguments.
- Cuts the noise and shortens long plans to `## ` headings with a few bullets.
- Tidies: joins lines still broken by wrapping, adds backticks around paths, endpoints and identifiers in `@say` text, escapes body lines that start with `@` as `\@`.
- Keeps the wording of user prompts and replies otherwise unchanged.
- Runs `node build.mjs private-conversations/<new-name>.chat`, which must succeed.

## 6. Check and publish (main session)

1. **Privacy check.** Grep the `.chat` for every original name and for general patterns, and read each hit:
   ```sh
   grep -n -i -E "<real names>|/Users/|<user name>|<ticket key>" private-conversations/<new-name>.chat
   grep -n -i -E "[a-z0-9._-]+@[a-z0-9.-]+\.[a-z]{2,}|password|token|lat=|https?://" private-conversations/<new-name>.chat
   ```
   A real hit goes back to the worker. An endpoint such as `/users/me/` is not private.
2. **Build all:** `node build.mjs`. If `src/` changed, every replay changes.
3. **Publish** `dist/<new-name>.artifact.html` as a new artifact (icon `terminal`, one-sentence description). Never publish `dist/<name>.html`.
4. **Republish** the existing replays to their URLs when `src/` changed. In a new Claude session, read each artifact first, then publish with its `url`.
5. **Report** to the user: the link, who can open it (new artifacts are private until shared), what was replaced and cut, what was not verified (the replay is not viewed in a browser from the sandbox).

## 7. Finish

- Do not commit unless the user asks. Raw exports and new replays stay in the git-ignored `private-conversations/`. `example-conversations/` holds only the three committed examples; never add to it.
- Add open issues found on the way to `BACKLOG.md`.
