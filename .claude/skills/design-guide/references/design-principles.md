# Design Principles

## Core Philosophy

Build interfaces that are **clean, minimal, and functional**. Every element should have a purpose. If it doesn't add value, remove it.

## 1. Clean and Minimal

### White Space is Your Friend
- Use generous spacing to let content breathe
- Don't fill every pixel - emptiness creates focus
- Group related items, separate unrelated ones
- Better to have too much space than too little

### Declutter Ruthlessly
**Remove:**
- Unnecessary borders
- Redundant labels
- Decorative elements that don't serve a purpose
- Multiple competing calls-to-action
- Icons that duplicate text

**Keep:**
- Essential information
- Clear hierarchy
- Purposeful visual elements
- Single primary action per section

### Visual Hierarchy
Use size, weight, and spacing (not color) to create hierarchy:
1. **Primary:** Largest, boldest - main heading or action
2. **Secondary:** Medium size - supporting content
3. **Tertiary:** Smallest - metadata, captions

---

## 2. Neutral Color Palette

### Base Colors
Use grays and off-whites as your foundation:

**Whites & Light Grays (Backgrounds):**
- Pure white: `#FFFFFF` (use sparingly, can be harsh)
- Off-white: `#FAFAFA`, `#F5F5F5` (better for backgrounds)
- Light gray: `#F0F0F0`, `#E5E5E5` (for subtle differentiation)

**Mid Grays (Borders, Disabled States):**
- `#D1D5DB` (light borders)
- `#9CA3AF` (disabled text, secondary elements)
- `#6B7280` (secondary text)

**Dark Grays (Text):**
- `#374151` (body text)
- `#1F2937` (headings)
- `#111827` (primary headings, highest contrast)

### Accent Color
Pick ONE accent color for:
- Primary buttons
- Links
- Important icons
- Active states
- Focus indicators

**Good accent choices:**
- Blue: `#3B82F6` (trust, professional)
- Green: `#10B981` (success, growth)
- Red: `#EF4444` (error, urgency)
- Orange: `#F59E0B` (energy, call-to-action)
- Teal: `#14B8A6` (modern, calm)

**Use your accent color for:**
- 5-10% of your design
- Only the most important actions
- Consistent interaction patterns (all primary buttons same color)

### What NOT to Do
❌ Rainbow gradients  
❌ Multiple bright accent colors  
❌ Purple/blue generic gradients  
❌ Neon colors  
❌ Every element a different color  
❌ Colored text for no reason  

### Color Usage Rules
1. **Text on backgrounds:** Maintain 4.5:1 contrast minimum (WCAG AA)
2. **Don't use color alone:** Add icons or text to convey meaning
3. **Semantic colors:**
   - Success: Green (`#10B981`)
   - Error: Red (`#EF4444`)
   - Warning: Orange/Yellow (`#F59E0B`)
   - Info: Blue (`#3B82F6`)

---

## 3. Consistent Spacing (8px Grid)

### The 8px System
All spacing should be multiples of 8px:
- **8px** (0.5rem): Tight spacing (icon to text)
- **16px** (1rem): Standard gap between elements
- **24px** (1.5rem): Section spacing
- **32px** (2rem): Comfortable padding
- **48px** (3rem): Large section breaks
- **64px** (4rem): Major section divisions

### Application

**Component Padding:**
- Button: `12px 24px` (vertical horizontal)
- Card: `24px` or `32px`
- Input field: `12px 16px`
- Container: `32px` or `48px`

**Component Margins:**
- Between text blocks: `16px` or `24px`
- Between sections: `48px` or `64px`
- Between small UI elements: `8px` or `16px`

**Why 8px?**
- Scales well on all screens (divisible by 2)
- Creates visual rhythm
- Makes decisions easier (limited options)
- Aligns with common design systems

---

## 4. Typography

### Font Selection
**Maximum 2 fonts:**
1. **Heading font:** Can be distinctive (but still readable)
2. **Body font:** Must be highly readable

