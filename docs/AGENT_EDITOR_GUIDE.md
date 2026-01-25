# Agent Editor Development Guide

## Overview

The Agent Editor is an AI-powered video enhancement system that uses 6 specialized agents to automatically improve your video clips.

## The 6 AI Agents

1. **Script Analyzer Agent** - Analyzes transcript for key moments, emotions, and pacing
2. **Asset Curator Agent** - Searches for relevant b-roll footage from Pexels
3. **Motion Designer Agent** - Designs transitions, animations, and text overlays
4. **Audio Enhancer Agent** - Optimizes audio and recommends music
5. **Style Matcher Agent** - Applies color grading and branding
6. **Editor Agent** - Assembles the final enhanced clip

## Running in Development Mode

### Option 1: Using Inngest (Recommended for Production)

1. Install Inngest CLI:
   ```bash
   npm install -g inngest-cli
   ```

2. Start the Inngest dev server:
   ```bash
   npx inngest-cli@latest dev
   ```

3. Jobs will automatically be processed when you launch them from the UI

### Option 2: Manual Processing (Development Only)

If you don't have Inngest running, the UI will show a **"Start Processing Now (Dev Mode)"** button for queued jobs.

1. Launch a job from the Agent Editor page
2. You'll see a yellow card saying "Job is waiting to be processed"
3. Click the **"Start Processing Now (Dev Mode)"** button
4. The job will be processed directly by the Next.js server

## Features

### Real-time Progress Monitoring

- **Active Job Monitor**: Shows current agent, overall progress percentage
- **Activity Feed**: Real-time timeline of all agent executions with timestamps and durations
- **Live Badge**: Indicates when the UI is connected and receiving updates

### Job Control

- **Cancel Button**: Stop a running job at any time
  - Located in the top-right of the Active Job Monitor
  - Will gracefully stop between agents
  - Cannot be undone

### Style Profiles

Create custom style profiles to apply consistent branding and color grading:

1. Go to "Agent Editor" > "Manage Style Profiles"
2. Create a new profile with:
   - Color grading settings (temperature, tint, contrast, etc.)
   - Aesthetics (vignette, film grain, sharpen, blur)
   - Composition settings (crop ratio, safe zones)
3. Select the profile when launching a job

## API Endpoints

### Create Job
```
POST /api/agent-editor/jobs
Body: { projectId, clipId?, config?: { styleProfileId? } }
```

### Get Jobs
```
GET /api/agent-editor/jobs?projectId={id}
```

### Get Job Details
```
GET /api/agent-editor/jobs/{jobId}
```

### Cancel Job
```
DELETE /api/agent-editor/jobs/{jobId}
```

### Manual Process (Dev Mode)
```
POST /api/agent-editor/jobs/{jobId}/process
```

## Troubleshooting

### Logs Not Appearing

- **Cause**: Job is queued but not processing
- **Solution**: Either start Inngest dev server OR click "Start Processing Now (Dev Mode)"

### Job Stuck in Queued Status

- **Cause**: Inngest is not running and manual processing wasn't triggered
- **Solution**: Click the "Start Processing Now (Dev Mode)" button that appears below the Activity Feed

### "No logs available yet"

- **Cause**: Job hasn't started processing yet
- **Solution**: Trigger processing using one of the methods above

## Environment Variables

Required environment variables:

```env
# OpenAI API Key for AI agents
OPENAI_API_KEY=sk-...

# Optional: Specific OpenAI model (default: gpt-4o-mini)
OPENAI_MODEL=gpt-4o-mini

# Optional: Pexels API key for b-roll footage
PEXELS_API_KEY=...
```

## Development Tips

1. **Check Logs**: View detailed execution logs by clicking "View Logs" on any job card
2. **Monitor Progress**: The Activity Feed updates every 2 seconds automatically
3. **Cancel if Needed**: Use the Cancel button if something goes wrong
4. **Use Style Profiles**: Create reusable style profiles to maintain consistency across videos
5. **Dev Mode Processing**: For faster iteration, use the manual processing button instead of Inngest

## Architecture

```
User triggers job → Job created (status: queued)
                 ↓
                 ├─ WITH Inngest: Inngest processes automatically
                 └─ WITHOUT Inngest: User clicks "Start Processing Now"
                 ↓
                 Agent Orchestrator runs 6 agents in sequence
                 ↓
                 Each agent creates execution logs
                 ↓
                 Job completes (status: completed) with resultPath
```

## Notes

- Jobs run sequentially through all 6 agents
- Each agent can retry up to 2 times on failure
- Cancellation is checked between each agent execution
- The orchestrator updates job progress after each agent completes
- Logs are created at the start and end of each agent execution
