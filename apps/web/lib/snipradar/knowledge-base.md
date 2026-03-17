# SnipRadar Knowledge Base — Complete Platform Guide

> This file is the authoritative source for the SnipRadar Assistant RAG chatbot.
> Ingest via: POST /api/snipradar/assistant/ingest (admin-only, uses INGEST_SECRET)
> Each H2 section becomes a logical docId chunk boundary.

---

## snipradar-platform-overview

SnipRadar is an AI-powered X (Twitter) growth platform built into ViralSnipAI. It helps content creators discover viral patterns, generate AI-written tweet drafts, schedule posts at optimal times, and track their growth through analytics — all in one integrated workspace.

What SnipRadar is designed for: creators who want to grow on X but struggle with consistency, ideas, or knowing what works in their niche. It is for people who want to post smarter, not just more — studying what goes viral and systematically replicating those patterns.

The SnipRadar ecosystem is separate from the YouTube side of ViralSnipAI. After logging in, you select which ecosystem to use: "YouTube" for video repurposing, or "X / SnipRadar" for X growth. You can switch between ecosystems at any time from the ecosystem switcher at the top of the sidebar.

Main navigation sections in SnipRadar:
1. Overview — dashboard with growth stats, activation progress, and workflow guidance
2. Discover — find viral tweets and track accounts in your niche (Tracker, Viral, Engagement tabs)
3. Inbox — research captures from the browser extension
4. Relationships — CRM for building strategic connections on X
5. Create — AI draft studio, hooks generator, templates, thread composer, style trainer, predictor
6. Publish — calendar, scheduler, best-time recommendations, automations, API
7. Analytics — post performance, follower growth, pattern breakdowns
8. Growth Plan — phased AI-generated roadmap to accelerate follower growth
9. Assistant — AI chat for platform guidance (you are here)

The default landing page when entering SnipRadar is the Assistant page at /snipradar/assistant.

---

## snipradar-getting-started

Getting started with SnipRadar takes about 5 minutes. Follow these steps in order to unlock the full platform.

Step 1 — Select the X ecosystem. After logging in to ViralSnipAI, you are prompted to select your primary ecosystem. Choose "X / SnipRadar." If you are already on the YouTube side, click the ecosystem switcher at the top of the sidebar and select X.

Step 2 — Connect your X account. Go to Overview or any SnipRadar page. You will see a "Connect X Account" prompt. Two options: OAuth 2.0 PKCE (recommended) gives full read and write access so SnipRadar can post on your behalf. Manual Bearer Token is read-only fallback if you prefer to post manually. Click "Connect with X" and complete the OAuth flow to get started.

Step 3 — Add tracked accounts in Discover. Go to Discover → Tracker. Add at least 3–5 X accounts in your niche that you want to study for viral patterns. SnipRadar monitors these accounts and surfaces their highest-performing tweets automatically every 6 hours.

Step 4 — Generate your first drafts. Go to Create → Drafts. Click "Generate Drafts." SnipRadar analyzes viral tweet patterns from your tracked accounts and creates 5–10 AI-written tweet drafts tailored to those patterns.

Step 5 — Schedule your first post. Go to Publish → Scheduler. Pick a draft from "Ready to Schedule," review the best-time heatmap, and lock it to a calendar slot. SnipRadar's smart scheduler will automatically post it at the right time.

Activation milestone: Scheduling your first draft unlocks the full activation badge on your Overview dashboard and marks your SnipRadar setup as complete.

---

## snipradar-connect-x-account

Connecting your X account is required to use most SnipRadar features. Here is how the connection works and how to manage it.

OAuth 2.0 PKCE (Full Access — Recommended):
1. From any SnipRadar page, click "Connect X Account" or go to Overview and find the account connection card.
2. Click "Connect with X." You are redirected to X's OAuth authorization page.
3. Review the requested permissions and click "Authorize App."
4. You are redirected back to SnipRadar. Your account is now connected.

With OAuth connected, SnipRadar can post tweets and threads on your behalf, read your followers and tweet metrics, refresh engagement data automatically, and power the smart scheduler for auto-posting.

Manual Bearer Token (Read-Only):
1. Go to your X Developer Portal (developer.twitter.com) and create an app.
2. Copy your Bearer Token.
3. In SnipRadar, paste it into the Bearer Token field on the account connection screen.

With a bearer token only, SnipRadar can read viral tweets, follower counts, and metrics, but cannot post on your behalf — you must post manually from X.

Refreshing your connection: X OAuth tokens expire periodically. If your connection stops working, go to Overview → Account card → "Refresh Connection." SnipRadar will re-authorize automatically. If that fails, disconnect and reconnect via OAuth.

Disconnecting your X account: Click your account card on the Overview page, then click "Disconnect." This removes all tokens but preserves your drafts, analytics, inbox, and other data in SnipRadar.

Multiple accounts: Currently one X account can be connected per SnipRadar workspace. Multi-account support is on the roadmap.

---

## snipradar-overview-dashboard

The Overview page is your SnipRadar home base. It shows your current growth stats, activation progress, and AI-driven guidance for what to do next.

Growth Stats card: Shows your current follower count, 7-day or 30-day growth, total tweets posted, average engagement rate, and average impressions per post. Use the period selector (7 days / 30 days) to switch the view. These stats update when SnipRadar refreshes your account data, up to 4 times per day.

Activation Progress card: Shows a checklist of milestones to complete SnipRadar setup: connect X account, add tracked accounts, analyze viral tweets, generate drafts, schedule your first post (the main activation milestone), and receive engagement on a posted tweet. Click the "Next step" link on the card to go directly to the next incomplete action.

Profile Audit card: SnipRadar grades your X profile (A/B/C/D) based on bio quality, pinned tweet, header image, profile photo, and posting consistency. The card shows specific quick-win changes you can make right now to improve your profile score.

Workflow Steps bar: A progress tracker showing how many accounts you are tracking, how many viral tweets have been fetched, how many are analyzed, and how many drafts are ready to post. Click the "Ready to create" pill to jump directly to the Draft Studio.

First Session card (new users only): If you have not yet posted any SnipRadar drafts, this card gives you three quick-start actions: Open Discover, Open Draft Studio, and Open Publish Calendar.

