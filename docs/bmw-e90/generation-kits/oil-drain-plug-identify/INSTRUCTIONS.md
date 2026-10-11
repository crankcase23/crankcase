# Generate: oil-drain-plug-identify

Prompt sha256: `cba5bfffdbe87db98e6c9a5db01f23cf000f8059888c6273b1693e0a5ba5c39e` (the factory records this; do not edit the prompt).

1. Open a NEW ChatGPT chat (image generation). Paste the whole of `PROMPT.txt`. Do not attach any image.
2. If ChatGPT asks about size, choose landscape. Native sizes such as 3:2 are fine: the image is padded to 16:10 afterwards, never stretched. Square or portrait will be refused.
3. If the first result shows text, labels, arrows, brand marks, or parts the prompt says not to show, regenerate (each regeneration is a cycle; the factory allows an initial generation plus 3 corrections).
4. Download the image as **PNG** and save it in this folder as `native.png`. Keep the C2PA/metadata: do not re-save or edit it.
5. Fill every `null` in `candidate.claims.template.json` and save it as `candidate.claims.json`. The attestation flags are your statement that it is true: text-only prompt, no reference images, no tracing, no other imagery composited, no baked-in text. Put the provider and model that actually made the image (for example system "ChatGPT image generation") and the provider's usage terms in `licenseTerms.summary`.
6. Run:
   `npm run bmw:qa -- fit --in <this folder>/native.png --drop <this folder>`
   `npm run bmw:qa -- drop-import --runs <runs dir> --visual oil-drain-plug-identify --drop <this folder>`
   `npm run bmw:qa -- export --runs <runs dir> --visual oil-drain-plug-identify --drop <this folder>`
7. Give the exported `QA-PACKET.md` and `candidate.png` to Hermes / ChatGPT in a **separate, fresh chat** (not the one that made the image), then save its reply and run `npm run bmw:qa -- import ... --response reply.txt --model "<model>" --system "<system>"`.
