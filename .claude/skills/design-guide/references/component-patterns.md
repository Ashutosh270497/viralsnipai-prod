# Component Patterns

Specific guidance for common UI components with good and bad examples.

---

## Buttons

### Good Button Design

**Primary Button:**
```css
background: #3B82F6; /* Accent color */
color: #FFFFFF;
padding: 12px 24px;
border: none;
border-radius: 8px;
font-size: 16px;
font-weight: 600;
box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.1);
cursor: pointer;
transition: all 150ms ease;

/* Hover */
&:hover {
  background: #2563EB; /* 10-20% darker */
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
}

/* Active */
&:active {
  background: #1D4ED8;
  transform: scale(0.98);
}

/* Focus */
&:focus {
  outline: 2px solid #3B82F6;
  outline-offset: 2px;
}

/* Disabled */
&:disabled {
  background: #9CA3AF;
  cursor: not-allowed;
  opacity: 0.6;
}
```

**Secondary Button:**
```css
background: transparent;
color: #374151;
padding: 12px 24px;
border: 1px solid #D1D5DB;
border-radius: 8px;
font-size: 16px;
font-weight: 600;

&:hover {
  background: #F9FAFB;
  border-color: #9CA3AF;
}
```

**Ghost Button:**
```css
background: transparent;
color: #3B82F6; /* Accent color */
padding: 12px 24px;
border: none;
border-radius: 8px;
font-size: 16px;
font-weight: 600;

&:hover {
  background: rgba(59, 130, 246, 0.1);
}
```

### Bad Button Design

❌ **Don't:**
- Use gradients: `background: linear-gradient(purple, blue)`
- Make text too small: `font-size: 12px`
- Use insufficient padding: `padding: 4px 8px`
- Have no hover state
- Use multiple colors for primary actions
- Make buttons that don't look clickable

### Button Sizing

**Large:**
- Height: `48px` - `56px`
- Padding: `16px 32px`
- Font: `18px`
- Use: Hero sections, primary CTAs

**Medium (Standard):**
- Height: `40px` - `44px`
- Padding: `12px 24px`
- Font: `16px`
- Use: Most buttons

**Small:**
- Height: `32px` - `36px`
- Padding: `8px 16px`
- Font: `14px`
- Use: Secondary actions, compact UIs

### Button Groups

```css
.button-group {
  display: flex;
  gap: 12px; /* 8px or 12px spacing */
}

/* For attached buttons */
.button-group-attached button {
  border-radius: 0;
}

.button-group-attached button:first-child {
  border-radius: 8px 0 0 8px;
}

.button-group-attached button:last-child {
  border-radius: 0 8px 8px 0;
}
```

---

## Cards

### Good Card Design

**Subtle Shadow Card:**
```css
background: #FFFFFF;
border-radius: 12px;
padding: 24px;
box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.1),
            0 1px 2px 0 rgba(0, 0, 0, 0.06);

/* Hover (for interactive cards) */
&:hover {
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1),
              0 2px 4px -1px rgba(0, 0, 0, 0.06);
  transform: translateY(-2px);
}
```

**Border Card:**
```css
background: #FFFFFF;
border: 1px solid #E5E7EB;
border-radius: 12px;
padding: 24px;

&:hover {
  border-color: #D1D5DB;
}
```

### Bad Card Design

❌ **Don't:**
- Use both border AND heavy shadow
- Use colored backgrounds (unless subtle)
- Make padding too small (`padding: 8px`)
- Use gradients
- Over-decorate with multiple borders

### Card Variations

**Clickable Card:**
```css
cursor: pointer;
transition: all 150ms ease;

&:hover {
  box-shadow: [increase shadow];
  transform: translateY(-2px);
}

&:active {
  transform: translateY(0);
}
```

**Card with Header:**
```html
<div class="card">
  <div class="card-header">
    <h3>Title</h3>
  </div>
  <div class="card-body">
    <p>Content</p>
  </div>
  <div class="card-footer">
    <button>Action</button>
  </div>
</div>
```

```css
.card-header {
  padding-bottom: 16px;
  border-bottom: 1px solid #E5E7EB;
  margin-bottom: 16px;
}

.card-footer {
  padding-top: 16px;
  border-top: 1px solid #E5E7EB;
  margin-top: 16px;
}
```

---

## Forms

### Good Form Design

**Input Field:**
```css
input, textarea {
  width: 100%;
  padding: 12px 16px;
  font-size: 16px; /* Minimum! */
  border: 1px solid #D1D5DB;
  border-radius: 8px;
  background: #FFFFFF;
  color: #1F2937;
  transition: border-color 150ms ease;
}

input:focus, textarea:focus {
  outline: none;
  border-color: #3B82F6; /* Accent color */
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

input::placeholder {
  color: #9CA3AF;
}

/* Error state */
input.error {
  border-color: #EF4444;
}

input.error:focus {
  box-shadow: 0 0 0 3px rgba(239, 68, 68, 0.1);
}

/* Disabled state */
input:disabled {
  background: #F9FAFB;
  color: #9CA3AF;
  cursor: not-allowed;
}
```

