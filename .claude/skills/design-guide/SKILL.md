---
name: design-guide
description: Ensures every UI looks modern and professional with clean, minimal design. Enforces neutral color palette (grays with ONE accent color), 8px spacing grid, proper typography (16px minimum body text), subtle shadows, clear interactive states, and mobile-first approach. Prevents common mistakes like gradients, tiny text, and inconsistent spacing. Reference for all UI component design and implementation.
---

# Design Guide

Transform any UI into a modern, professional, clean interface following industry best practices.

## Core Design Philosophy

**Clean and minimal.** Every pixel should have a purpose. If an element doesn't add value, remove it.

**Neutral palette with one accent.** Use grays and off-whites as your base. Pick ONE accent color and use it sparingly (5-10% of design).

**Consistency over creativity.** Follow established patterns. Users appreciate familiar, predictable interfaces.

## When to Use This Skill

Apply this skill when:
- Building any UI component (buttons, forms, cards, navigation)
- Choosing colors for a design
- Setting spacing between elements
- Defining typography
- Creating interactive states (hover, focus, disabled)
- Reviewing designs for professionalism
- Converting designs to code (HTML/CSS/React/Tailwind)

**Default behavior:** Always follow these principles unless explicitly asked to deviate.

---

## Quick Design Rules

### 1. Color
- **Base:** Grays and off-whites (90% of design)
- **Accent:** Pick ONE color, use for primary actions only
- **Text:** Dark gray (`#374151`) on white, never pure black
- **Contrast:** Minimum 4.5:1 ratio for text

### 2. Spacing
- **Everything:** Multiples of 8px (8, 16, 24, 32, 48, 64)
- **Tight:** 8-16px between related items
- **Standard:** 24-32px between sections
- **Generous:** 48-64px between major sections

### 3. Typography
- **Body text:** 16px minimum (never smaller)
- **Fonts:** Maximum 2 font families
- **Line height:** 1.5-1.6 for body, 1.2-1.3 for headings
- **Weights:** Bold for headings, normal for body

### 4. Shadows
- **Subtle:** `0 1px 3px 0 rgba(0,0,0,0.1)`
- **Use sparingly:** Cards, buttons, dropdowns
- **Never:** Heavy shadows, shadows everywhere

### 5. Interactive States
- **Hover:** Slightly darker/lighter, subtle transform
- **Focus:** Clear outline ring (accessibility)
- **Active:** Even darker, slight scale down
- **Disabled:** 50-60% opacity, gray color

### 6. Mobile-First
- **Touch targets:** 44x44px minimum
- **Text size:** 16px minimum (prevents iOS zoom)
- **Layout:** Stack vertically on mobile
- **No hover:** Use clear tap states instead

---

## Design Workflow

### When Creating Components

1. **Start with structure**
   - Define the component hierarchy
   - Use semantic HTML
   - Plan for all states

2. **Apply spacing**
   - Use 8px grid system
   - Reference `assets/spacing-system.md`
   - Be consistent with similar components

3. **Choose colors**
   - Default to neutral grays
   - Use accent color only for primary actions
   - Reference `assets/color-system.md`
   - Check contrast ratios

4. **Set typography**
   - Use size scale from principles
   - Minimum 16px for body
   - Clear hierarchy through size and weight

5. **Add interactive states**
   - Define hover behavior
   - Add focus rings for accessibility
   - Show active/pressed state
   - Style disabled state

6. **Test mobile**
   - View at 375px width
   - Verify touch target sizes
   - Check text readability
   - Ensure no horizontal scroll

7. **Review against checklist**
   - Use design checklist in principles
   - Verify all states implemented
   - Check accessibility (contrast, focus)

---

## Component Guidance

### Buttons

**Good button characteristics:**
- Clear background color (solid, no gradients)
- Proper padding: `12px 24px` for standard size
- Readable text: 16px minimum
- Subtle shadow for depth
- Clear hover state (10-20% darker)
- Visible focus ring
- Disabled state is obvious (gray, reduced opacity)

**Implementation:**
```css
.button-primary {
  background: #3B82F6;        /* Accent color */
  color: #FFFFFF;
  padding: 12px 24px;
  border: none;
  border-radius: 8px;
  font-size: 16px;
  font-weight: 600;
  box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.1);
  cursor: pointer;
  transition: all 150ms ease;
}

.button-primary:hover {
  background: #2563EB;        /* Darker */
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
}

.button-primary:focus {
  outline: 2px solid #3B82F6;
  outline-offset: 2px;
}

.button-primary:disabled {
  background: #9CA3AF;
  opacity: 0.6;
  cursor: not-allowed;
}
```

**See:** `references/component-patterns.md` for complete button patterns.

---

### Cards

**Good card characteristics:**
- Clean white background
- Subtle shadow OR light border (not both)
- Consistent border-radius: 12px
- Proper padding: 24px or 32px
- Hover state if interactive (lift slightly)

