# Deployment Instructions for ELD Truck Driver Application

## Frontend Deployment (Vercel)

1. **Deploy Frontend to Vercel:**
   \`\`\`bash
   npx vercel --prod
   \`\`\`

2. **Environment Variables for Vercel:**
   Set these in your Vercel dashboard or using CLI:
   \`\`\`bash
   npx vercel env add REACT_APP_API_URL
   npx vercel env add REACT_APP_GOOGLE_MAPS_API_KEY
   \`\`\`

## Backend Deployment (Railway/Railway)

1. **Deploy Backend to Railway:**
   - Connect your GitHub repository to Railway
   - Add PostgreSQL database
   - Set environment variables in Railway dashboard

2. **Railway Environment Variables:**
   - \`DJANGO_SETTINGS_MODULE=config.settings.production\`
   - \`DATABASE_URL\` (provided by Railway PostgreSQL)
   - \`SECRET_KEY\` (generate a secure key)
   - \`GOOGLE_MAPS_API_KEY\`
   - \`ALLOWED_HOSTS\` (your Railway app URL)

## Alternative: Full-Stack Deployment

If you prefer a single hosting solution, consider:
- **Render**: Supports both Django and React in same service
- **Heroku**: Traditional full-stack deployment
- **DigitalOcean App Platform**: Full-stack deployment

## Post-Deployment Steps

1. **Update API URLs:**
   - Update \`REACT_APP_API_URL\` in Vercel to point to your backend
   - Ensure CORS is configured in Django settings

2. **Database Setup:**
   - Run Django migrations on backend
   - Create superuser for admin access

3. **Domain Configuration:**
   - Add custom domain if needed
   - Configure SSL certificates

## API Endpoints Available

- \`/api/v1/auth/\` - Authentication
- \`/api/v1/trips/\` - Trip management
- \`/api/v1/logs/\` - HOS log management
- \`/api/v1/logs/download-pdf/<date>/\` - PDF generation

## Testing the Deployment

1. Visit your Vercel URL
2. Test trip planning functionality
3. Verify HOS log generation
4. Check PDF download feature

For detailed setup instructions, see DEPLOYMENT.md