**Label:**
```css
label {
  display: block;
  font-size: 14px;
  font-weight: 600;
  color: #374151;
  margin-bottom: 8px;
}
```

**Form Group:**
```css
.form-group {
  margin-bottom: 24px; /* Good spacing between fields */
}

.form-group label {
  display: block;
  margin-bottom: 8px;
}

.form-group input {
  width: 100%;
}

.form-group .error-message {
  color: #EF4444;
  font-size: 14px;
  margin-top: 8px;
}

.form-group .help-text {
  color: #6B7280;
  font-size: 14px;
  margin-top: 8px;
}
```

### Bad Form Design

❌ **Don't:**
- Make input text below 16px on mobile (iOS will zoom)
- Use insufficient padding (`padding: 4px`)
- Have unclear labels or no labels
- Place labels inside inputs (accessibility issue)
- Use unclear error states
- Stack fields too close together

### Form Layouts

**Vertical (Default):**
```html
<form>
  <div class="form-group">
    <label>Email</label>
    <input type="email" />
  </div>
  <div class="form-group">
    <label>Password</label>
    <input type="password" />
  </div>
  <button type="submit">Submit</button>
</form>
```

**Horizontal (Desktop Only):**
```css
.form-horizontal .form-group {
  display: grid;
  grid-template-columns: 150px 1fr;
  gap: 16px;
  align-items: center;
}

/* Mobile override */
@media (max-width: 640px) {
  .form-horizontal .form-group {
    grid-template-columns: 1fr;
  }
}
```

### Error States

```html
<div class="form-group has-error">
  <label>Email</label>
  <input type="email" class="error" value="invalid-email" />
  <span class="error-message">
    <svg><!-- Error icon --></svg>
    Please enter a valid email address
  </span>
</div>
```

```css
.error-message {
  display: flex;
  align-items: center;
  gap: 8px;
  color: #EF4444;
  font-size: 14px;
  margin-top: 8px;
}

.error-message svg {
  width: 16px;
  height: 16px;
  flex-shrink: 0;
}
```

---

## Navigation

### Good Navigation Design

**Top Navigation:**
```css
nav {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 24px;
  background: #FFFFFF;
  border-bottom: 1px solid #E5E7EB;
}

nav a {
  color: #6B7280;
  text-decoration: none;
  padding: 8px 16px;
  border-radius: 8px;
  font-weight: 500;
  transition: background 150ms ease;
}

nav a:hover {
  background: #F9FAFB;
  color: #1F2937;
}

nav a.active {
  color: #3B82F6; /* Accent */
  background: rgba(59, 130, 246, 0.1);
}
```

**Mobile Navigation (Hamburger):**
```css
.mobile-nav-button {
  display: none;
  width: 44px;
  height: 44px; /* Touch target size */
  padding: 8px;
  border: none;
  background: transparent;
}

@media (max-width: 640px) {
  .mobile-nav-button {
    display: block;
  }
  
  nav .nav-links {
    display: none;
    position: fixed;
    top: 60px;
    left: 0;
    right: 0;
    bottom: 0;
    background: #FFFFFF;
    padding: 24px;
  }
  
  nav .nav-links.open {
    display: block;
  }
}
```

### Bad Navigation Design

❌ **Don't:**
- Make nav items too small (< 44px touch target)
- Use unclear active states
- Have too many top-level items (>7)
- Use dropdown menus on mobile (use drawer instead)

---

## Modals & Dialogs

### Good Modal Design

```css
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
  z-index: 1000;
}

.modal {
  background: #FFFFFF;
  border-radius: 12px;
  max-width: 500px;
  width: 100%;
  max-height: 90vh;
  overflow-y: auto;
  box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1),
              0 10px 10px -5px rgba(0, 0, 0, 0.04);
}

.modal-header {
  padding: 24px;
  border-bottom: 1px solid #E5E7EB;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.modal-body {
  padding: 24px;
}

.modal-footer {
  padding: 24px;
  border-top: 1px solid #E5E7EB;
  display: flex;
  justify-content: flex-end;
  gap: 12px;
}
```

### Bad Modal Design

❌ **Don't:**
- Make modals full-screen on desktop
- Use dark overlay > 50% opacity
- Place close button in hard-to-reach spot
- Make modal content overflow without scrolling

---

## Tables

### Good Table Design

```css
table {
  width: 100%;
  border-collapse: collapse;
  background: #FFFFFF;
}

thead {
  border-bottom: 2px solid #E5E7EB;
}

th {
  text-align: left;
  font-size: 12px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: #6B7280;
  padding: 12px 16px;
}

td {
  padding: 16px;
  border-bottom: 1px solid #F3F4F6;
  color: #1F2937;
}

tr:hover {
  background: #F9FAFB;
}

tr:last-child td {
  border-bottom: none;
}
```

