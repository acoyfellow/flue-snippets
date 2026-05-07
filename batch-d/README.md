# Batch D · Agent Control Layers

Small snippets that turn agent persistence into ordinary, testable
infrastructure: durable state used to change the next action.

| # | Title | Primitives |
|---|---|---|
| [16](16-do-governor) | DO run governor — escalates from continue → reanchor → ask-human when the agent loops | Durable Objects |
| [18](18-lab-checkpoint) | Checkpoint receipts at meaningful moments (start, every Nth cycle, stop) | Durable Objects + lab |

## Thesis

Persistent state is useful when it changes the next action. This batch
gives an agent one small control signal: continue, re-anchor, checkpoint,
or stop.
