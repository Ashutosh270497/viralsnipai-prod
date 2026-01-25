# Spacing System (8px Grid)

A complete spacing system based on 8px increments for consistent layouts.

## The 8px Grid System

All spacing should be multiples of 8px. This creates visual rhythm and makes design decisions easier.

```
8px   = 0.5rem
16px  = 1rem
24px  = 1.5rem
32px  = 2rem
48px  = 3rem
64px  = 4rem
96px  = 6rem
128px = 8rem
```

---

## Spacing Scale

### Extra Small (8px / 0.5rem)
**Use for:**
- Icon spacing from text
- Very tight groups
- Badge padding (vertical)
- Checkbox label gap

```css
gap: 8px;
margin-right: 8px;
padding-top: 8px;
```

### Small (16px / 1rem)
**Use for:**
- Standard gap between related elements
- List item spacing
- Form field vertical spacing
- Small button padding (vertical)

```css
gap: 16px;
margin-bottom: 16px;
padding: 16px;
```

### Medium (24px / 1.5rem)
**Use for:**
- Spacing between form groups
- Card internal spacing
- Section margins
- Comfortable padding

```css
margin-bottom: 24px;
padding: 24px;
gap: 24px;
```

### Large (32px / 2rem)
**Use for:**
- Section padding
- Card padding
- Container padding
- Major element separation

```css
padding: 32px;
margin-bottom: 32px;
gap: 32px;
```

### Extra Large (48px / 3rem)
**Use for:**
- Large section breaks
- Hero section padding
- Major content separation
- Container padding (desktop)

```css
padding: 48px;
margin-bottom: 48px;
gap: 48px;
```

### 2XL (64px / 4rem)
**Use for:**
- Major section divisions
- Hero section vertical padding
- Large container spacing

```css
padding-top: 64px;
padding-bottom: 64px;
margin-bottom: 64px;
```

### 3XL (96px / 6rem)
**Use for:**
- Massive section breaks
- Landing page sections
- Large whitespace areas

```css
padding-block: 96px;
margin-bottom: 96px;
```

---

## Component-Specific Spacing

### Buttons

**Padding:**
```css
/* Small button */
padding: 8px 16px;
gap: 8px; /* Icon to text */

/* Medium button (standard) */
padding: 12px 24px;
gap: 8px;

/* Large button */
padding: 16px 32px;
gap: 12px;
```

**Margins:**
```css
/* Button groups */
gap: 12px;  /* Horizontal spacing */
gap: 16px;  /* Vertical spacing in forms */
```

### Cards

**Padding:**
```css
/* Compact card */
padding: 16px;

/* Standard card */
padding: 24px;

/* Spacious card */
padding: 32px;
```

**Margins:**
```css
/* Card grid */
gap: 24px;  /* Desktop */
gap: 16px;  /* Mobile */

/* Card in list */
margin-bottom: 16px;
```

### Forms

**Field spacing:**
```css
/* Label to input */
margin-bottom: 8px;

/* Input to helper text */
margin-top: 8px;

/* Between form groups */
margin-bottom: 24px;

/* Form section breaks */
margin-bottom: 32px;
```

**Input padding:**
```css
/* Standard input */
padding: 12px 16px;

/* Large input */
padding: 16px 20px;

/* Compact input */
padding: 8px 12px;
```

### Lists

**Item spacing:**
```css
/* List items */
padding: 16px;
gap: 16px; /* Between elements in item */

/* Dense list */
padding: 12px;
gap: 12px;

/* Spacious list */
padding: 20px;
gap: 16px;
```

**List margins:**
```css
/* Between list sections */
margin-bottom: 32px;
```

### Typography

**Paragraph spacing:**
```css
/* Between paragraphs */
margin-bottom: 16px;

/* After headings */
h1, h2, h3 {
  margin-bottom: 16px;
}

/* Large text blocks */
margin-bottom: 24px;
```

**Line height (not spacing, but related):**
```css
/* Headings */
line-height: 1.2; /* 1.2x the font size */

/* Body text */
line-height: 1.5; /* 1.5x the font size */
```

### Navigation

**Nav item spacing:**
```css
/* Nav items */
gap: 8px;  /* Tight spacing */
gap: 16px; /* Standard spacing */
gap: 24px; /* Loose spacing */

/* Nav padding */
padding: 16px 24px;
```

### Modals

**Modal padding:**
```css
/* Modal header/footer */
padding: 24px;

/* Modal body */
padding: 24px;

/* Large modal */
padding: 32px;
```

**Modal spacing:**
```css
/* Overlay padding (from screen edge) */
padding: 16px; /* Mobile */
padding: 24px; /* Desktop */
```

---

## Layout Spacing

### Container Padding

**Mobile:**
```css
padding-inline: 16px; /* 16px on left/right */
padding-block: 24px;  /* 24px on top/bottom */
```

**Tablet:**
```css
padding-inline: 24px;
padding-block: 32px;
```

**Desktop:**
```css
padding-inline: 32px;
padding-block: 48px;
```

### Section Spacing

**Between sections:**
```css
/* Mobile */
margin-bottom: 48px;

/* Desktop */
margin-bottom: 64px;
```

