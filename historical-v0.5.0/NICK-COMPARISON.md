# Nick Valentine comparison

Compared the complete native Download component's `props` captured from the [character page](https://jannyai.com/characters/4c785bd7-721e-47ce-bdd6-49f364a3d16a_character-nick-valentine-the-broken-code) on 2026-09-22 against the existing `Nick Valentine- The Broken Code.jannyai-raw.json` in Downloads.

The existing raw file identifies itself as **0.4.0-beta**, captured at **2026-09-22T20:53:07.814Z**. The implementation used as the release baseline is the supplied **0.4.1-beta ZIP**; these are distinct inputs.

The structured source contains **11,819 UTF-16 code units (11,811 Unicode code points) of serialized props** and **18 character fields**. The full attribute was saved directly, without the tool-output truncation that affected the earlier investigation. Lengths below count Unicode code points; these particular text fields also have the same JavaScript UTF-16 lengths.

| Field | Structured length | Existing raw length | Difference |
|---|---:|---:|---|
| Name | 31 | 31 | Exact match. |
| Definition (`personality` vs old `description`) | 1,833 | 1,848 | The raw file prepends exactly `Personality:   ` (15 characters). The remaining text matches exactly. |
| Scenario | 333 | 333 | Exact match. |
| First message | 4,764 | 4,728 | The raw file removes 33 whitespace spaces and three final newlines. No non-whitespace text differs. |
| Example dialogue | 1,911 | 1,905 | The raw file removes five newline characters and one whitespace space. No non-whitespace text differs. |
| HTML introduction (`description`) | 961 | Not captured separately | Distinct introduction, not the definition. Now preserved in creator notes and source metadata. |
| Creator name | 10 | 11 | Structured `RaynaStorm`; raw UI-derived `@RaynaStorm`. |
| Character UUID | 36 | 36 | Exact match. |

Applying the old whitespace-cleaning function to the structured first message and examples reproduces the old raw values exactly. v0.5.0 keeps the structured originals instead. The old raw `personality` field is empty; that was the previous export mapping, not an absent source definition.

Additional recovered fields are `creatorId`, `createdAt`, `avatar`, `tagIds`, `isNsfw`, `permanentToken`, `totalToken`, `isLowQuality`, the seven full `tags` objects, and `stats`. The old raw tags array was empty. All are retained in the source extension rather than dropped; readable tag names also populate CCv2 tags.

Creator UUID: `08bbc627-6913-45ec-9e8e-73e0832fe5c5`.

Character UUID: `4c785bd7-721e-47ce-bdd6-49f364a3d16a`.

Portrait URL: [original WebP](https://image.jannyai.com/bot-avatars/Aq9Ki-lPr5kRhWjf6krgN.webp).

These checks establish fidelity to the current JannyAI properties and identify differences from the supplied raw capture. They do not establish fidelity to an unavailable upstream original or prove the site has never changed the character.
