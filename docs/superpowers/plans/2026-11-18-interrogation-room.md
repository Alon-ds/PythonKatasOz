# Interrogation Room Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A pinned soldier card with an "Interrogation room" button that plays a funny pixel-art interrogation scene.

**Architecture:** `map.js` pins the tooltip on click and lazily imports `docs/interrogation.js`, which builds a full-screen overlay (SVG room + HTML speech bubbles) and runs an async, cancellable script.

**Tech Stack:** Plain JS ES modules, SVG, CSS animations. No dependencies.

**Spec:** `docs/superpowers/specs/2026-11-18-interrogation-room-design.md`

## Global Constraints

- English copy; Pixelify Sans font; pixel style consistent with the map.
- No runtime network calls other than the avatar `https://github.com/<login>.png` (none in `?sample=1`).
- `prefers-reduced-motion: reduce` → no movement, dialogue still shown.
- All user data inserted with `textContent` (no innerHTML of logins/katas).

## Review Focus

- Clicking the card's button must not close the card first (blur/pointerleave while pinned) → browser check in Task 1.
- Closing mid-scene (Skip/Escape) must stop the script; reopening must start fresh → browser check in Task 2.
- Phone width: scene fits 390px wide, bubbles readable → screenshot in Task 2.

---

### Task 1: Pinned soldier card with the button

**Files:** Modify `docs/map.js`, `docs/map.css`

**Interfaces:** Produces the call `import("./interrogation.js").then(m => m.interrogate({ login, passed, avatar, route }))` where `passed: string[]`, `avatar: string | null`, `route: string[]` (all katas in route order).

- [ ] `bindTip(node, html, onAction = null)`: click (or Enter/Space when focused) shows the tip **pinned** (`.tip.pinned`, `pointer-events: auto`) and, if `onAction`, appends `<button class="tip-action">Interrogation room</button>`. While pinned, pointer move/leave/blur don't move or hide it; clicking empty map or Escape unpins and hides.
- [ ] Soldiers pass `onAction`; checkpoints and "+N" badges don't.
- [ ] Verify in browser (`?sample=1`): click soldier → card with button; dispatching `blur` on the soldier keeps it; clicking empty map hides it.
- [ ] Commit `feat(map): pinned soldier card with interrogation button`

### Task 2: The interrogation scene

**Files:** Create `docs/interrogation.js`; modify `docs/map.css`

**Interfaces:** `export function interrogate({ login, passed, avatar, route }): void`

- [ ] Overlay `.interro` (role `dialog`, `aria-modal`, label "Interrogation room") containing a 16:10 stage: SVG room (wall, floor, one-way mirror, door, swinging lamp + light cone, table, chairs), student sprite (team-colour body, avatar or initial head, helmet, sweat drop, kneeling pose class), investigator sprite (bitmap per spec look), HTML bubbles, Skip button, end card with Replay / Back to the map.
- [ ] Script (async, aborts when closed): investigator walks in → file slam with "SUBJECT: <login>" and "<N> katas passed" → the five dialogue beats from the spec → end card. Kata asked about = last passed kata, else `route[0]`.
- [ ] Text types at ~30 ms/char; click on stage completes the current line; reduced motion → instant text, no transitions.
- [ ] Escape / Skip / Back close and restore focus to the soldier; Replay restarts from the top.
- [ ] Verify in browser at desktop and 390px: screenshots of the room, the kneeling beat and the end card; close mid-scene then reopen starts fresh.
- [ ] Commit `feat(map): interrogation room scene`