**Hero section:**
```css
/* Mobile */
padding-block: 48px;

/* Desktop */
padding-block: 96px;
```

### Grid Gaps

**Card grids:**
```css
/* Mobile */
gap: 16px;

/* Desktop */
gap: 24px;
```

**Form grids:**
```css
gap: 24px; /* Between columns */
row-gap: 24px; /* Between rows */
```

---

## CSS Custom Properties

```css
:root {
  /* Spacing scale */
  --space-1: 0.5rem;  /* 8px */
  --space-2: 1rem;    /* 16px */
  --space-3: 1.5rem;  /* 24px */
  --space-4: 2rem;    /* 32px */
  --space-6: 3rem;    /* 48px */
  --space-8: 4rem;    /* 64px */
  --space-12: 6rem;   /* 96px */
  --space-16: 8rem;   /* 128px */
  
  /* Component spacing */
  --button-padding-x: var(--space-3); /* 24px */
  --button-padding-y: 0.75rem;        /* 12px */
  --card-padding: var(--space-4);     /* 32px */
  --input-padding-x: var(--space-2);  /* 16px */
  --input-padding-y: 0.75rem;         /* 12px */
  --section-gap: var(--space-8);      /* 64px */
  --element-gap: var(--space-3);      /* 24px */
}
```

**Usage:**
```css
.button {
  padding: var(--button-padding-y) var(--button-padding-x);
}

.card {
  padding: var(--card-padding);
  margin-bottom: var(--element-gap);
}

section {
  margin-bottom: var(--section-gap);
}
```

---

## Tailwind CSS Classes

```js
// tailwind.config.js
module.exports = {
  theme: {
    spacing: {
      '0': '0',
      '1': '0.25rem',  // 4px
      '2': '0.5rem',   // 8px
      '3': '0.75rem',  // 12px
      '4': '1rem',     // 16px
      '5': '1.25rem',  // 20px
      '6': '1.5rem',   // 24px
      '8': '2rem',     // 32px
      '10': '2.5rem',  // 40px
      '12': '3rem',    // 48px
      '16': '4rem',    // 64px
      '20': '5rem',    // 80px
      '24': '6rem',    // 96px
      '32': '8rem',    // 128px
    },
  },
}
```

**Common Tailwind classes:**
```html
<!-- Padding -->
<div class="p-4">   <!-- 16px all sides -->
<div class="px-6">  <!-- 24px left/right -->
<div class="py-8">  <!-- 32px top/bottom -->

<!-- Margin -->
<div class="m-4">   <!-- 16px all sides -->
<div class="mx-6">  <!-- 24px left/right -->
<div class="my-8">  <!-- 32px top/bottom -->
<div class="mb-6">  <!-- 24px bottom -->

<!-- Gap (Flexbox/Grid) -->
<div class="gap-4"> <!-- 16px gap -->
<div class="gap-6"> <!-- 24px gap -->
```

---

## Responsive Spacing

Adjust spacing for different screen sizes:

```css
/* Mobile-first approach */
.container {
  padding: 16px;           /* Mobile */
}

@media (min-width: 640px) {
  .container {
    padding: 24px;         /* Tablet */
  }
}

@media (min-width: 1024px) {
  .container {
    padding: 32px;         /* Desktop */
  }
}
```

**With Tailwind:**
```html
<div class="p-4 md:p-6 lg:p-8">
  <!-- 16px mobile, 24px tablet, 32px desktop -->
</div>
```

---

## Common Spacing Patterns

### Stack (Vertical spacing)
```css
.stack > * + * {
  margin-top: 16px; /* or 24px */
}
```

### Cluster (Horizontal spacing)
```css
.cluster {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
}
```

### Grid
```css
.grid {
  display: grid;
  gap: 24px;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
}
```

### Centered container
```css
.container {
  max-width: 1200px;
  margin-inline: auto;
  padding-inline: 24px;
}
```

---

## Spacing Decision Tree

**Choosing the right spacing:**

1. **Is it inside a component?**
   - Yes → Use smaller spacing (8-24px)
   - No → Use larger spacing (32-64px)

2. **Are items tightly related?**
   - Yes → Use 8-16px
   - No → Use 24-32px

3. **Is it a major section break?**
   - Yes → Use 48-96px
   - No → Use 16-32px

4. **Is it on mobile?**
   - Yes → Use smaller values (16-32px)
   - No → Can use larger (32-64px)

---

## Spacing Don'ts

❌ **Never:**
- Use random spacing values (13px, 27px, etc.)
- Use spacing < 8px (except for 4px in rare cases)
- Have inconsistent spacing between similar elements
- Cram elements together without breathing room
- Use same spacing for everything

✅ **Always:**
- Stick to 8px multiples
- Use more space on desktop
- Group related items with less space
- Separate sections with more space
- Be consistent across similar components

---

## Quick Reference

| Use Case | Spacing |
|----------|---------|
| Icon to text | 8px |
| Button padding | 12px 24px |
| Form field margin | 24px |
| Card padding | 24-32px |
| Section spacing | 48-64px |
| Container padding (mobile) | 16px |
| Container padding (desktop) | 32px |
| Between paragraphs | 16px |
| Major section break | 64-96px |

**Default rule:** When in doubt, use 24px.
