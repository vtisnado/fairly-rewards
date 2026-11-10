# Image prompts

Status: product sprite sheet requested (2026-11-11). Other images on hold.

## 1. `products-sheet.png`: hero products, one sheet to cut out

Paste this prompt as is:

> Create one sprite sheet image, 3072 x 2048 pixels, landscape, with a fully transparent background (PNG with alpha). Arrange 8 separate objects in a clean 4 x 2 grid. Each object sits alone in its own invisible cell, centered, with at least 120 pixels of empty transparent space around it. Nothing touches or overlaps. No grid lines, no labels, no text, no shadows on the ground, no background.
>
> Style for every object: premium soft 3D render, like high-end app icons or a modern fintech illustration. Slightly stylized proportions, smooth rounded forms, rich but realistic materials, soft studio lighting from the top left, gentle specular highlights, subtle ambient occlusion. Warm color palette. All objects share the same lighting, camera angle (three-quarter view, slightly from above) and level of detail, so they look like one set. Each object is tilted slightly (between 5 and 15 degrees) to feel playful.
>
> The 8 objects, left to right, top row then bottom row:
> 1. A takeaway coffee cup with a matte black lid, white cup, and a corrugated kraft paper sleeve with a small coral (#F2654F) round sticker. A thin wisp of steam.
> 2. A kraft paper shopping bag with twisted paper handles, top edge folded, a small cream label on the front. No logo, no text.
> 3. A golden flaky butter croissant with visible laminated layers and a glossy egg-wash shine.
> 4. A cheeseburger: sesame brioche bun, melted cheddar dripping over the edge, fresh lettuce, tomato slice, juicy patty.
> 5. A glazed donut with pink icing and colorful sprinkles (yellow, mint, lilac, white), one small bite taken.
> 6. An iced latte in a clear plastic cup with a dome lid and a coral straw, visible coffee and milk layers, ice cubes.
> 7. A small gift box in coral (#F2654F) with a cream satin ribbon and bow, lid slightly lifted.
> 8. A short paper receipt, slightly curled, with blank grey lines instead of text and a torn zigzag bottom edge.
>
> Rules: no brand names, no logos, no readable text, no people, no hands, no table, no plates, no drop shadow on a floor, no gradient background. Transparent background only.

### If the result is not usable
- Background not transparent: "Same image, remove the background completely, transparent PNG."
- Objects touching: "Same objects, more space between them, each one fully separated."
- Text appeared: "Same image, remove all text and logos."
- Style drifts between objects: "Make all 8 objects match the coffee cup's lighting and render style."

### How we use it
Save it as `design/assets/img/products-sheet.png`. I cut each object into its own transparent PNG (`coffee.png`, `bag.png`, `croissant.png`, `burger.png`, `donut.png`, `iced-latte.png`, `gift.png`, `receipt.png`) with ImageMagick inside Docker, and they replace the SVG illustrations around the hero phone and in the footer. Gold coins stay as SVG (they carry the shine animation).
