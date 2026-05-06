# 01 · Flue + lab

> Run a prompt. Get a permalink. Hand it to the next agent.

## What it does

Runs a Flue agent against the user's message. Records the run as a Lab
receipt. Returns both the answer and the receipt URL.

## Why this matters

Most agent code today produces output that vanishes the moment the request
ends. There's no audit trail, no shareable URL, no way for the next agent
to pick up the work. Lab inverts that: the receipt is the artifact.

This snippet is the floor of the receipts/proof/gates cluster. Every other
snippet in batch A builds from the same shape: do work in a Flue agent,
return a URL someone else can read.

## Cloudflare primitive in play

None directly, but Lab itself runs on Cloudflare Worker Loaders + KV. The
receipt URL you get back is served by a CF Worker. The receipt JSON is
stored in Workers KV. The Flue agent runs anywhere — in this snippet, just
with `flue dev`.

## Lines of code

22 (excluding header comment).

## Run it

```bash
LAB_URL=https://lab.coey.dev flue run 01-lab-receipt --payload '{"message":"hello"}'
```