Low Data Guidance card: Appears when you have fewer than 3 posted SnipRadar drafts. Gives a checklist: connect account, publish 3 drafts, and let SnipRadar gather baseline engagement signals. Disappears once you hit these milestones and Analytics starts producing meaningful insights.

Growth Coach card: AI-generated, personalized recommendations based on your current metrics and activity. Updated each time your data refreshes. Example: "Your engagement rate dropped this week — try posting at Tuesday 9am based on your best-time data."

Feature Nav Cards: Quick-access cards to all major SnipRadar features with status indicators showing which are locked, active, or ready for action.

---

## snipradar-discover-tracker

The Tracker is where you build your research intelligence by choosing which X accounts to monitor. SnipRadar watches these accounts and surfaces their top-performing tweets so you can learn from proven patterns in your niche.

How to add a tracked account:
1. Go to Discover → Tracker tab.
2. Click "Add Tracked Account."
3. Type the X username (without the @) in the input field.
4. SnipRadar looks up the account on X to verify it exists.
5. Click "Add." The account appears in your tracker list immediately.

What SnipRadar tracks per account: latest viral tweets (refreshed every 6 hours via automated background job), follower count and growth trend, niche category tag, and total viral tweets captured.

Actions per tracked account:
- Refresh: Manually trigger an immediate fetch of the account's latest tweets. Minimum 5-minute interval between manual refreshes. Each manual refresh counts against your daily refresh quota.
- View: Jump to the Viral tab filtered to that account's tweets only.
- Untrack: Remove the account from your tracker. Historical viral tweets from that account are kept in your library.
- Assign niche: Tag the account with a niche label to organize your tracker and improve draft generation targeting.

How many accounts can I track?
- Free plan: 0 (feature locked, upgrade required)
- Plus plan: up to 10 tracked accounts
- Pro plan: up to 50 tracked accounts

When you reach your account limit, the Add button is disabled and shows an upgrade prompt.

Choosing the right accounts to track: Pick creators in your exact niche who post consistently (at least 3 tweets per week). Look for accounts with 5,000–500,000 followers — large enough to have viral data, small enough to have achievable benchmarks. Include 1–2 mega-accounts in your niche as reference benchmarks. Track accounts that consistently go viral, not just accounts with large followings.

Automatic account seeding: If you selected a niche during onboarding, SnipRadar automatically suggests 5–10 high-performing accounts in that niche as starter accounts. You can keep, remove, or add more at any time.

---

## snipradar-discover-viral

The Viral tab shows the highest-performing tweets from all your tracked accounts. This is the core data that powers SnipRadar's entire draft generation engine.

What you see per viral tweet:
- Author name, @username, and profile avatar
- Full tweet text
- Engagement metrics: Likes, Retweets, Replies, Impressions
- Media type badge: image, video, poll, thread, or text-only
- Analysis results (if the tweet has been analyzed): hook type, format, emotional trigger, viral score, why it worked, lessons learned

Filtering and searching: Use the account dropdown at the top to filter by a specific tracked account. Use the search bar to find tweets containing specific words or phrases.

Analyzing a viral tweet: Click "Analyze" on any tweet card. SnipRadar sends the tweet to the AI and extracts the hook type (how the tweet opens), format (content structure), emotional trigger (what emotion drives engagement), viral score (0–100 rating), why it worked (plain-English explanation), and lessons learned (2–3 actionable takeaways). Analysis results are saved permanently — you only need to analyze each tweet once.

Hook types the AI identifies: curiosity gap, question, statistic, story opener, contrarian opinion.
Formats the AI identifies: listicle, hot-take, thread-starter, call-to-action, narrative.
Emotional triggers the AI identifies: inspiration, fear, humor, validation, controversy, urgency.

Using viral tweets to inspire drafts: Click "Use as draft inspiration" on any analyzed tweet. This seeds the draft studio with the tweet's hook type, format, and emotional trigger as guidance for generating new drafts in your voice.

Saving engagement opportunities: Click "Save as engagement opportunity" to bookmark a viral tweet as a high-signal post worth replying to. It moves to Discover → Engagement tab.

How often are viral tweets fetched? SnipRadar runs an automatic fetch every 6 hours via a background job. You can also manually refresh individual accounts from the Tracker tab.

Viral feed quota:
- Plus plan: 2 manual feed refreshes per day
- Pro plan: 4 manual feed refreshes per day
The automatic 6-hour cron job does not count against this quota.

---

## snipradar-discover-engagement

The Engagement tab surfaces high-signal tweet opportunities in your niche — posts where a well-timed, thoughtful reply could get you visible to the right new audience.

What is an engagement opportunity? A tweet from a tracked account or niche signal that has strong early engagement. Replying to it while it is trending exposes you to the author's audience and increases your discoverability.

Per-opportunity actions:
- Generate Reply: AI generates a contextual, high-quality reply based on your niche and style profile. The reply appears below the tweet card for you to review and edit before copying to X.
- Save: Bookmark the opportunity for later. Saved opportunities are also linked to your Relationships CRM for follow-up tracking.
- View on X: Opens the original tweet on X in a new tab so you can read the full thread and post your reply directly.
- Track Author: Creates a relationship lead for the tweet's author in your Relationships CRM, starting a follow-up queue for this person.

Filtering opportunities: Filter by niche category, minimum engagement threshold, and time range (last 24h / 48h / 7 days).

Plan access: Free plan locks this feature. Plus and Pro plans have full access. Usage is counted per saved engagement opportunity.

Why engagement matters for growth: Replying to high-signal tweets in your niche is one of the fastest organic ways to gain followers. SnipRadar's AI-generated replies are designed to add genuine value rather than just seek attention — this builds real authority in your niche over time.

---

## snipradar-inbox

The Research Inbox stores everything you capture from the SnipRadar browser extension while browsing X. It acts as a research scratchpad that feeds directly into your draft studio.

What gets added to the inbox: tweets you save while browsing X using the extension keyboard shortcut (Alt+S), X profiles you save for research, threads you bookmark for analysis, and any tweet you save via the extension popup.

Inbox item statuses:
- New: just captured, not yet acted on
- Drafted: you clicked "Use in Draft Studio" and this item seeded a draft
- Tracked: you tracked the author as a relationship lead
- Archived: hidden but not deleted; can be restored at any time

