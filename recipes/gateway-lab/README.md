---
title: gateway-lab
tagline: 'AI Gateway observes model traffic while Lab records the completed work artifact.'
composes: [AI Gateway, Workers AI, lab]
---

# gateway-lab

The `GatewayLab` agent mounts `prompt_with_gateway_receipt`. The tool uses the agent harness for the model call, writes the input and answer to Lab, and returns the Lab permalink and configured gateway id. `src/app.ts` registers Workers AI through `cloudflareBindingProvider` with the named gateway.

## Route

Send `{ "kind": "user", "body": "{\"message\":\"...\"}" }` to `POST /agents/gateway-lab/<conversationId>`. Admission returns HTTP 202; read the same URL until the response includes the receipt URL.

## Run

```sh
bash recipes/gateway-lab/run-e2e.sh
```
