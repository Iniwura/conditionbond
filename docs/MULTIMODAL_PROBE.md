# Multimodal proof

The disposable probe is `probes/multimodal_probe.py`, deployed at `0x3574235B94ad584b255f7fc146A1377aEa469671` on Studio Dev. It calls screenshot rendering for both BEFORE and AFTER URLs and passes both image objects to `gl.nondet.exec_prompt` for the leader and validators.

The immutable fixture commit is `edd41a3`:

- BEFORE intact mug: `https://raw.githubusercontent.com/Iniwura/conditionbond/edd41a3/fixtures/multimodal/before-intact.svg`
- AFTER material damage: `https://raw.githubusercontent.com/Iniwura/conditionbond/edd41a3/fixtures/multimodal/after-material-damage.svg`
- AFTER ambiguous: `https://raw.githubusercontent.com/Iniwura/conditionbond/edd41a3/fixtures/multimodal/after-undetermined.svg`

The material case finalized `MATERIAL_DAMAGE` in tx `0x70dea717e252b84c6879cb5c7135cdaf24b949851553bf4e683e1255900ee730`. The ambiguous case finalized `UNDETERMINED` in tx `0xc0464794e0589b10689831d9b126cb7f1bdbe4779be7f09964cec345be28d85e`.