Filtering your inbox: Click the status filter cards at the top (All / New / Drafted / Tracked / Archived). Use the search bar to find items by text content, username, label, or notes.

Per-item actions:

Use in Draft Studio: The most important action. Clicking this takes the captured content, generates a remixed version using AI, and seeds it directly into the Draft Studio pre-filled and ready to refine. The inbox item status changes to "Drafted" automatically. Go to Create → Drafts to find the seeded content.

Generate Reply: AI writes a contextual reply to the captured tweet. Copied to your clipboard with one click. Use it on X directly.

Generate Remix: AI rewrites the captured content in your voice and style as a standalone original tweet. Copied to clipboard for immediate use.

Track Author: Creates a relationship lead for the tweet's author. They appear in your Relationships CRM with all context from this inbox item — useful for building strategic follow-up sequences.

Archive / Restore: Archive hides the item from your main view without deleting it. Click Restore in the Archived filter to bring it back.

Permanent Delete: Removes the item entirely. Requires confirmation. Cannot be undone.

Bulk operations: Select multiple items using checkboxes to change status for all selected at once, delete all selected (with confirmation), or add labels to all selected simultaneously.

Labels: Add comma-separated labels to organize your inbox (e.g., "ideas, competitors, hooks"). Labels help you filter and find related items later. Maximum 8 labels per item.

Setting up the browser extension:
1. Load the extension from apps/browser-extension in the ViralSnipAI project (or install from Chrome Web Store when available).
2. Open Chrome and go to chrome://extensions. Enable "Developer mode."
3. Click "Load unpacked" and select the browser-extension folder.
4. The SnipRadar icon appears in your Chrome toolbar. Click it and sign in.
5. Browse X as normal. Use Alt+S to open the popup and save the focused tweet.
6. Use Alt+Shift+S to instantly save the focused tweet without opening the popup.
Saved items appear in your SnipRadar Inbox in real time.

---

## snipradar-relationships

The Relationships page is SnipRadar's built-in CRM for managing strategic connections on X. It turns passive engagement into an organized, prioritized follow-up system.

What is a relationship lead? Any X account you have flagged for intentional relationship building — someone you want to engage with consistently to build mutual visibility, collaboration opportunities, or access to their audience.

How leads get added: Click "Track Author" on any inbox item or engagement opportunity. SnipRadar can also auto-create leads when you save or reply to engagement opportunities from the Discover tab.

Lead stages and what they mean:
- New: Just captured or tracked. No meaningful interaction yet.
- Engaged: You have started a conversation — replied to their tweet, received a reply from them, or sent a DM.
- Priority: High-value relationship. Floats to the top of your queue.
- Follow-up: You have a scheduled follow-up action pending. Shows a due badge when the time arrives.
- Closed: Relationship is concluded or deprioritized.

Priority Score: Each lead gets a score from 0–100 computed automatically from: relationship stage (follow-up = highest boost), follower count (log-scale capped at 20 points), number of saved engagement opportunities from this author, number of replies you have sent to them, number of inbox captures from them, whether they are a tracked account (+10 points), and whether a follow-up is overdue (+12 points). Higher scores float to the top of the list — sort by priority score to see who needs attention most urgently.

Managing a lead: Click "Manage" on any lead card to expand the edit form:
- Stage: Change the relationship stage.
- Tags: Comma-separated persona tags (e.g., "investor, podcast-host, tech-founder").
- Next action: Free-text reminder of what to do next with this person.
- Follow-up at: Schedule a specific date and time for your next action. The lead shows a due badge when that time arrives.
- Notes: Multi-line notes about this person, conversation history, or context you want to remember.
Click Save to apply changes.

Interaction history: SnipRadar automatically logs interactions for each lead — when you save an opportunity from them, generate a reply to their tweet, track them from the inbox, or update their stage. The last 5 interactions appear on each lead card so you always have context at a glance.

Filtering relationships: Search by handle, display name, notes, or tags. Filter by stage using the dropdown. Toggle "Due follow-ups only" to focus on overdue items.

Stats summary (top of page): Total leads tracked, priority queue size, due follow-ups count, and replies sent this week.

---

## snipradar-create-drafts

The Draft Studio is the core of SnipRadar's content creation workflow. It combines AI draft generation, a live viral score predictor, and one-click tone rewriting.

Generating your first batch of drafts:
1. Go to Create → Drafts.
2. Click "Generate Drafts."
3. SnipRadar analyzes viral tweet patterns from your tracked accounts and creates 5–10 AI-written tweet drafts tailored to those patterns.
4. Drafts appear in the Active Drafts list immediately.

What makes generated drafts relevant: SnipRadar uses the hook types, formats, and emotional triggers from your analyzed viral tweets as blueprints. The resulting drafts follow proven patterns but are written as original content, not copies of tracked tweets.

The Live Draft Studio layout — clicking any draft opens a side-by-side editor:

Left side (Composer):
- Full tweet text editor (max 280 characters)
- Real-time character counter
- Quick emoji buttons (🚀 🔥 💡 ✅) for easy insertion
- Research seed label showing context when draft was seeded from inbox or template

Right side (Live Preview):
- "As seen on X" preview showing how your tweet will look
- Tone badge: Professional, Bold, Educational, or Meme
- Live Viral Score bar (0–100) — green for 80+, amber for 60–79, red below 60
- Hint text below the score bar explaining what to improve
- Tone rewrite buttons: Pro, Bold, Edu, Meme — instantly rewrites your draft in the selected tone
- Save Draft button

How the Live Viral Score works: As you type (with a 450ms debounce after your last keystroke), SnipRadar sends your draft text to the AI predictor. It scores from 1–100 based on hook strength, format clarity, emotional resonance, and alignment with viral patterns in your niche. The score updates in real time.

Score interpretation:
- 80–100: Strong viral potential. Post it.
- 60–79: Moderate potential. Tweak the hook or tighten the format.
- Below 60: Low potential. Consider a rewrite. Check the hint text for specific guidance.

Tone rewrite buttons: Click Pro, Bold, Edu, or Meme to instantly rewrite the current draft in that tone. Professional = authoritative, expert-positioning. Bold = punchy, contrarian, opinion-forward. Educational = step-by-step, value-first, informative. Meme = casual, humorous, culturally resonant.