**Good combinations:**
- Inter (all-purpose sans-serif)
- SF Pro (Apple's system font)
- Roboto (Google's standard)
- System font stack: `-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`

**Avoid:**
- Script fonts (except for logos)
- Decorative fonts for body text
- More than 2 font families
- Inconsistent font usage

### Size Scale
Use a clear hierarchy:

**Headings:**
- H1: `32px` (2rem) - `48px` (3rem)
- H2: `24px` (1.5rem) - `32px` (2rem)
- H3: `20px` (1.25rem) - `24px` (1.5rem)
- H4: `18px` (1.125rem) - `20px` (1.25rem)

**Body:**
- Large body: `18px` (1.125rem)
- Standard body: `16px` (1rem) - **MINIMUM**
- Small text: `14px` (0.875rem) - Use sparingly
- Captions: `12px` (0.75rem) - Metadata only

**Never go below 16px for body text.** Mobile users will struggle to read smaller text.

### Font Weights
Use weight to create hierarchy, not size alone:
- **Bold (700):** Headings, important text
- **Semi-bold (600):** Sub-headings, emphasis
- **Normal (400):** Body text
- **Light (300):** Use sparingly, can be hard to read

### Line Height
- **Headings:** 1.2 - 1.3 (tight, since they're large)
- **Body text:** 1.5 - 1.6 (comfortable reading)
- **Small text:** 1.4 - 1.5

### Letter Spacing
- **Headings:** `-0.02em` to `0em` (slightly tighter)
- **Body:** `0em` (default)
- **Uppercase text:** `0.05em` to `0.1em` (slightly wider)
- **Small caps:** `0.1em` to `0.15em`

---

## 5. Subtle Shadows

### Shadow Principles
Shadows should:
- Suggest elevation, not scream for attention
- Be soft and diffused, not hard edges
- Use appropriate blur radius
- Match light direction (consistent across UI)

### Shadow Scale

**No Shadow (0):**
- Flat elements
- Inline text
- Disabled states

**Subtle (1):**
```css
box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05);
```
Use for: Slight separation, input fields, subtle cards

**Small (2):**
```css
box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.1), 
            0 1px 2px 0 rgba(0, 0, 0, 0.06);
```
Use for: Buttons, cards, dropdowns

**Medium (3):**
```css
box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 
            0 2px 4px -1px rgba(0, 0, 0, 0.06);
```
Use for: Raised cards, modals

**Large (4):**
```css
box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 
            0 4px 6px -2px rgba(0, 0, 0, 0.05);
```
Use for: Popovers, floating panels

**Extra Large (5):**
```css
box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 
            0 10px 10px -5px rgba(0, 0, 0, 0.04);
```
Use for: Modals, dialogs (rarely needed)

### What NOT to Do
❌ Heavy, dark shadows (`rgba(0,0,0,0.5)`)  
❌ Shadows on every element  
❌ Inconsistent shadow directions  
❌ Colored shadows (except for focus states)  

---

## 6. Rounded Corners

### When to Round
**Round corners for:**
- Buttons
- Cards
- Input fields
- Images (sometimes)
- Modals
- Badges/pills

**Keep square for:**
- Overall layout containers
- Data tables
- Dense information displays
- When sharp edges fit your brand

### Border Radius Scale
- **None:** `0px` (square corners)
- **Small:** `4px` (subtle rounding)
- **Medium:** `8px` (standard for most UI)
- **Large:** `12px` to `16px` (cards, modals)
- **XL:** `24px` (hero sections, large cards)
- **Full:** `9999px` or `50%` (pills, circular avatars)

### Consistency Rules
1. Pick 2-3 radius values and stick to them
2. Smaller elements = smaller radius
3. Larger elements = larger radius
4. Related elements use same radius

**Example system:**
- Buttons, inputs: `8px`
- Cards, containers: `12px`
- Pills, badges: `9999px`

---

## 7. Clear Interactive States

Every interactive element needs visible states.

### Button States

**Default:**
- Clear background color
- Readable text
- Appropriate padding

**Hover:**
- Slightly darker background (10-20% darker)
- Subtle scale (`transform: scale(1.02)`) - optional
- Cursor changes to pointer

**Active (Pressed):**
- Even darker than hover
- Slightly smaller scale (`scale(0.98)`)
- Instant visual feedback

**Focus:**
- Clear focus ring (for keyboard navigation)
- Use accent color outline
- `outline: 2px solid [accent-color]`
- `outline-offset: 2px`

**Disabled:**
- Reduced opacity (0.5 - 0.6)
- Gray out color
- No hover effects
- Cursor: `not-allowed`

### Link States

**Default:**
- Accent color text
- No underline (unless body text link)
- `text-decoration: none`

**Hover:**
- Underline appears
- Slightly darker color

**Visited:**
- Optional: slightly different shade
- Not always necessary in web apps

**Focus:**
- Same as button focus ring

### Input Field States

**Default:**
- Clear border (light gray)
- Appropriate padding
- Placeholder text (gray)

**Focus:**
- Accent color border
- Optional: subtle glow/shadow in accent color
- No outline (use border instead)

**Error:**
- Red border
- Red text or icon
- Error message below field

**Disabled:**
- Gray background
- Gray text
- Cursor: `not-allowed`

**Success:**
- Optional: Green border or checkmark
- Don't overuse

---

## 8. Mobile-First Thinking

### Design Approach
1. **Start with mobile** (320px - 375px width)
2. **Add complexity as space grows**
3. **Don't hide critical features on mobile**
4. **Touch targets minimum 44x44px**

### Responsive Breakpoints
```
Mobile: < 640px (sm)
Tablet: 640px - 1024px (md, lg)
Desktop: > 1024px (xl, 2xl)
```

### Mobile Considerations

**Touch Targets:**
- Minimum 44x44px (Apple guideline)
- Space between tap targets: 8px minimum
- Bigger is better (48x48px ideal)

**Typography:**
- Don't go below 16px (prevents zoom on iOS)
- Increase line height on mobile
- Shorter line lengths (45-75 characters)

**Layout:**
- Single column by default
- Stack elements vertically
- Hamburger menu for navigation (if needed)
- Bottom navigation bar (thumb-friendly)

**Interactions:**
- Swipe gestures for carousels
- Pull to refresh
- No hover states (use tap)
- Clear active states

**Performance:**
- Smaller images on mobile
- Lazy load below fold
- Minimize animations

---

## Common Pitfalls to Avoid

### Color Mistakes
❌ Rainbow gradients everywhere  
❌ Using color as only indicator (accessibility)  
❌ Low contrast text  
❌ Too many accent colors  

✅ Neutral base with one accent  
✅ High contrast text (4.5:1 minimum)  
✅ Color + icon for meaning  

### Typography Mistakes
❌ Text below 16px for body  
❌ 3+ different fonts  
❌ Inconsistent sizes  
❌ Poor line height (<1.4)  

✅ 16px minimum body  
✅ 2 fonts maximum  
✅ Clear size scale  
✅ 1.5-1.6 line height for body  

### Spacing Mistakes
❌ Random spacing values  
❌ Elements too close together  
❌ Inconsistent padding  
❌ No white space  

✅ 8px grid system  
✅ Generous spacing  
✅ Consistent padding  
✅ Let content breathe  

### Shadow Mistakes
❌ Heavy, dark shadows  
❌ Shadows everywhere  
❌ Inconsistent elevations  
❌ Colored shadows (usually)  

✅ Subtle, soft shadows  
✅ Use sparingly  
✅ Consistent shadow scale  
✅ Black with low opacity  

### Layout Mistakes
❌ Desktop-only thinking  
❌ Tiny tap targets on mobile  
❌ No responsive breakpoints  
❌ Horizontal scrolling  

✅ Mobile-first approach  
✅ 44x44px minimum taps  
✅ Proper breakpoints  
✅ Vertical scrolling only  

---

## Design Checklist

Before shipping any UI, verify:

**Color:**
- [ ] Primarily neutral (grays, off-whites)
- [ ] One accent color used sparingly
- [ ] No gradients (or very subtle)
- [ ] 4.5:1 contrast ratio for text

**Typography:**
- [ ] Maximum 2 font families
- [ ] 16px minimum for body text
- [ ] Clear size hierarchy
- [ ] Line height 1.5+ for body

**Spacing:**
- [ ] All spacing is multiple of 8px
- [ ] Consistent padding on similar elements
- [ ] Generous white space
- [ ] Elements properly grouped

**Interactive States:**
- [ ] Clear hover states
- [ ] Visible focus indicators
- [ ] Obvious disabled states
- [ ] Proper active/pressed states

**Mobile:**
- [ ] Works on 375px width
- [ ] Touch targets 44x44px minimum
- [ ] No text below 16px
- [ ] No horizontal scrolling

**Shadows:**
- [ ] Subtle and soft
- [ ] Consistent elevation scale
- [ ] Not overused
- [ ] Appropriate blur radius

**Overall:**
- [ ] Clean and minimal feel
- [ ] Not cluttered
- [ ] Clear visual hierarchy
- [ ] Professional appearance