**Implementation:**
```css
.card {
  background: #FFFFFF;
  border-radius: 12px;
  padding: 24px;
  box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.1),
              0 1px 2px 0 rgba(0, 0, 0, 0.06);
}

.card-interactive:hover {
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
  transform: translateY(-2px);
  transition: all 150ms ease;
}
```

**Alternative (border instead of shadow):**
```css
.card-bordered {
  background: #FFFFFF;
  border: 1px solid #E5E7EB;
  border-radius: 12px;
  padding: 24px;
}
```

**See:** `references/component-patterns.md` for card variations.

---

### Forms

**Good form characteristics:**
- Clear labels above inputs
- 16px minimum input text (mobile-friendly)
- Proper spacing between fields: 24px
- Clear focus state (accent color border)
- Obvious error state (red border + message)
- Adequate padding: `12px 16px`

**Implementation:**
```html
<div class="form-group">
  <label for="email">Email Address</label>
  <input 
    type="email" 
    id="email"
    placeholder="you@example.com"
  />
  <span class="help-text">We'll never share your email.</span>
</div>
```

```css
.form-group {
  margin-bottom: 24px;
}

label {
  display: block;
  font-size: 14px;
  font-weight: 600;
  color: #374151;
  margin-bottom: 8px;
}

input {
  width: 100%;
  padding: 12px 16px;
  font-size: 16px;              /* Minimum! */
  border: 1px solid #D1D5DB;
  border-radius: 8px;
  transition: border-color 150ms ease;
}

input:focus {
  outline: none;
  border-color: #3B82F6;        /* Accent color */
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

input.error {
  border-color: #EF4444;
}

.help-text {
  display: block;
  font-size: 14px;
  color: #6B7280;
  margin-top: 8px;
}

.error-message {
  color: #EF4444;
  font-size: 14px;
  margin-top: 8px;
}
```

**See:** `references/component-patterns.md` for complete form patterns.

---

## Reference Materials

### Design Principles
`references/design-principles.md` - Comprehensive guide covering:
- Clean and minimal design philosophy
- Neutral color palette rules
- 8px spacing system explained
- Typography hierarchy and sizing
- Shadow scale and usage
- Rounded corner guidelines
- Interactive state requirements
- Mobile-first approach
- Common pitfalls to avoid
- Complete design checklist

**Read this** for deep understanding of WHY these rules exist.

### Component Patterns
`references/component-patterns.md` - Specific implementations for:
- Buttons (all variants and states)
- Cards (shadow, border, interactive)
- Forms (inputs, labels, errors)
- Navigation (top nav, mobile)
- Modals and dialogs
- Tables (responsive)
- Badges and pills
- Lists
- Tooltips
- Loading states
- Empty states

**Reference this** when building any specific component.

### Color System
`assets/color-system.md` - Complete color reference:
- Full neutral gray palette (50-900)
- Accent color options (blue, green, red, orange, teal, indigo)
- Semantic colors (success, error, warning, info)
- Color usage guidelines
- Contrast ratios and accessibility
- CSS variables setup
- Tailwind configuration

**Use this** when choosing any color.

### Spacing System
`assets/spacing-system.md` - Complete spacing reference:
- 8px grid scale explained
- Component-specific spacing
- Layout spacing patterns
- Responsive spacing
- CSS custom properties
- Tailwind classes
- Common spacing patterns
- Spacing decision tree

**Use this** for all spacing decisions.

---

## Common Mistakes & Fixes

### ❌ Mistake: Rainbow gradients
**Problem:** Looks unprofessional, distracting  
**Fix:** Use solid colors from neutral palette

### ❌ Mistake: Text below 16px
**Problem:** Hard to read, iOS zooms in  
**Fix:** 16px minimum for body text, 14px only for captions

### ❌ Mistake: Inconsistent spacing
**Problem:** Feels chaotic, unprofessional  
**Fix:** Use 8px grid system consistently

### ❌ Mistake: Heavy shadows everywhere
**Problem:** Looks dated, cluttered  
**Fix:** Subtle shadows on few elements only

### ❌ Mistake: Purple/blue gradients
**Problem:** Generic, overused  
**Fix:** Solid accent color, used sparingly

### ❌ Mistake: Multiple accent colors
**Problem:** Confusing, no clear hierarchy  
**Fix:** Pick ONE accent color for all primary actions

### ❌ Mistake: No hover states
**Problem:** User doesn't know what's clickable  
**Fix:** Add clear hover feedback (darker color, shadow)

### ❌ Mistake: Tiny touch targets on mobile
**Problem:** Hard to tap, frustrating  
**Fix:** Minimum 44x44px for all interactive elements

### ❌ Mistake: No spacing between elements
**Problem:** Cramped, hard to scan  
**Fix:** Use generous spacing (24-32px between sections)

### ❌ Mistake: Random border radius
**Problem:** Inconsistent feel  
**Fix:** Pick 2-3 radius values (8px, 12px, full)

---

## Implementation Examples

### React Component with Tailwind