Variant Lab (Plus and Pro only): Generates 3+ alternative versions of your current draft simultaneously, each using a different hook type or emotional angle. Click any variant to apply it to the composer. Useful when you want a different direction but are not sure which one to take.

Draft statuses:
- Draft (active): Ready for editing or scheduling.
- Scheduled: Locked to a calendar slot, will auto-post at the scheduled time.
- Posted: Already published to X.
- Rejected: Manually archived, not queued for posting.

Active Drafts list: Scrollable list of all your active (unscheduled) drafts. Each card shows text, created date, viral prediction score, and action buttons.

Scheduled Drafts section: Separate section showing drafts queued on the calendar with their scheduled publish timestamps.

Recently Posted section: Collapsed at the bottom. Shows your last 6 SnipRadar-posted tweets with actual engagement metrics (likes, retweets, replies, impressions). Useful for comparing predicted vs. actual performance.

---

## snipradar-create-hooks

The Hook Generator creates opening lines (hooks) for your tweets. The hook — the first 5–15 words — is the single most important factor in whether someone reads past the first line.

How to use the Hook Generator:
1. Go to Create → Hooks.
2. Enter your topic (e.g., "productivity for founders" or "investing in index funds").
3. Select an emotion or intent: Curiosity, Inspiration, Controversy, Validation, or Urgency.
4. Select a style: Punchy, Conversational, Data-driven, or Storytelling.
5. Click "Generate Hooks."
6. SnipRadar generates 5 hook variations instantly.

Hook types generated:
- Curiosity gap: "The one thing 99% of founders get wrong about..."
- Question: "Why do most developers hate Mondays? (It's not what you think)"
- Statistic: "82% of viral tweets share one structural pattern. Here it is:"
- Story opener: "I lost $40,000 in one day. Here is what I learned:"
- Contrarian: "Hot take: hustle culture is making you worse at your job."

Using a hook: Click "Use this hook" on any variation. The hook inserts into the draft composer on the Drafts tab as the opening line of a new draft. Complete the tweet body yourself or let the AI continue.

Hook quota:
- Free: 0 hook generations
- Plus: 20 hook generations per month
- Pro: 100 hook generations per month
Each click of "Generate Hooks" counts as 1 generation and produces 5 variations. Your remaining quota is shown on the page.

---

## snipradar-create-threads

The Thread Composer lets you write, generate, and schedule multi-tweet threads directly in SnipRadar. Threads consistently outperform single tweets for saves and follows.

How to create a thread:
1. Go to Create → Threads.
2. Click "New Thread."
3. Write the first tweet (this is your hook — make it compelling).
4. Click "Add tweet" to add more tweets to the sequence.
5. Each tweet is max 280 characters with its own character counter.
6. SnipRadar auto-numbers your tweets (1/ 2/ 3/ ...) in the preview.
7. Click "Save Thread" to save all tweets as a linked group of drafts.

AI thread generation: Click "Generate Thread" and provide a topic or seed text. SnipRadar creates a complete 5–8 tweet thread that flows logically from a strong hook to a conclusion with a clear call-to-action.

Scheduling a thread: Threads schedule as a unit. Set the publish time once and all tweets in the thread post sequentially, each a few seconds apart, preserving the thread structure on X.

Editing thread order: Drag and drop individual tweets to reorder them. Numbering updates automatically.

Thread variants: Use the Variant Lab button to generate alternative versions of individual tweets within the thread, or to regenerate the entire thread with a different tone or angle.

When to use threads vs single tweets: Use threads for your highest-value educational content — step-by-step guides, case studies, frameworks, story arcs. Use single tweets for hot takes, quick observations, and statistics. Threads get more saves and follows; single tweets get more likes and retweets.

---

## snipradar-create-templates

The Template Library is a curated collection of viral tweet structures you can fill in with your own content. Templates give you a proven framework so you never start from a blank page.

Browsing templates: Templates are organized by Category (Hook, Story, Listicle, Hot-Take, Thread Starter, Call-to-Action) and Niche (Tech, Finance, Fitness, Marketing, General). Use the dropdowns to filter to what is relevant.

What each template shows: the template text with [PLACEHOLDER] fields, a filled-in example in a real niche, and tags showing the hook type, format, and emotional trigger the template uses.

Using a template:
1. Find a template and click "Use Template."
2. The template loads in the draft composer with [PLACEHOLDER] fields highlighted.
3. Replace each placeholder with your specific content.
4. The live viral score updates as you fill in the placeholders.
5. Optionally click a tone variant button to adjust the voice.
6. Save as a draft when ready.

Example template (Listicle): "5 things I wish I knew about [TOPIC] before [SITUATION]: 1. [POINT 1] 2. [POINT 2] 3. [POINT 3] 4. [POINT 4] 5. [POINT 5] Save this. You'll thank yourself later."

Example template (Hot-Take): "Controversial opinion: [CONTRARIAN STATEMENT]. Here is why: [EXPLANATION]. Most people believe [COMMON BELIEF], but [YOUR REFRAME]. Change my mind."

---

## snipradar-create-research

The Research Copilot (Plus and Pro plans) is an AI-powered research tool that searches your entire SnipRadar knowledge base — viral tweets, engagement opportunities, templates, and your own past drafts — to surface relevant patterns and generate draft seeds.

How to use Research Copilot:
1. Go to Create → Research.
2. Type a topic, question, or content idea (e.g., "hooks about failure and resilience" or "what formats work for finance content").
3. SnipRadar searches your indexed content using semantic similarity (meaning-based, not just keyword matching).
4. You get a list of the most relevant viral tweets, templates, and past drafts sorted by relevance.
5. Each result shows a content snippet and a "Use as draft seed" button.
6. Click "Use as draft seed" to load that content into the draft studio as inspiration.

What gets indexed and searched:
- All analyzed viral tweets from your tracked accounts
- All saved engagement opportunities
- Your viral template library
- Your past active drafts

Plan access: Free plan locks this feature. Plus and Pro plans have full access.

The Research Copilot is most useful when you know what topic to write about but are not sure what angle, hook, or format to use. Let data from your own tracked accounts guide your content decisions rather than guessing.

---

## snipradar-create-style

