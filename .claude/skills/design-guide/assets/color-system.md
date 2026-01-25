# Color System

A complete, professional color system following modern design principles.

## Neutral Grays (Base Palette)

Use these as your foundation for 90% of your design.

### White & Off-Whites
```css
--white: #FFFFFF;           /* Pure white - use sparingly */
--gray-50: #FAFAFA;         /* Lightest gray - main backgrounds */
--gray-100: #F5F5F5;        /* Very light gray - alternate backgrounds */
--gray-200: #E5E5E5;        /* Light gray - subtle borders */
```

**Usage:**
- `--white`: Cards on colored backgrounds
- `--gray-50`: Main page background
- `--gray-100`: Section backgrounds, hover states
- `--gray-200`: Dividers, borders on white

### Mid Grays
```css
--gray-300: #D1D5DB;        /* Light borders */
--gray-400: #9CA3AF;        /* Disabled text, placeholders */
--gray-500: #6B7280;        /* Secondary text */
--gray-600: #4B5563;        /* Body text (light backgrounds) */
```

**Usage:**
- `--gray-300`: Input borders, card borders
- `--gray-400`: Disabled states, placeholder text
- `--gray-500`: Secondary text, captions
- `--gray-600`: Primary body text

### Dark Grays
```css
--gray-700: #374151;        /* Headings, emphasized text */
--gray-800: #1F2937;        /* Primary headings */
--gray-900: #111827;        /* Darkest - highest contrast */
```

**Usage:**
- `--gray-700`: Standard headings
- `--gray-800`: Page titles, important headings
- `--gray-900`: Hero headings, brand text (use sparingly)

---

## Accent Colors

Pick ONE from this list as your primary accent color.

### Blue (Professional, Trust)
```css
--blue-50: #EFF6FF;
--blue-100: #DBEAFE;
--blue-200: #BFDBFE;
--blue-300: #93C5FD;
--blue-400: #60A5FA;
--blue-500: #3B82F6;        /* Primary */
--blue-600: #2563EB;        /* Hover */
--blue-700: #1D4ED8;        /* Active */
--blue-800: #1E40AF;
--blue-900: #1E3A8A;
```

**Use for:** SaaS, productivity, professional tools

### Green (Success, Growth)
```css
--green-50: #ECFDF5;
--green-100: #D1FAE5;
--green-200: #A7F3D0;
--green-300: #6EE7B7;
--green-400: #34D399;
--green-500: #10B981;       /* Primary */
--green-600: #059669;       /* Hover */
--green-700: #047857;       /* Active */
--green-800: #065F46;
--green-900: #064E3B;
```

**Use for:** Health, finance, sustainability

### Red (Error, Urgency)
```css
--red-50: #FEF2F2;
--red-100: #FEE2E2;
--red-200: #FECACA;
--red-300: #FCA5A5;
--red-400: #F87171;
--red-500: #EF4444;         /* Primary */
--red-600: #DC2626;         /* Hover */
--red-700: #B91C1C;         /* Active */
--red-800: #991B1B;
--red-900: #7F1D1D;
```

**Use for:** Error states, urgent actions, alerts

### Orange (Energy, Call-to-Action)
```css
--orange-50: #FFF7ED;
--orange-100: #FFEDD5;
--orange-200: #FED7AA;
--orange-300: #FDBA74;
--orange-400: #FB923C;
--orange-500: #F59E0B;      /* Primary */
--orange-600: #D97706;      /* Hover */
--orange-700: #B45309;      /* Active */
--orange-800: #92400E;
--orange-900: #78350F;
```

**Use for:** Marketing sites, e-commerce, creative tools

### Teal (Modern, Calm)
```css
--teal-50: #F0FDFA;
--teal-100: #CCFBF1;
--teal-200: #99F6E4;
--teal-300: #5EEAD4;
--teal-400: #2DD4BF;
--teal-500: #14B8A6;        /* Primary */
--teal-600: #0D9488;        /* Hover */
--teal-700: #0F766E;        /* Active */
--teal-800: #115E59;
--teal-900: #134E4A;
```

**Use for:** Wellness, design tools, modern apps

### Indigo (Premium, Tech)
```css
--indigo-50: #EEF2FF;
--indigo-100: #E0E7FF;
--indigo-200: #C7D2FE;
--indigo-300: #A5B4FC;
--indigo-400: #818CF8;
--indigo-500: #6366F1;      /* Primary */
--indigo-600: #4F46E5;      /* Hover */
--indigo-700: #4338CA;      /* Active */
--indigo-800: #3730A3;
--indigo-900: #312E81;
```

**Use for:** Tech products, premium tools (but avoid purple-blue gradients!)

---

## Semantic Colors

Always include these for consistent feedback.

### Success
```css
--success-light: #D1FAE5;   /* Backgrounds */
--success: #10B981;         /* Icons, text */
--success-dark: #065F46;    /* Dark mode text */
```

### Error
```css
--error-light: #FEE2E2;     /* Backgrounds */
--error: #EF4444;           /* Icons, text, borders */
--error-dark: #991B1B;      /* Dark mode text */
```

### Warning
```css
--warning-light: #FEF3C7;   /* Backgrounds */
--warning: #F59E0B;         /* Icons, text */
--warning-dark: #92400E;    /* Dark mode text */
```