```jsx
function PrimaryButton({ children, onClick, disabled }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="
        px-6 py-3 
        bg-blue-500 hover:bg-blue-600 active:bg-blue-700
        text-white font-semibold text-base
        rounded-lg
        shadow-sm hover:shadow-md
        transition-all duration-150
        focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2
        disabled:bg-gray-400 disabled:opacity-60 disabled:cursor-not-allowed
      "
    >
      {children}
    </button>
  );
}
```

### Vanilla CSS

```css
/* Following all design principles */
.card-component {
  /* Color: White background */
  background: #FFFFFF;
  
  /* Spacing: 8px grid */
  padding: 32px;
  margin-bottom: 24px;
  gap: 16px;
  
  /* Rounded corners */
  border-radius: 12px;
  
  /* Subtle shadow */
  box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.1),
              0 1px 2px 0 rgba(0, 0, 0, 0.06);
  
  /* Mobile-first */
  display: flex;
  flex-direction: column;
}

.card-component h2 {
  /* Typography: Clear hierarchy */
  font-size: 24px;
  font-weight: 700;
  color: #1F2937;
  line-height: 1.2;
  margin-bottom: 16px;
}

.card-component p {
  /* Typography: Readable body text */
  font-size: 16px;
  color: #374151;
  line-height: 1.5;
  margin-bottom: 16px;
}

/* Interactive state */
.card-component:hover {
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
  transform: translateY(-2px);
  transition: all 150ms ease;
}

/* Mobile adjustments */
@media (max-width: 640px) {
  .card-component {
    padding: 24px;
  }
}
```

---

## Design Review Checklist

Before considering any UI complete, verify:

**Color ✓**
- [ ] Primarily neutral (grays, off-whites)
- [ ] One accent color used sparingly
- [ ] No gradients (or very subtle if necessary)
- [ ] Text has 4.5:1 contrast ratio minimum
- [ ] No rainbow colors

**Typography ✓**
- [ ] Maximum 2 font families
- [ ] 16px minimum for body text
- [ ] Clear size hierarchy (H1 > H2 > H3 > body)
- [ ] Line height 1.5+ for body text
- [ ] Proper font weights (bold for headings)

**Spacing ✓**
- [ ] All spacing is multiple of 8px
- [ ] Consistent padding on similar elements
- [ ] Generous white space
- [ ] Elements properly grouped
- [ ] Not cramped or cluttered

**Interactive States ✓**
- [ ] Clear hover states on all interactive elements
- [ ] Visible focus indicators (keyboard navigation)
- [ ] Obvious disabled states (gray, reduced opacity)
- [ ] Proper active/pressed states

**Mobile ✓**
- [ ] Works at 375px width
- [ ] Touch targets 44x44px minimum
- [ ] No text below 16px
- [ ] No horizontal scrolling
- [ ] Proper responsive breakpoints

**Shadows ✓**
- [ ] Subtle and soft shadows
- [ ] Consistent elevation scale
- [ ] Not overused (only where needed)
- [ ] Appropriate blur radius

**Overall ✓**
- [ ] Clean and minimal feel
- [ ] Not cluttered
- [ ] Clear visual hierarchy
- [ ] Professional appearance
- [ ] Consistent with design system

---

## Quick Decision Matrix

### Choosing Colors

| Use Case | Color |
|----------|-------|
| Page background | `#FAFAFA` (gray-50) |
| Card background | `#FFFFFF` (white) |
| Body text | `#374151` (gray-700) |
| Headings | `#1F2937` (gray-800) |
| Secondary text | `#6B7280` (gray-500) |
| Borders | `#D1D5DB` (gray-300) |
| Primary button | Your accent color |
| Links | Your accent color |
| Success | `#10B981` (green) |
| Error | `#EF4444` (red) |

### Choosing Spacing

| Use Case | Spacing |
|----------|---------|
| Icon to text | 8px |
| Related elements | 16px |
| Form fields | 24px |
| Section breaks | 48-64px |
| Button padding | 12px 24px |
| Card padding | 24-32px |
| Container (mobile) | 16px |
| Container (desktop) | 32px |

### Choosing Shadows

| Use Case | Shadow |
|----------|--------|
| Subtle separation | `0 1px 2px rgba(0,0,0,0.05)` |
| Cards, buttons | `0 1px 3px rgba(0,0,0,0.1)` |
| Raised cards | `0 4px 6px rgba(0,0,0,0.1)` |
| Modals | `0 20px 25px rgba(0,0,0,0.1)` |

---

## Remember

**Default approach:**
1. Start with neutral grays
2. Add ONE accent color
3. Use 8px spacing
4. 16px minimum text
5. Subtle shadows
6. Clear interactive states
7. Mobile-first

**When in doubt:**
- Less is more
- Consistency over creativity
- Function over form
- Simple over complex
- Proven patterns over novel ideas

**Quality markers:**
- Looks clean and professional
- Easy to scan and read
- Interactive elements are obvious
- Works well on mobile
- Accessible (contrast, focus states)

Apply these principles to EVERY component you build, unless explicitly asked to do otherwise.
