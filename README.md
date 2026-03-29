# Spoiler Guard

Firefox extension that hides spoilers on Twitch and YouTube VODs.

## What it hides

- Video thumbnails (home, search, sidebar, VOD pages)
- Duration labels on thumbnails
- Player time display and progress bar
- Seek preview tooltips
- Recommended/related videos
- YouTube end screen and comments
- Twitch front-page carousel

## What it adds

- Custom relative seek slider (-1h to +1h) with non-linear scale (fine control near center)
- Storyboard preview thumbnails while seeking (both Twitch and YouTube)
- Toolbar button to toggle on/off

## Install

Download the latest signed `.xpi` from [Releases](https://github.com/thibaultsoubeste/spoiler-guard/releases) and open it in Firefox.

Auto-updates are enabled.

## Release

1. Bump `version` in `manifest.json`
2. Commit and tag: `git tag v<version>`
3. Push: `git push origin master --tags`

GitHub Actions signs the extension on AMO, creates a release with the `.xpi`, and updates `updates.json` for auto-update.
