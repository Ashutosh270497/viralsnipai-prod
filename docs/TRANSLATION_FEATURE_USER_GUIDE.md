# Multi-Language Translation Feature - User Guide

## Overview
The Multi-Language Translation feature allows you to translate video/audio transcripts into multiple languages using AI-powered translation. This feature is available in the **Repurpose** workspace.

## Location
**Navigation Path:** Repurpose Tab → Upload/Fetch Video → Translate Button

## Step-by-Step User Flow

### Step 1: Access the Repurpose Workspace
1. Navigate to the **Repurpose** tab from the main navigation
2. You'll see a page with project selection and upload options

### Step 2: Select or Create a Project
1. Use the **Project** dropdown to select an existing project
2. If you don't have a project, create one first from the Projects page
3. Once selected, the upload area will activate

### Step 3: Upload or Fetch Content
You have two options:

**Option A: Upload a Video/Audio File**
- Drag and drop a video or audio file into the upload dropzone
- Or click to browse and select a file
- Wait for the upload to complete

**Option B: Fetch from YouTube**
- Paste a YouTube URL in the "YouTube URL" field
- Click "Fetch from YouTube" button
- Wait for the download and processing to complete

### Step 4: Ensure Transcript is Available
- The video/audio must be transcribed first
- If not already transcribed, go to the project details page and transcribe the asset
- Return to the Repurpose tab once transcription is complete
- You'll see the transcript displayed in the "Latest asset" card

### Step 5: Access Translation Feature
- Look for the **"Translate"** button in the top-right corner of the "Latest asset" card
- This button appears only when a transcript is available
- Click the **"Translate"** button to open the translation dialog

### Step 6: Select Target Languages
1. A dialog titled **"Translate Transcript"** will open
2. You'll see a grid of available languages with their native names
3. Select up to **6 languages** by clicking on them
4. Selected languages are highlighted with a purple border and checkmark
5. The counter shows how many languages you've selected (e.g., "2 / 6 selected")

**Available Languages Include:**
- English, Hindi, Tamil, Telugu, Marathi, Gujarati, Bengali, Punjabi
- Spanish, French, German, Italian, Portuguese, Russian
- Chinese, Japanese, Korean, Arabic
- And many more...

### Step 7: Start Translation
1. Click the **"Translate (X)"** button (where X is the number of selected languages)
2. The dialog will show a progress indicator:
   - Animated progress bar showing 0-100%
   - Current percentage displayed
   - Number of languages being processed
3. Wait for the translation to complete (typically 10-30 seconds)

### Step 8: View Translations
1. Once complete, the dialog closes automatically
2. Scroll down below the upload area
3. You'll see a **"Translations"** card displaying all available translations
4. Each translation shows:
   - Language code badge (e.g., "HI", "ES")
   - Language name (e.g., "Hindi", "Spanish")
   - Translation timestamp (e.g., "Translated 2 minutes ago")

### Step 9: Read Translation Content
1. Click the **chevron down** icon on any translation item
2. The translated transcript text will expand below
3. The text is scrollable if it's long
4. Click the **chevron up** icon to collapse it

## Features and Benefits

### Smart Caching
- Languages list is cached for 5 minutes
- Reduces loading time on subsequent uses
- Automatic refresh when cache expires

### Existing Translation Reuse
- If you've already translated to a language, it will be reused
- No duplicate translations or wasted API calls
- Instant retrieval of existing translations

### Progress Tracking
- Real-time progress indicators during translation
- Visual feedback with animated progress bar
- Shows percentage completion

### Error Handling
- Automatic retry with exponential backoff
- Graceful failure handling
- Clear error messages if something goes wrong

### Performance Optimizations
- Memoized components prevent unnecessary re-renders
- Request cancellation prevents memory leaks
- Optimized rendering for large translation lists

## Tips and Best Practices

1. **Select Multiple Languages at Once**
   - Translate to multiple languages in one go for efficiency
   - Maximum 6 languages per translation request

2. **Check Existing Translations**
   - Scroll down to see if translations already exist
   - Re-selecting an existing language will reuse the cached translation

3. **Keep Transcripts Accurate**
   - Better transcripts lead to better translations
   - Review and edit transcripts before translating if needed

4. **Use for Localization**
   - Translate content for different regional audiences
   - Create multilingual content libraries

5. **Translation Quality**
   - AI translations preserve context and meaning
   - Technical terms are handled appropriately
   - Segment timing is maintained for video synchronization

## Troubleshooting

### "Translate" Button Not Visible
- **Cause:** No transcript available for the asset
- **Solution:** Transcribe the asset first from the project details page

### Translation Takes Too Long
- **Cause:** Large transcript or multiple languages
- **Solution:** Wait for completion; progress bar shows status

### Translation Failed
- **Cause:** Network issue or service unavailable
- **Solution:** Automatic retry will attempt 3 times; if still failing, try again later

### Empty Translations List
- **Cause:** No translations created yet
- **Solution:** Click the "Translate" button and select languages

## Supported Languages

The feature supports **50+ languages** including:

**South Asian Languages:**
- Hindi (hi), Tamil (ta), Telugu (te), Marathi (mr), Gujarati (gu)
- Bengali (bn), Punjabi (pa), Kannada (kn), Malayalam (ml), Urdu (ur)

**European Languages:**
- Spanish (es), French (fr), German (de), Italian (it), Portuguese (pt)
- Russian (ru), Polish (pl), Dutch (nl), Swedish (sv), Danish (da)

**East Asian Languages:**
- Chinese Simplified (zh), Japanese (ja), Korean (ko)
- Thai (th), Vietnamese (vi), Indonesian (id)

**Middle Eastern Languages:**
- Arabic (ar), Hebrew (he), Turkish (tr), Persian (fa)

**And many more...**

## Keyboard Shortcuts

Currently, there are no keyboard shortcuts for the translation feature. Use mouse/touch interactions.

## Mobile Support

The translation feature is fully responsive and works on:
- Desktop browsers
- Tablets (iPad, Android tablets)
- Mobile phones (iOS, Android)

## Privacy and Data

- Translations are stored in your project database
- Original transcripts are never modified
- All data remains within your account
- Translations can be deleted by deleting the parent asset

## Future Enhancements

Planned features for future releases:
- Caption file export in translated languages (.srt, .vtt)
- Batch translation across multiple assets
- Custom glossary support for technical terms
- Translation quality scoring
- Side-by-side comparison view

## Support

For issues or questions:
1. Check this user guide first
2. Review the troubleshooting section
3. Contact support with specific error messages
4. Include the project ID and asset ID for faster resolution

---

**Last Updated:** January 2025
**Feature Version:** 1.0.0
**Documentation Version:** 1.0.0