The Style Trainer learns from your posting history to build a personal style profile that influences all AI-generated content, making drafts sound more like you.

How to train your style:
1. Go to Create → Style.
2. Click "Train on my posts." SnipRadar fetches your last 50 X posts.
3. The AI analyzes your vocabulary, tone, sentence length, common phrases, and posting patterns.
4. Your style profile is saved and automatically used in all future draft generation.

What the style profile captures: tone descriptors (e.g., "direct, data-driven, occasionally humorous"), common vocabulary and phrases you use, average tweet length preference, and hook type preferences based on your engagement history.

Manually editing style: After training, you can view and edit the tone descriptors manually. If the AI misread your style, adjust the descriptors to better match how you want to sound. Changes take effect immediately on the next draft generation.

Retraining: Retrain your style profile any time you have posted enough new content that your voice has evolved. The "Last trained" timestamp is shown on the Style page. Retraining over-writes the previous profile.

---

## snipradar-create-predictor

The Tweet Predictor lets you test the viral potential of any tweet text before committing to it — including text from outside SnipRadar.

How to use the Predictor:
1. Go to Create → Predictor.
2. Paste or type any tweet text into the input.
3. Select your niche from the dropdown.
4. Adjust the follower count slider to your current follower count (affects benchmark calibration).
5. Click "Predict."
6. SnipRadar returns a viral score (0–100) and a written suggestion for improving the tweet.

What the prediction is based on: hook strength of the opening line, format clarity, emotional resonance, and historical performance of similar tweets in your niche from your tracked accounts database.

Score interpretation:
- 80–100: Post it. Strong viral signals detected.
- 60–79: Tweak the hook or format before posting.
- Below 60: Significant rewrite recommended. Read the suggestion for specific guidance.

The same prediction engine runs live in the Draft Studio — every draft you write gets a real-time score as you type, with no need to go to the Predictor tab for your own drafts.

---

## snipradar-publish-scheduler

The Scheduler is SnipRadar's auto-posting engine. Once you lock a draft to a calendar slot, SnipRadar posts it automatically at the scheduled time using your connected X OAuth account.

How to schedule a draft:
1. Go to Publish → Scheduler.
2. The right column ("Ready to Schedule") shows all active unscheduled drafts.
3. Click a draft to preview it in the selected state.
4. In the calendar or scheduler view, pick a date and time slot.
5. Click "Schedule." The draft moves from "Ready to Schedule" to "Scheduled Drafts."
6. SnipRadar's cron job (runs every 6 hours) posts it automatically at the scheduled time.

Manual posting: Click "Process Queue Now" to immediately trigger the scheduler and post any drafts whose scheduled time has already passed. Use this when you want to post right now rather than waiting for the next cron cycle.

Scheduler status indicators:
- Active: Scheduler is running normally.
- Partial: Some posts succeeded, some failed. Check the error summary for details.
- Failed: All posts failed — usually an OAuth token expiry. Reconnect your X account.
- Empty: No drafts are currently scheduled.
- Locked: Your plan does not include scheduling. Upgrade to Plus or Pro.

