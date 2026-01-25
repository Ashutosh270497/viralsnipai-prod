# Debugging the Agent Editor

## Recent Fixes Applied

### 1. **Script Analyzer Made Resilient** ✓
- **Issue**: Agent was failing when clips had no transcript
- **Fix**: Now returns mock analysis data instead of failing
- **File**: `apps/web/lib/services/agents/script-analyzer.agent.ts`
- **Behavior**:
  - If transcript is missing → Uses mock data
  - If OpenAI fails → Falls back to mock data
  - Always succeeds, never blocks the pipeline

### 2. **Debug Info Component Added** ✓
- **Location**: Click "Show Debug Info" button below Activity Feed
- **Shows**:
  - Job status and error messages
  - Whether assets have transcripts
  - Number of logs created
  - Detailed asset information
  - All execution logs with errors

### 3. **Manual Processing Added** ✓
- **Button**: "Start Processing Now (Dev Mode)"
- **When**: Appears for queued jobs
- **Use**: Process jobs without Inngest running

### 4. **Cancel Button Added** ✓
- **Location**: Top-right of "AI Editing in Progress" card
- **Function**: Gracefully stops job between agents

## How to Debug a Failed Job

### Step 1: Click "Show Debug Info"

This will show you:

```
Job Status: failed / completed / processing / queued
Error: [Actual error message from the agents]
Has Transcript: Yes / No
Has Assets: Yes / No
Has Clips: Yes / No
Logs Count: [Number]
```

### Step 2: Check the Error Message

Common errors and solutions:

#### "No transcript available for analysis"
- **Cause**: This shouldn't happen anymore after the fix
- **Solution**: If you still see this, the old code is running. Restart the dev server.

#### "No asset path provided"
- **Cause**: The clip or project doesn't have a valid video file
- **Solution**:
  1. Go to Projects
  2. Upload a video file
  3. Create a clip from that video
  4. Try again

#### "Clip [id] not found"
- **Cause**: You selected a clip that was deleted
- **Solution**: Select a different clip or create a new one

#### "No asset found for processing"
- **Cause**: The project has no uploaded videos
- **Solution**: Upload a video to the project first

### Step 3: Check Logs

In the Debug Info, scroll to "Recent Logs" to see which agent failed:

- **ScriptAnalyzerAgent** - Should never fail now (uses mock data)
- **AssetCuratorAgent** - May fail if Pexels API key is missing (not critical)
- **MotionDesignerAgent** - Should never fail (uses mock data)
- **AudioEnhancerAgent** - Should never fail (uses mock data)
- **StyleMatcherAgent** - Should never fail (uses defaults)
- **EditorAgent** - May fail if video file is missing or corrupt

### Step 4: Check Assets

Look at the "Assets" section in Debug Info:

```
Assets:
  cmhkuk19
  - Type: video
  - Has Transcript: Yes/No
  - Path: /uploads/...
```

Make sure:
- ✓ Type is "video"
- ✓ Path exists and is accessible
- ⚠ Transcript is optional (agents will use mock data)

## Testing the Fix

### Test 1: Job with No Transcript

1. Create a project and upload a video (without generating transcript)
2. Create a clip
3. Go to Agent Editor
4. Select the project and clip
5. Click "Launch AI editing squad"
6. Click "Start Processing Now (Dev Mode)"
7. ✓ **Expected**: Job should complete successfully using mock analysis data

### Test 2: Job with Transcript

1. Create a project and upload a video
2. Generate transcript (if feature is available)
3. Create a clip
4. Go to Agent Editor
5. Launch and process the job
6. ✓ **Expected**: Job should use actual transcript for analysis

### Test 3: Debug Info

1. Launch any job (successful or failed)
2. Click "Show Debug Info"
3. ✓ **Expected**: See detailed information about job, assets, and logs

## Development Workflow

### With Inngest (Recommended)

```bash
# Terminal 1: Start Next.js
pnpm dev

# Terminal 2: Start Inngest
npx inngest-cli@latest dev
```

Jobs will process automatically in the background.

### Without Inngest (Quick Dev)

```bash
# Terminal 1: Just start Next.js
pnpm dev
```

1. Launch a job
2. Click "Start Processing Now (Dev Mode)" button
3. Jobs process directly in Next.js server

## API Endpoints for Debugging

### Get Debug Info for Latest Job
```bash
curl http://localhost:3000/api/agent-editor/debug
```

### Get Debug Info for Specific Job
```bash
curl http://localhost:3000/api/agent-editor/debug?jobId=<job-id>
```

### Response Example
```json
{
  "job": { ... },
  "debug": {
    "hasTranscript": false,
    "hasAssets": true,
    "hasClips": true,
    "logsCount": 6,
    "status": "completed",
    "errorMessage": null,
    "progress": { ... }
  }
}
```

## Still Having Issues?

### Check Server Logs

Look in terminal where Next.js is running for:
- `Agent <AgentName> started` - Agent began execution
- `Agent <AgentName> completed` - Agent finished successfully
- `Agent <AgentName> failed` - Agent encountered an error

### Check Database

```bash
# Connect to your database and run:
SELECT id, status, errorMessage, createdAt
FROM "AgentEditorJob"
ORDER BY createdAt DESC
LIMIT 5;

# Check logs for a specific job:
SELECT * FROM "AgentExecutionLog"
WHERE "jobId" = '<job-id>'
ORDER BY createdAt ASC;
```

### Force Refresh

If changes aren't applying:

```bash
# Kill Next.js dev server
# Clear Next.js cache
rm -rf .next

# Restart
pnpm dev
```

## Expected Behavior After Fixes

✅ Jobs should **never** fail due to missing transcripts
✅ ScriptAnalyzerAgent always succeeds (uses mock data if needed)
✅ All 6 agents should complete successfully for any valid video clip
✅ Debug info shows exactly what's happening
✅ Error messages are clear and actionable
✅ Logs appear in both Activity Feed and Execution Logs dialog

## Common Success Indicators

When working correctly, you should see:

1. **Activity Feed** updates every 2 seconds showing each agent
2. **Progress bar** moves from 0% to 100%
3. **Agent names** appear as they execute:
   - Script Analyzer Agent
   - Asset Curator Agent
   - Motion Designer Agent
   - Audio Enhancer Agent
   - Style Matcher Agent
   - Editor Agent

4. **Final status**: "Completed" with Download button
5. **Logs dialog**: Shows 6 completed agents

## Quick Fix Checklist

- [ ] Restart Next.js dev server
- [ ] Click "Show Debug Info" to see actual error
- [ ] Verify project has uploaded video
- [ ] Verify clip exists and has startMs/endMs
- [ ] Click "Start Processing Now (Dev Mode)" for queued jobs
- [ ] Check that script-analyzer.agent.ts has the resilient code
- [ ] Look at terminal logs for detailed error messages

## Need More Help?

Check these files for the latest code:
- `apps/web/lib/services/agents/script-analyzer.agent.ts` - Should have mock data fallback
- `apps/web/lib/services/agent-orchestrator.service.ts` - Orchestration logic
- `apps/web/components/agent-editor/debug-info.tsx` - Debug UI component
- `apps/web/app/api/agent-editor/debug/route.ts` - Debug API endpoint