### Info
```css
--info-light: #DBEAFE;      /* Backgrounds */
--info: #3B82F6;            /* Icons, text */
--info-dark: #1E40AF;       /* Dark mode text */
```

---

## Usage Guidelines

### Text Colors

**Primary text:**
```css
color: var(--gray-900);     /* Headings */
color: var(--gray-700);     /* Body text */
```

**Secondary text:**
```css
color: var(--gray-500);     /* Captions, metadata */
color: var(--gray-400);     /* Disabled text */
```

**Accent text:**
```css
color: var(--blue-500);     /* Links */
color: var(--blue-600);     /* Link hover */
```

### Background Colors

**Page backgrounds:**
```css
background: var(--gray-50); /* Main background */
background: var(--white);   /* Card backgrounds */
```

**Interactive backgrounds:**
```css
background: var(--blue-500);        /* Primary button */
background: var(--blue-600);        /* Button hover */
background: var(--blue-50);         /* Subtle highlight */
```

### Border Colors

```css
border-color: var(--gray-300);      /* Default borders */
border-color: var(--gray-200);      /* Subtle dividers */
border-color: var(--blue-500);      /* Focus states */
border-color: var(--red-500);       /* Error states */
```

---

## Color Combinations

### High Contrast (AA Accessible)

**Dark text on light backgrounds:**
- `--gray-900` on `--white` ✅ (14.8:1)
- `--gray-700` on `--white` ✅ (10.6:1)
- `--gray-600` on `--white` ✅ (7.0:1)
- `--gray-500` on `--white` ⚠️ (4.6:1 - minimum)

**Light text on dark backgrounds:**
- `--white` on `--gray-900` ✅ (14.8:1)
- `--gray-100` on `--gray-800` ✅ (11.2:1)
- `--gray-200` on `--gray-700` ✅ (7.4:1)

**Accent on backgrounds:**
- `--blue-500` on `--white` ✅ (4.6:1)
- `--white` on `--blue-500` ✅ (4.6:1)
- `--blue-700` on `--white` ✅ (8.6:1)

---

## CSS Variables Setup

```css
:root {
  /* Grays */
  --white: #FFFFFF;
  --gray-50: #FAFAFA;
  --gray-100: #F5F5F5;
  --gray-200: #E5E5E5;
  --gray-300: #D1D5DB;
  --gray-400: #9CA3AF;
  --gray-500: #6B7280;
  --gray-600: #4B5563;
  --gray-700: #374151;
  --gray-800: #1F2937;
  --gray-900: #111827;
  
  /* Choose ONE accent color family */
  --accent-50: #EFF6FF;
  --accent-100: #DBEAFE;
  --accent-200: #BFDBFE;
  --accent-300: #93C5FD;
  --accent-400: #60A5FA;
  --accent-500: #3B82F6;
  --accent-600: #2563EB;
  --accent-700: #1D4ED8;
  --accent-800: #1E40AF;
  --accent-900: #1E3A8A;
  
  /* Semantic colors */
  --success: #10B981;
  --success-light: #D1FAE5;
  --success-dark: #065F46;
  
  --error: #EF4444;
  --error-light: #FEE2E2;
  --error-dark: #991B1B;
  
  --warning: #F59E0B;
  --warning-light: #FEF3C7;
  --warning-dark: #92400E;
  
  --info: #3B82F6;
  --info-light: #DBEAFE;
  --info-dark: #1E40AF;
}
```

---

## Tailwind CSS Configuration

```js
// tailwind.config.js
module.exports = {
  theme: {
    extend: {
      colors: {
        gray: {
          50: '#FAFAFA',
          100: '#F5F5F5',
          200: '#E5E5E5',
          300: '#D1D5DB',
          400: '#9CA3AF',
          500: '#6B7280',
          600: '#4B5563',
          700: '#374151',
          800: '#1F2937',
          900: '#111827',
        },
        // Your chosen accent color
        accent: {
          50: '#EFF6FF',
          100: '#DBEAFE',
          200: '#BFDBFE',
          300: '#93C5FD',
          400: '#60A5FA',
          500: '#3B82F6',
          600: '#2563EB',
          700: '#1D4ED8',
          800: '#1E40AF',
          900: '#1E3A8A',
        },
      },
    },
  },
}
```

---

## Color Don'ts

❌ **Never use:**
- Rainbow gradients
- Multiple accent colors in one design
- Pure black (`#000000`) for text (too harsh)
- Neon colors
- Purple/blue generic gradients
- Background colors for every section

✅ **Always:**
- Stick to your neutral palette
- Use ONE accent color
- Maintain 4.5:1 contrast for text
- Use semantic colors consistently
- Test on actual devices

---

## Quick Reference

**When in doubt:**

**Text:** Use `--gray-700` for body, `--gray-900` for headings  
**Backgrounds:** Use `--gray-50` for pages, `--white` for cards  
**Borders:** Use `--gray-300` for most borders  
**Accent:** Use your chosen `--accent-500` for primary actions  
**Success:** Green  
**Error:** Red  
**Warning:** Orange  
**Info:** Blue  

Keep it simple. Neutral + one accent = professional.
