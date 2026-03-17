# X Radar - Viral Tweet Detection Algorithm

## Overview

The X Radar viral detection system uses a **sophisticated engagement-rate-based algorithm** instead of simple like thresholds. This ensures accurate detection across accounts of all sizes.

---

## Algorithm Logic

### 1. **Weighted Engagement Score**

Not all engagement is equal. The algorithm assigns different weights to each interaction type:

```
Weighted Engagement = Likes + (Retweets × 2) + (Replies × 3)
```

**Why weighted?**
- **Likes**: Easiest action, lowest value (1x weight)
- **Retweets**: Shows endorsement + amplification (2x weight)
- **Replies**: Highest engagement, starts conversations (3x weight)

### 2. **Engagement Rate Calculation**

```
Engagement Rate = Weighted Engagement / Follower Count
```

This normalizes performance across different account sizes. A tweet with 1,000 likes means different things for:
- **10K follower account**: 10% engagement rate → VERY VIRAL
- **1M follower account**: 0.1% engagement rate → Normal

### 3. **Dynamic Viral Thresholds**

The algorithm uses different thresholds based on account size:

| Account Size | Follower Range | Viral Threshold | Reason |
|--------------|----------------|-----------------|--------|
| **Mega** | 1M+ | 1% | Massive reach, even 1% is significant |
| **Large** | 100K - 1M | 2% | Strong reach, 2% means viral spread |
| **Medium** | 10K - 100K | 5% | Growing audience, 5% shows strong resonance |
| **Small-Medium** | 1K - 10K | 10% | Niche audience, 10% is impressive |
| **Very Small** | <1K | 20% | Tiny audience, needs high % to be truly viral |

### 4. **Absolute Engagement Floor**

To avoid false positives (e.g., 2 likes on a 5-follower account = 40% rate), we enforce minimums:

```typescript
const minAbsoluteEngagement = followerCount > 10_000 ? 500 : 100;
```

- **Large accounts (>10K followers)**: Minimum 500 weighted engagement
- **Small accounts (≤10K followers)**: Minimum 100 weighted engagement

### 5. **Viral Score (0-100)**

Each viral tweet gets a score for ranking:

```
Score = min(100, (Engagement Rate / Viral Threshold) × 50)
```

- **Score 50**: Just barely meets the viral threshold
- **Score 75**: 1.5x the viral threshold (good performance)
- **Score 100**: 2x+ the viral threshold (exceptional performance)

---

## Implementation

### Code Location
`apps/web/app/api/x-radar/viral/route.ts` → `calculateViralMetrics()`

### Flow
1. **Fetch tweets**: Get last 20 tweets from each tracked account via X API
2. **Calculate metrics**: For each tweet, compute weighted engagement, rate, and score
3. **Filter viral**: Keep only tweets that meet BOTH:
   - Engagement rate ≥ dynamic threshold
   - Absolute engagement ≥ minimum floor
4. **Store with score**: Save viral tweets to DB with calculated viral score

---

## Example Scenarios

### Scenario 1: Mega Account (@elonmusk - 150M followers)
- Tweet gets **2M likes, 500K retweets, 100K replies**
- Weighted engagement: 2M + (500K × 2) + (100K × 3) = **3.3M**
- Engagement rate: 3.3M / 150M = **2.2%**
- Viral threshold: **1%** (mega account)
- **Result**: ✅ VIRAL (2.2% > 1%, and 3.3M > 500 minimum)
- **Viral score**: 100 (maxed out)

### Scenario 2: Medium Account (@yourhandle - 50K followers)
- Tweet gets **5K likes, 800 retweets, 200 replies**
- Weighted engagement: 5K + (800 × 2) + (200 × 3) = **7.2K**
- Engagement rate: 7.2K / 50K = **14.4%**
- Viral threshold: **5%** (medium account)
- **Result**: ✅ VIRAL (14.4% > 5%, and 7.2K > 500 minimum)
- **Viral score**: 100 (2.88x threshold)

### Scenario 3: Small Account (@newbie - 2K followers)
- Tweet gets **400 likes, 50 retweets, 20 replies**
- Weighted engagement: 400 + (50 × 2) + (20 × 3) = **560**
- Engagement rate: 560 / 2K = **28%**
- Viral threshold: **10%** (small-medium account)
- **Result**: ✅ VIRAL (28% > 10%, and 560 > 100 minimum)
- **Viral score**: 100 (2.8x threshold)

### Scenario 4: False Positive (tiny account)
- Account has **50 followers**
- Tweet gets **15 likes, 2 retweets, 1 reply**
- Weighted engagement: 15 + (2 × 2) + (1 × 3) = **22**
- Engagement rate: 22 / 50 = **44%**
- Viral threshold: **20%** (very small account)
- **Result**: ❌ NOT VIRAL (44% > 20%, but 22 < 100 minimum)
- **Reason**: Blocked by absolute engagement floor

### Scenario 5: Popular but not viral (large account)
- Account has **500K followers**
- Tweet gets **3K likes, 200 retweets, 50 replies**
- Weighted engagement: 3K + (200 × 2) + (50 × 3) = **3.55K**
- Engagement rate: 3.55K / 500K = **0.71%**
- Viral threshold: **2%** (large account)
- **Result**: ❌ NOT VIRAL (0.71% < 2%)
- **Reason**: Good engagement, but below viral threshold for account size

---

## Benefits Over Simple Like Threshold

### Old Logic (Simple)
```typescript
const minLikes = followerCount > 10000 ? 500 : 100;
const isViral = likes >= minLikes;
```

**Problems:**
- Treats 500 likes the same for 20K and 2M follower accounts
- Ignores retweets and replies (more valuable engagement)
- No context about the account's typical performance
- Many false positives and false negatives

### New Logic (Sophisticated)
```typescript
const metrics = calculateViralMetrics({
  likes, retweets, replies, followerCount
});
const isViral = metrics.isViral; // Based on rate + absolute threshold
```

**Advantages:**
- ✅ Contextual to account size
- ✅ Weights valuable engagement types higher
- ✅ Prevents false positives with absolute floor
- ✅ Provides ranking via viral score
- ✅ More accurate across all account sizes

---

## Tuning the Algorithm

To adjust sensitivity, modify these values in `calculateViralMetrics()`:

### Make MORE sensitive (catch more tweets):
```typescript
viralThreshold = 0.03; // Lower from 0.05 for medium accounts
minAbsoluteEngagement = 50; // Lower from 100
```

### Make LESS sensitive (catch only top tweets):
```typescript
viralThreshold = 0.08; // Higher from 0.05 for medium accounts
minAbsoluteEngagement = 1000; // Higher from 100/500
```

### Adjust engagement weights:
```typescript
// Give even more weight to replies (current: 3x)
const weightedEngagement = likes + retweets * 2 + replies * 4;

// Ignore replies, focus on reshares
const weightedEngagement = likes + retweets * 3;
```

---

## Performance Impact

- **Computation**: Minimal (simple math per tweet)
- **API calls**: No change (still fetches 20 tweets per account)
- **Database**: Stores viral score for better sorting
- **Accuracy**: Significantly improved across all account sizes

---

## Future Enhancements

1. **Velocity tracking**: Detect tweets gaining engagement rapidly (likes/hour)
2. **Historical comparison**: Compare to account's last 30-day average
3. **Time decay**: Older viral tweets could have score reduced
4. **External signals**: Factor in bookmarks, quote tweets with positive sentiment
5. **ML model**: Train on user's niche to learn what "viral" means in their space
