# Rich Menu integrity evidence

`npm run line:richmenu:asset` regenerated the approved PNG at 2500 × 843px and 106,175 bytes. Its SHA-256 is `cba24c4810fba10139112c5dc0dd1a3963e47c06fff1499c23b13694fbc688cc`. The value matches PR #32's committed artwork. `npm run line:richmenu:verify` verifies the current inputs, manifest, hash, format, dimensions, byte limit, decode and opacity. The fingerprint uses sorted repository-relative paths, hashes of the four primary SVGs, the font and generator source, and the canonical geometry and byte limit. It ignores LF versus CRLF in text sources. Verification reads the committed artifact as-is on every platform. [Manifest](../../../../assets/line/nhf-rich-menu.manifest.json) · [Approved image and tap overlay](../../rich-menu-visual-identity/README.md)

Both files are staged after buffer validation. PNG and manifest publication use two separate renames. An interruption between them can leave a detectable mismatch. Restore the approved pair or regenerate from the same reviewed inputs and rerun verification. No network calls, channel identifiers or deployment actions are part of this workflow.

The generator checks font readability, probes Pango and checks all rendered labels for visible pixels and fit. Windows PresentationCore independently mapped all 22 distinct code points from the four labels to nonzero glyph IDs in the bundled file. This validates the file's character map, including Thai marks. The portable command does not inspect the actual font selected by Pango or validate shaping across native environments. The original approved visual evidence remains applicable because regeneration produced the same PNG bytes.

```powershell
Add-Type -AssemblyName PresentationCore
$font = [System.Windows.Media.GlyphTypeface]::new([Uri](Resolve-Path 'assets/fonts/NotoSansThai-Variable.ttf').Path)
$points = ('เบิกวัสดุ','ลางาน','งานของฉัน','แจ้งปัญหา' -join '').ToCharArray() |
    ForEach-Object { [int][char]$_ } | Sort-Object -Unique
$missing = @($points | Where-Object { -not $font.CharacterToGlyphMap.ContainsKey($_) -or $font.CharacterToGlyphMap[$_] -eq 0 })
if ($missing.Count -gt 0) { throw "Missing Thai glyphs" }
"Mapped $($points.Count)/$($points.Count) distinct Thai code points"
```
