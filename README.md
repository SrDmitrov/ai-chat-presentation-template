# chat-replay

Turns a conversation with an AI into an animated terminal replay: prompts type themselves, a spinner runs, tool calls and replies stream in. The output is one self-contained HTML page with playback controls (start, previous, play/pause, next, end, continuous play, 2×/4×) and a light/dark theme.

No dependencies. Needs Node 18 or newer.

## Quick start

```sh
node build.mjs                                  # builds every conversations/*.chat
node build.mjs conversations/my-talk.chat       # builds one
```

Each conversation produces two files in `dist/`:

| File | Use |
| --- | --- |
| `<name>.html` | Full HTML document. Open it locally or put it on any static host (GitHub Pages, Netlify, S3). |
| `<name>.artifact.html` | The same page without `<!doctype>`, `<head>` and `<body>`, which is the form a Claude artifact expects. |

## Writing a conversation

A `.chat` file is plain text: page settings first, then the conversation. See `conversations/hello-world.chat` for a minimal example to copy.

```
title: My Talk
subtitle: One line shown under the title. `backticks` become code.
window: my-app — claude — 100×40
status: Opus 5.5
footer: Shown under the terminal.

@banner
 ▐▛███▛█   **Claude Code** v2.1.322
▝▜██████▀  Opus 5.5 · Claude Team
@user is there an emulator running?
@tool! Bash(adb devices -l)
Error: Exit code 1
ADB server didn't ACK
@say
Yes, one emulator is running: `emulator-5554`.

- A bullet
1. A numbered item
## A bold heading
@done Worked for 12s · done 5:19 PM
```

All five settings are optional. Lines starting with `#` before the first directive are comments.

| Directive | Shows |
| --- | --- |
| `@banner` + lines | Start-up banner. Leading block characters are drawn as the logo. |
| `@user text` | A prompt, typed into the input box and then sent. |
| `@slash /cmd` + optional line | A slash command and its one-line result. |
| `@say` + lines | The assistant's reply, streamed. One paragraph per line; blank lines separate paragraphs. Supports `- ` bullets, `  - ` nested bullets, `1. ` items, `## ` headings, `` `code` ``, `**bold**` and box-drawing tables (shown as-is). |
| `@tool Name(args)` + lines | A tool call and its output. `@tool!` marks it as failed (red). |
| `@ask` + lines | Answered questions (AskUserQuestion), one `Question → Answer` per line (`->` also works). A card asks each one and marks the answer, then folds into `User answered Claude's questions:`. |
| `@note text` | A dimmed system notice with a `⏺` marker. |
| `@dim text` | A dimmed line, such as `Wrote 2 memories (ctrl+o to expand)`. |
| `@done text` | Ends the turn, for example `Baked for 9s · done 5:33 PM`. |
| `@spin Verb` | Optional. Overrides the spinner word for the current turn. |

Playback works like a presentation. It opens on a small retro terminal with `claude` typed in and waits. Play, Next or a click on it opens Claude Code, which waits again at turn 0; Play then starts the conversation. Each turn is two steps, and Previous/Next move one step at a time: the user's prompt is typed into the input box, then it is sent and the agent replies.

The spinner starts after every prompt and stops at `@done`. Its word comes from the `@done` text ("Baked for 9s" gives "Baking…"); without a `@done` it says "Thinking…" until the next prompt.

To start a line inside `@say` or tool output with a literal `@`, write `\@`.

## Importing a Claude Code session

In Claude Code, run `/export my-talk`, then:

```sh
node import-claude-code.mjs my-talk.txt > conversations/my-talk.chat
```

The importer rejoins lines that the terminal wrapped and recognizes prompts, tool calls, replies, answered questions and "done" lines. The export is plain text, so some things are lost and need a manual pass:

- Fill in the settings at the top.
- Inline code and bold are gone. Add backticks and `**` where you want them back.
- Headings come through as plain or numbered lines. Prefix them with `## `.
- Hook and system notices come through as `@say`. Change them to `@note`.
- Replace anything private (home directory, project names, hostnames) before you publish.

## Deploying

**Web page:** upload `dist/<name>.html` to any static host. It loads two Google Fonts and nothing else.

**Claude artifact:** in Claude Code, ask Claude to build and publish the conversation as an artifact. `CLAUDE.md` tells it which file to use. To update an artifact that already exists, give Claude its URL.

## Changing the look

- Colors and fonts: the tokens at the top of `src/player.css`. Light is Solarized Light, dark is One Dark. Dark values appear twice (OS setting and explicit toggle); keep the two blocks identical.
- Page structure: `src/page.html`. The terminal title bar shows the title, the `window` text and the turn counter.
- Typing speed, pauses and spinner: `src/player.js`.
- Start-up animation (a CRT powers on, `claude` is typed, the banner draws): `boot()` and `open()` in `src/player.js`; its colors are the `--crt-*` tokens.

## Layout

```
build.mjs               .chat → dist/*.html
import-claude-code.mjs  Claude Code /export → .chat draft
src/page.html           page markup with {{PLACEHOLDERS}}
src/player.css          styles and theme tokens
src/player.js           the player
conversations/          one .chat file per replay
dist/                   build output (git-ignored)
```
