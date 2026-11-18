# Interrogation Room — Design (small change)

## Intent

Students are told to solve katas with no external help (no Google, no AI, just thinking, even pen and paper) to
build algorithmic thinking for job interviews. The course uses AI a lot elsewhere, so the rule needs to stick.
A funny "interrogation" of any soldier on the map makes the rule memorable instead of preachy.

## What it does

- Clicking a soldier pins its tooltip as a card with an **Interrogation room** button (hover still shows the
  plain tooltip; Escape or clicking empty map closes the card).
- The button opens a full-screen pixel-art scene: grey room, swinging lamp, metal table, one-way mirror, door.
  The student's soldier (GitHub avatar as head) sits sweating. The investigator — a pixel character modelled on
  the instructor (short messy dark hair, dark top-frame glasses, salt-and-pepper beard, black T-shirt) — walks in
  and slams a file "SUBJECT: <login> — N katas passed".
- Dialogue in typed-out speech bubbles (English):
  1. "Did you use Google to find a solution?" / "No..." (worried)
  2. "Did you solve it with AI?" / "I promise, no..."
  3. "Then explain <a kata they passed> to me. On paper."
  4. Escalation: lamp swings, student drops to their knees: "PLEASE! I'll use pen and paper! I'll never open
     ChatGPT again! I have a family... of unit tests!"
  5. "Pen. Paper. Think." → end card "Katas are brain-only. No Google. No AI." with Replay / Back to the map.
- Skip button, Escape closes, click speeds up text; reduced motion shows the dialogue without movement.

## Non-goals

Personalized scripts beyond login, kata count and one passed kata; sound; using the instructor's real photo.

## Approaches

- **Chosen: SVG + CSS scene in an in-page overlay**, pixel sprites drawn in code like the map, lazily loaded
  `docs/interrogation.js`. Matches the map style, personal per student, no dependencies.
- Canvas/animation library: heavier for one short scene.
- Pre-made GIF/video: can't show each student's avatar, name and katas.

## Builder calls

Exact timings, room layout and sprite pixels; investigator line before the questions ("So, <login>. N katas
passed."); a student with zero passed katas is asked about the first kata on the route.
