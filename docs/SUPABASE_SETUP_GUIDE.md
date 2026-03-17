# Supabase Database Setup Guide

This guide will help you set up a new Supabase database for the ViralSnipAI application.

## Problem

If you're seeing this error:
```
Can't reach database server at `db.nqpguthkfejcaxohwcom.supabase.co:5432`
```

This means your Supabase project was deleted or doesn't exist. You need to create a new one.

## Solution: Create a New Supabase Project

### Step 1: Create Project

1. Go to [app.supabase.com](https://app.supabase.com)
2. Click **"New Project"**
3. Fill in the details:
   - **Organization**: Select your organization (or create one)
   - **Name**: `clippers-production` (or any name you prefer)
   - **Database Password**: Create a strong password and **save it securely**
   - **Region**: Choose the closest region to your users (e.g., `us-west-1`)
4. Click **Create new project**
5. Wait 2-3 minutes for the project to be created

### Step 2: Get Database Connection String

1. In your new project dashboard, navigate to:
   - **Settings** → **Database** → **Connection String**
2. Click the **"Prisma"** tab
3. Copy the connection string (it will look like):
   ```
   postgresql://postgres.[PROJECT-REF]:[PASSWORD]@aws-0-us-west-1.pooler.supabase.com:6543/postgres
   ```
4. Replace `[PASSWORD]` with your actual database password

**Alternative: Direct Connection (Recommended for NextAuth)**
1. Click the **"URI"** or **"Direct connection"** tab
2. Copy that connection string instead:
   ```
   postgresql://postgres:[PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres
   ```

### Step 3: Get API Keys

1. In your project dashboard, go to:
   - **Settings** → **API**
2. Copy the following values:
   - **Project URL**: `https://[PROJECT-REF].supabase.co`
   - **anon public key**: Starts with `eyJhbGciOiJI...` (JWT format)
   - **service_role secret key**: Also starts with `eyJhbGciOiJI...` (different JWT)

### Step 4: Update Environment Files

Use `apps/web/.env.local` for runtime/app secrets. Keep `apps/web/.env` minimal with `DATABASE_URL` only for Prisma CLI commands.

```bash
# Database connection
DATABASE_URL="postgresql://postgres:[YOUR-PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres"

# Supabase API configuration
NEXT_PUBLIC_SUPABASE_URL="https://[PROJECT-REF].supabase.co"
NEXT_PUBLIC_SUPABASE_ANON_KEY="[YOUR-ANON-KEY]"
SUPABASE_SECRET_KEY="[YOUR-SERVICE-ROLE-KEY]"
```

### Step 5: Initialize Database Schema

```bash
cd apps/web

# Push schema to database
npx prisma db push

# Generate Prisma client
npx prisma generate
```

### Step 6: Restart Development Server

```bash
# Stop the current server (Ctrl+C)
cd ../..

# Restart
npm run dev
```

### Step 7: Verify Everything Works

1. Open `http://localhost:3000/signup`
2. Create a test account
3. Check the terminal - you should see successful database queries
4. No more "Can't reach database server" errors!

## Troubleshooting

### Connection still failing?

1. **Verify DNS resolution**:
   ```bash
   nslookup db.[YOUR-PROJECT-REF].supabase.co
   ```
   Should return an IP address.

2. **Check credentials**:
   - Make sure password doesn't have special characters that need URL encoding
   - Verify you copied the complete connection string

3. **Check project status**:
   - Go to Supabase dashboard
   - Make sure project shows as "Active" (not paused)

4. **Network issues**:
   - Try accessing Supabase dashboard from your browser
   - Check if you can connect to port 5432:
     ```bash
     nc -zv db.[YOUR-PROJECT-REF].supabase.co 5432
     ```

### Free tier limitations

- Supabase free tier projects pause after **7 days of inactivity**
- You can resume them from the dashboard
- Consider upgrading to Pro if you need 24/7 availability

## Database Schema

The application uses Prisma ORM with the following main models:
- User (authentication)
- Project (user projects)
- Clip (video clips)
- Export (rendered exports)
- ContentIdea (YouTube creator features)
- GeneratedScript, GeneratedTitle, Thumbnail (content generation)

All schemas are defined in `apps/web/prisma/schema.prisma`.

## Next Steps

After setup:
1. Test user authentication (signup/login)
2. Create a test project
3. Upload a video and test clip generation
4. Verify all features work with the new database

## Security Best Practices

- Never commit `.env` or `.env.local` files (they're in `.gitignore`)
- Rotate API keys regularly
- Use Row Level Security (RLS) policies in production
- Keep service_role key server-side only
- Use anon key for client-side operations only

## Support

If you encounter issues:
- Check Supabase Dashboard → Logs for database errors
- Review Next.js dev server console for connection errors
- Verify environment variables are loaded correctly
- Consult Supabase docs: https://supabase.com/docs