### Responsive Table (Mobile)

```css
@media (max-width: 640px) {
  /* Stack table as cards on mobile */
  table, thead, tbody, th, td, tr {
    display: block;
  }
  
  thead {
    display: none;
  }
  
  tr {
    margin-bottom: 16px;
    border: 1px solid #E5E7EB;
    border-radius: 8px;
    padding: 16px;
  }
  
  td {
    border: none;
    padding: 8px 0;
  }
  
  td:before {
    content: attr(data-label);
    font-weight: 600;
    display: inline-block;
    width: 100px;
    color: #6B7280;
  }
}
```

---

## Badges & Pills

### Good Badge Design

```css
.badge {
  display: inline-flex;
  align-items: center;
  padding: 4px 12px;
  font-size: 14px;
  font-weight: 600;
  border-radius: 9999px;
  white-space: nowrap;
}

/* Status badges */
.badge-success {
  background: #D1FAE5;
  color: #065F46;
}

.badge-error {
  background: #FEE2E2;
  color: #991B1B;
}

.badge-warning {
  background: #FEF3C7;
  color: #92400E;
}

.badge-info {
  background: #DBEAFE;
  color: #1E40AF;
}

.badge-neutral {
  background: #F3F4F6;
  color: #374151;
}
```

### Bad Badge Design

❌ **Don't:**
- Use bright neon colors
- Make text too small (< 12px)
- Use sharp corners (should be pill-shaped)
- Use gradients

---

## Lists

### Good List Design

```css
.list {
  list-style: none;
  padding: 0;
  margin: 0;
}

.list-item {
  padding: 16px;
  border-bottom: 1px solid #F3F4F6;
  display: flex;
  align-items: center;
  gap: 16px;
}

.list-item:last-child {
  border-bottom: none;
}

.list-item:hover {
  background: #F9FAFB;
}

/* Clickable list items */
.list-item-clickable {
  cursor: pointer;
  transition: background 150ms ease;
}

.list-item-clickable:active {
  background: #F3F4F6;
}
```

---

## Tooltips

### Good Tooltip Design

```css
.tooltip {
  position: absolute;
  background: #1F2937;
  color: #FFFFFF;
  padding: 8px 12px;
  border-radius: 6px;
  font-size: 14px;
  max-width: 200px;
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
  z-index: 1000;
}

.tooltip::after {
  content: '';
  position: absolute;
  /* Arrow pointing down */
  top: 100%;
  left: 50%;
  transform: translateX(-50%);
  border: 6px solid transparent;
  border-top-color: #1F2937;
}
```

### Tooltip Guidelines
- Keep text concise (< 100 characters)
- Use for supplementary info only
- Don't hide critical information in tooltips
- Position relative to trigger element
- Ensure accessible via keyboard (focus)

---

## Loading States

### Good Loading Design

**Spinner:**
```css
.spinner {
  width: 24px;
  height: 24px;
  border: 3px solid #F3F4F6;
  border-top-color: #3B82F6; /* Accent */
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}
```

**Skeleton Loader:**
```css
.skeleton {
  background: linear-gradient(
    90deg,
    #F3F4F6 25%,
    #E5E7EB 50%,
    #F3F4F6 75%
  );
  background-size: 200% 100%;
  animation: loading 1.5s ease-in-out infinite;
  border-radius: 8px;
}

@keyframes loading {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}

.skeleton-text {
  height: 16px;
  margin-bottom: 8px;
}

.skeleton-heading {
  height: 24px;
  width: 60%;
  margin-bottom: 16px;
}
```

### Bad Loading Design

❌ **Don't:**
- Use animated gifs
- Have spinning elements everywhere
- Block entire UI unnecessarily
- Use colored/gradient spinners

---

## Empty States

### Good Empty State Design

```html
<div class="empty-state">
  <svg class="empty-icon"><!-- Icon --></svg>
  <h3>No items yet</h3>
  <p>Get started by creating your first item</p>
  <button>Create Item</button>
</div>
```

```css
.empty-state {
  text-align: center;
  padding: 64px 24px;
}

.empty-icon {
  width: 64px;
  height: 64px;
  color: #D1D5DB;
  margin-bottom: 16px;
}

.empty-state h3 {
  font-size: 18px;
  color: #1F2937;
  margin-bottom: 8px;
}

.empty-state p {
  color: #6B7280;
  margin-bottom: 24px;
}
```

---

## Component Checklist

Before considering a component complete:

- [ ] Follows 8px spacing grid
- [ ] Uses neutral colors + accent sparingly
- [ ] Has all interactive states (hover, active, focus, disabled)
- [ ] Text is 16px minimum (14px for small text only)
- [ ] Shadows are subtle if used
- [ ] Border radius is consistent
- [ ] Works on mobile (375px width)
- [ ] Touch targets are 44x44px minimum
- [ ] No gradients (or very subtle)
- [ ] Accessible (keyboard navigation, ARIA labels)
