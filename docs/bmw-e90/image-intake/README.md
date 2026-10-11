# Image intake (ChatGPT subscription route)

Controlled import path for generated BMW candidate images. Nothing here is certified by existing; certification still needs admit, normalize, overlay QA and owner sign-off.

Layout, per visual id:
- `native/<id>.native.png`   generator's native PNG, untouched (C2PA kept)
- `drops/<id>/`              fitted `candidate.png`, `candidate.fit-record.json`, `candidate.claims.json`
- `qa/<id>/<id>/`            QA packet, independent reply (`response.json`)

Flow (owner does nothing manually):
1. Claude sends the locked prompt in a fresh ChatGPT chat (subscription only), downloads the PNG to Downloads (folder access granted for Downloads only), stages that single file.
2. `npm run bmw:qa -- fit --in native/<id>.native.png --drop drops/<id>` (pads, never stretches or upscales; refuses if content touches an edge)
3. `drop-template`, fill claims truthfully (disclose any prompt deviation), `drop-import`
4. `export` the packet, run independent review in a fresh ChatGPT chat, `import` the reply.
5. Overlay QA, admit, normalize, owner approval are separate gates.

Known ChatGPT quirks: very long prompts and the phrase "no reference image" repeatedly triggered "treated as an edit" failures; typing into a fresh chat page can drop text (set the box via script and verify before sending).