What to do if the scheduler fails:
1. Check your X account connection on the Overview page.
2. If the OAuth token expired, go to Overview → Account card → "Refresh Connection."
3. If individual posts fail but not all, check the error summary for specific issues (content policy, duplicate content, rate limits from X's side).
4. Click "Process Queue Now" to retry any overdue scheduled posts manually.

Scheduling best practices: Keep 5–7 drafts in the scheduled queue at all times so you never miss a posting slot. Space posts at least 3–4 hours apart. Avoid scheduling more than 3 posts per day — X's algorithm generally rewards consistency over volume.

Plan access: Free plan locks scheduling. Plus and Pro plans include unlimited scheduled drafts.

---

## snipradar-publish-calendar

The Calendar gives you a visual timeline of all your scheduled drafts overlaid with best-time recommendations from your analytics data.

Calendar features:
- View scheduled drafts placed on a day-by-day, hour-by-hour calendar grid
- Color-coded time slots show engagement probability: green = high confidence, amber = moderate, gray = no data
- Heatmap overlay from your Best Times analysis shows which slots historically perform best for your audience
- Click any draft on the calendar to edit its content or reschedule it to a different slot
- Click any empty slot to schedule a new draft into that time

Using the calendar effectively: Cross-reference the heatmap with your scheduled slots — always aim for green, high-confidence slots. Space your posts to avoid more than 2–3 per day. For threads, look for slots with 30–60 minute gaps before and after so the thread gets full visibility before your next post interrupts the feed.

---

## snipradar-publish-best-times

The Best Times feature analyzes your posting history to find which days and hours consistently produce the highest engagement for your specific audience.

How it works: SnipRadar looks at every tweet you have posted through the platform, records the day of week and hour of posting, and correlates it with the actual engagement (likes + retweets + replies) that tweet received. After collecting enough data points, it builds a day-of-week by hour-of-day heatmap.

Reading the heatmap:
- Rows = days of the week (Monday through Sunday)
- Columns = hours of the day (12am through 11pm in your local timezone)
- Color intensity = average engagement score for posts in that slot

Confidence levels per slot:
- Low confidence: fewer than 5 posts in that slot — treat as directional only
- Medium confidence: 5–15 posts — reliable enough to start scheduling into
- High confidence: 15+ posts — strong signal, prioritize these slots

Minimum data required: You need at least 10 posted SnipRadar tweets for the heatmap to show meaningful patterns. If you are new, the Best Times page shows guidance to publish more before the analysis becomes reliable.

Refreshing the analysis: Click "Refresh" to re-run the analysis with the latest posting data. Useful after a period of consistent posting when new timing patterns may have emerged.

General X timing benchmarks (before you have enough personal data): Tuesday through Thursday tend to outperform weekends. Morning windows (7–9am) and early evening (6–8pm) in your audience's primary timezone typically perform well. However, always trust your own data over general benchmarks.

---

## snipradar-publish-automations

The Automations tab contains advanced rules for automatic content recycling and engagement actions.

Winner Loop (auto-repost best performers):
The Winner Loop automatically re-queues your top-performing drafts to maximize the reach of content that already proved it resonates.

How to configure the Winner Loop:
1. Enable the "Winner Loop" toggle.
2. Set the threshold: "Repost drafts in the top X% by engagement." For example, top 20% means only your truly viral posts get recycled.
3. Set the recycle interval: minimum number of hours between reposts of the same content.
4. Click Save.

SnipRadar monitors your posted drafts' engagement metrics, identifies top performers based on your threshold, and automatically queues them for reposting on a rolling schedule. Reposts are labeled in the Scheduled Drafts column so you can easily identify them vs. original content.

Auto-DM (plan gated): Automatically send a DM to users who engage heavily with your tweets (liked and retweeted). Useful for nurturing high-signal followers into your community. Configure trigger conditions, DM template content, and exclusion rules from the Auto-DM panel.

---

## snipradar-publish-api

The API tab is for developers and advanced users who want to integrate SnipRadar with external tools or build custom automated workflows.

API Keys: Generate a SnipRadar API key from the API tab. Use this key to authenticate requests to SnipRadar's API endpoints. Keys can be rotated at any time. Treat your API key like a password — never expose it publicly.

Webhooks: SnipRadar sends real-time webhook events to any HTTPS endpoint you control.

Available webhook events:
- post.published: A scheduled tweet was successfully posted to X
- post.engagement.updated: Engagement metrics updated on a posted tweet
- draft.scheduled: A draft was locked to a calendar slot

Adding a webhook:
1. Enter your endpoint URL (must be HTTPS).
2. Select the events you want to subscribe to.
3. Click Save. SnipRadar sends a test ping to verify your endpoint is reachable.
4. All events are delivered as JSON payloads with a signature header for verification.

Testing webhooks: Click "Send test event" next to any configured webhook to fire a sample payload. Use this to verify your integration is working before going live with real traffic.

---

## snipradar-analytics

The Analytics page gives you a comprehensive view of your X growth and post performance over time.

Period selector (plan-gated):
- Free plan: no analytics access
- Plus plan: 7-day window
- Pro plan: 30-day window

Summary metrics shown:
- Total SnipRadar posts: tweets published through SnipRadar in the selected period
- Total impressions: sum of impressions across all posts
- Total engagement: sum of likes + retweets + replies
- Average engagement rate: total engagement divided by total impressions, as a percentage
- Average impressions per post: your baseline reach per tweet
- Follower change: net followers gained or lost in the period

Follower Growth Chart: Line chart showing your follower count over time with one data point per day. An upward slope means healthy growth. A flat line signals a plateau — review your content patterns and posting consistency.

Post Performance Table: Sortable table of every SnipRadar post in the selected period. Columns include tweet text, content type, posted date, likes, retweets, replies, impressions, and engagement rate. Click any column header to sort. Click any row to view full tweet details.

Best Performing Tweet: The single highest-engagement tweet in the selected period, shown with full metrics and the viral prediction score SnipRadar assigned before it was posted. Useful for understanding the gap between predicted and actual performance.

Pattern Breakdowns: Charts showing which hook types, formats, and emotional triggers produced the most engagement in the period. Use these to guide your next draft generation batch — create more content using your top-performing patterns.

AI Performance Summary: A natural language narrative explaining your performance in plain English. Example: "Your best week was Feb 10–17. Educational-format tweets drove 3× more impressions than hot-take tweets. Your engagement rate is 40% above your 30-day average when you post on Tuesday mornings."

Engagement Heatmap: A day-of-week by hour-of-day grid showing your actual engagement per posting slot — similar to Best Times but showing retrospective performance data rather than forward-looking recommendations.

Scheduler Operations Panel: Shows the last 30 scheduler run results — timestamp, status (success / partial / failed), how many tweets were attempted, how many posted successfully, and error summaries. Use this to diagnose intermittent posting failures.

---

## snipradar-growth-planner

The Growth Planner generates a personalized, phased roadmap for growing your X following. It combines your current metrics, niche benchmarks, and SnipRadar's platform data to create a concrete action plan.

Plan access: Free and Plus plans have the Growth Planner locked. Pro plan includes full AI-generated Growth Plan access.

The three growth phases:

Phase 1 — Foundation (Weeks 1–2):
Goal: Establish baseline and posting rhythm.
Key actions: Train the AI on your last 50 posts (Create → Style), publish 5 times per week, run the Viral Feed daily in Discover.
Expected lift: +4% to +10% follower growth.

Phase 2 — Content Flywheel (Weeks 3–6):
Goal: Identify your best-performing patterns and double down on them.
Key actions: Generate daily drafts using proven viral formats from your top tracked accounts, test 2–3 different hook types per week, track winner patterns in Analytics weekly.
Expected lift: +12% to +25% follower growth.

Phase 3 — Amplification (Weeks 7+):
Goal: Scale reach using precision scheduling and engagement amplification.
Key actions: Use Best Times data for precision scheduling, enable Winner Loop for top performers, engage 3–5 high-signal accounts per day using Discover → Engagement.
Expected lift: +20% to +40% follower growth.

Fullscreen Growth Plan: Click "View Full Growth Plan" to open the detailed fullscreen view with specific daily actions, measurable goals per week, and direct links to the relevant SnipRadar tools for each step.

Using the Growth Plan as a weekly checklist: Treat the plan as a Monday to-do list rather than a one-time document. Revisit it every week and pick 3 specific actions to complete. Consistent small actions compound into significant follower growth over 30–60 days.

---

## snipradar-assistant-how-to-use

You are currently using the SnipRadar Assistant — an AI chat interface that answers your questions about how to use the SnipRadar platform effectively.

What the Assistant can help with:
- Explaining any SnipRadar feature in detail
- Guiding you step-by-step through any workflow
- Recommending which feature to use for a specific goal
- Troubleshooting issues like connection failures, scheduling errors, or missing data
- Suggesting the best SnipRadar strategy for your situation
- Explaining what specific metrics mean and how to act on them

How to use the Assistant:
- Type your question in the input box at the bottom and press Enter to send (Shift+Enter for a new line without sending).
- The Assistant streams its answer in real time — you will see text appearing as it is generated.
- Previous conversations are saved in the left sidebar. Click any past session to reload that full conversation history.
- Start a fresh conversation any time by clicking the "New chat" button at the top right.
- On the empty state, click any suggestion chip to get started quickly with a pre-written question.

Rate limits: Maximum 5 messages per minute (burst limit) and 20 messages per hour (hourly limit). If you hit a limit, a message tells you how long to wait before sending again.

Source tags: After each Assistant response you may see small colored pill tags (e.g., "connect account" or "discover tracker"). These show which sections of the knowledge base the answer was drawn from — useful for knowing which part of the platform the guidance relates to.

When the Assistant says it does not know: If a question is outside the knowledge base, the Assistant will say so honestly and point you to the right SnipRadar page or suggest reaching out to support. The Assistant is honest about uncertainty — it never fabricates information.

---

## snipradar-browser-extension

The SnipRadar browser extension is a Chrome Manifest V3 extension that lets you save tweets, profiles, and threads from X directly into your SnipRadar Research Inbox while browsing.

Installation:
1. The extension is available in the ViralSnipAI codebase under apps/browser-extension.
2. Open Chrome and go to chrome://extensions.
3. Enable "Developer mode" using the toggle in the top right.
4. Click "Load unpacked" and select the apps/browser-extension folder.
5. The SnipRadar icon appears in your Chrome toolbar. Pin it for easy access.
6. Click the icon and sign in with your SnipRadar account credentials.

Keyboard shortcuts:
- Alt+S: Open the extension popup showing a form to confirm and save the focused tweet.
- Alt+Shift+S: Instantly save the focused tweet to your inbox without opening the popup.

What can be saved:
- Individual tweets (text, metrics, author info)
- X profiles (username, display name, bio, follower count)
- Threads (entire thread captured as one inbox item)

How captures appear in SnipRadar: Saved items appear in your Research Inbox within seconds. They arrive with status "New" and are ready to analyze, remix, convert to drafts, or track the author.

Extension AI features available directly in Chrome:
- Reply Assist: While viewing a tweet on X, the extension generates an AI reply and can inject it directly into the X reply composer.
- Quick Draft: Save a tweet to your inbox and simultaneously generate a remixed draft version ready for the SnipRadar studio.

Troubleshooting the extension:
- If captures are not appearing in your inbox: check that you are signed in to the same SnipRadar account in both the extension and the web app.
- If the extension cannot inject a reply into X: refresh the X tab and try again — X's Lexical editor sometimes requires a full page reload.
- If sign-in fails in the extension: right-click the extension icon → Manage extension → Clear storage, then sign in again.
- If Alt+S does not work: another Chrome extension or system shortcut may be conflicting. Reassign the shortcut in chrome://extensions → Keyboard shortcuts.

---

## snipradar-billing-plans

SnipRadar features are gated by your ViralSnipAI billing plan. Here is a complete breakdown of what is included at each tier.

Free Plan — no cost:
- Connect 1 X account: included
- Overview dashboard: included (limited data)
- Tracked accounts: 0 — feature locked
- Viral feed: locked
- Hook Generator: 0 generations per month
- Draft Studio: locked
- Scheduling: locked
- Analytics: locked (no window)
- Variant Lab: locked
- Research Copilot: locked
- Engagement Finder: locked
- Growth Planner: locked
- SnipRadar Assistant: included with limited message rate

Starter / Plus Plan — ₹699/month (India) or $9/month (international):
- Tracked accounts: up to 10
- Viral feed manual refreshes: 2 per day
- Hook generations: 20 per month
- Draft Studio: included (unlimited drafts)
- Scheduling: included (unlimited scheduled drafts)
- Analytics: 7-day window
- Variant Lab: included
- Research Copilot: included
- Engagement Finder: included
- Growth Planner: locked

Creator Plan — ₹1,499/month or $18/month:
All Plus features plus:
- Tracked accounts: up to 25
- Viral feed manual refreshes: 4 per day
- Hook generations: 50 per month
- Analytics: 30-day window

Studio / Pro Plan — ₹3,599/month or $45/month:
All Creator features plus:
- Tracked accounts: up to 50
- Hook generations: 100 per month
- Growth Planner: included (AI-generated plan)
- Full API access and webhooks
- Priority support

Upgrading your plan: Go to the Billing page (accessible from the sidebar). Select your target plan and complete payment via Razorpay (India) or Stripe (international). New limits apply immediately after successful payment.

Usage quotas: Some features have per-day or per-month limits even on paid plans. Viral feed refreshes are counted per manual trigger (the automatic 6-hour cron is not counted). Hook generations are counted per generation session (5 hooks per session). When you approach a quota limit, SnipRadar shows a warning. When you hit the limit, the button is disabled and shows the reset time.

---

## snipradar-troubleshooting

Common issues and step-by-step solutions.

My X account disconnected or the token expired:
Go to Overview, click the account connection card, and click "Refresh Connection." If the refresh fails, click "Disconnect" and then reconnect via OAuth from scratch. Token expiry is common after 90 days of inactivity or if you changed your X password.

Drafts are not posting at the scheduled time:
1. Check that your X account is connected with a green status on the Overview page.
2. Go to Publish → Scheduler and check the scheduler health badge.
3. If status is "Failed," your OAuth token has likely expired. Reconnect your account from Overview.
4. Click "Process Queue Now" to manually trigger any overdue posts immediately.
5. Check the recent scheduler runs table in Analytics for detailed error messages per run.

Viral tweets are not appearing in the Discover feed:
1. Confirm you have at least one tracked account added in Discover → Tracker.
2. SnipRadar fetches viral tweets every 6 hours automatically. Wait for the next cycle if it recently ran.
3. Manually refresh a specific tracked account from the Tracker tab using the Refresh button.
4. Verify the tracked account posts regularly — inactive accounts produce no viral tweet data.

The live viral score is not updating in the draft studio:
The score requires at least 20 characters of text to activate. Make sure you have typed enough content. If the score still does not update after typing, check your internet connection and refresh the page.

My analytics show no data:
Analytics requires at least 10 SnipRadar-posted tweets to show meaningful data. The 7-day and 30-day windows are also plan-gated — confirm your plan includes the analytics feature. If you recently upgraded, analytics should start populating within 24 hours.

The browser extension is not saving tweets to my inbox:
1. Confirm you are signed in to SnipRadar in the extension popup.
2. Make sure you are on X (twitter.com or x.com) when using the keyboard shortcut.
3. Try reloading the X tab before using the shortcut.
4. If captures still fail, open Chrome DevTools on the extension's service worker and check the console for error messages.

I am hitting the Assistant rate limit:
The Assistant allows 5 messages per minute and 20 messages per hour. Wait the number of seconds shown in the error message. The burst limit resets after 60 seconds. The hourly limit resets after 60 minutes. Plan your questions in advance to use your message quota efficiently.

A feature shows as locked even though I have a paid plan:
Billing cache occasionally lags after an upgrade. Refresh the page first. If the feature is still locked after 5 minutes, log out and log back in to force a session refresh. If the issue persists, contact support with your account email and which feature is incorrectly locked.

---

## snipradar-tips-and-best-practices

Proven strategies for getting the most out of SnipRadar based on how the platform works.

Track the right accounts: Quality over quantity. 10 highly relevant, consistently posting accounts generate better draft inspiration than 50 loosely related accounts. Prioritize accounts that post in your exact niche with high engagement rates, not just high follower counts.

Analyze before generating: Before generating drafts, analyze at least 10–15 viral tweets in your Viral Feed. The more analyzed tweets SnipRadar has to learn from, the higher the quality of the generated drafts. Skipping analysis leads to generic drafts that do not match your niche patterns.

Use the Research Copilot before writing: Before starting a new draft batch, spend 2 minutes in Create → Research. Search for your topic to see which angles and formats already work in your niche. Use the results as inspiration rather than starting cold.

Maintain a consistent posting schedule: Consistency matters more than volume. Posting 5 times per week for 4 consecutive weeks produces better follower growth than posting 35 times in one week and going quiet. Use the Scheduler to keep 5–7 upcoming posts in the queue at all times.

Use the Variant Lab for testing: Generate the same core idea in multiple tones, then schedule variants spaced 3–5 days apart. Over time, your Analytics will reveal which tone your audience responds to best — use that data to guide your content style going forward.

Build relationships systematically: Do not only post and wait. Use the Discover → Engagement tab every day to find 3–5 opportunities for valuable replies on high-signal tweets. Track those authors in Relationships and engage consistently over 2–4 weeks. Genuine engagement with the same cluster of accounts builds real authority in your niche.

Use threads strategically: Post threads for your highest-value educational content — step-by-step guides, case studies, and frameworks. Use single tweets for hot takes, observations, and statistics. Threads get more saves and follows but fewer likes. Singles get more likes and retweets but lower save rates.

Follow the Best Times data — then test it: Start by scheduling into SnipRadar's recommended best-time slots. After 30 days, compare the actual engagement data in Analytics against those slots. Your audience may behave differently from the general patterns — trust your own data over generic advice after you have enough data points.

Use the Growth Plan as a weekly checklist: Treat the Growth Plan as a Monday action list rather than a one-time read. Each week, pick 3 specific actions from your current phase and execute them. Small consistent actions compound into significant follower growth over 60–90 days.

---

## snipradar-faq

Q: Can I use SnipRadar without connecting my X account?
A: You can browse the dashboard and create drafts without an X account connected, but you cannot fetch viral tweets from tracked accounts or schedule and post content. Connecting via OAuth unlocks the full platform.

Q: Does SnipRadar post tweets automatically without me reviewing them?
A: Only if you schedule them first. Drafts sit in the studio until you explicitly lock them to a calendar slot in Publish. The auto-scheduler only posts drafts you have already approved and scheduled. There is no mode that auto-posts content without your explicit scheduling action.

Q: Will SnipRadar-generated drafts get flagged by X as AI content?
A: SnipRadar generates drafts as starting points that you refine — not as finished content to copy-paste directly. Always personalize the draft with your specific examples, data points, and voice before posting. X's content policies apply to what you publish, not how you drafted it internally.

Q: What happens to my data if I downgrade my plan?
A: Your existing tracked accounts, drafts, analytics history, inbox items, and relationships are preserved. Features above your new plan tier become locked — they are read-only where possible — until you upgrade again.

Q: How is the viral score calculated?
A: The viral score (0–100) is a machine learning model trained on thousands of tweets across niches. It weighs hook strength (first 15 words), format clarity, emotional resonance, length optimization, and niche-specific pattern matching against your tracked accounts' top performers. It is a directional signal to guide you — not a guarantee of performance.

Q: How often does SnipRadar refresh my follower count and engagement metrics?
A: Up to 4 times per day via the automatic account sync job. You can also trigger a manual refresh from the Overview account card.

Q: Is my X OAuth token stored securely?
A: Yes. OAuth tokens are encrypted at rest. SnipRadar never stores your X password. Tokens are used only for posting scheduled tweets and reading metrics. You can revoke SnipRadar's access at any time from X's Settings → Connected Apps page — this also disconnects the account within SnipRadar.

Q: What does "analyzed" mean on a viral tweet?
A: An analyzed tweet has been processed by SnipRadar's AI to extract its hook type, format, emotional trigger, viral score, why it worked, and lessons learned. Unanalyzed tweets show only raw engagement numbers. Click "Analyze" to run the analysis — it takes 3–10 seconds and is saved permanently.

Q: Why does the scheduler show "Partial" instead of "Success"?
A: Partial means some tweets in the scheduled batch posted successfully but at least one failed. Check the error summary on the Scheduler page or the Scheduler Operations Panel in Analytics to see which tweet failed and why. Common causes: duplicate content detected by X, OAuth token needs refreshing, or a tweet violated X's content policy.

Q: How do I get the best results from the Hook Generator?
A: Be specific with your topic. "Productivity for early-stage startup founders who are overwhelmed" produces better hooks than just "productivity." Also try different emotion and style combinations for the same topic — Curiosity + Punchy tends to perform well in most niches as a starting point.

Q: Can I track the same account that multiple users on my team are tracking?
A: Currently SnipRadar does not have team or multi-seat plans. Each workspace is individual. Team collaboration features are on the roadmap.

Q: How do I know which of my tracked accounts are producing the most useful data?
A: Go to Discover → Tracker. The viral tweet count shown per account tells you how many high-engagement tweets SnipRadar has captured from that account. Accounts with higher viral tweet counts are generating more useful data for your draft generation. If an account has very few viral tweets after several weeks, consider replacing it with a more active account in your niche.
