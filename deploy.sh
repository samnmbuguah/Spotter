#!/bin/bash

# Deploy script for Django + React app to Namecheap cPanel hosting
# Following best practices from Namecheap cPanel Django deployment guides

set -e  # Exit on any error

# Configuration
SERVER="198.54.114.246"
SSH_PORT="21098"
SSH_USER="elteijae"
REMOTE_PATH="exponentialpotential.space"
LOCAL_BACKEND_PATH="backend"
LOCAL_FRONTEND_BUILD_PATH="frontend/build"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}🚀 Starting Django + React deployment to Namecheap cPanel...${NC}"

# Check if backend directory exists
if [ ! -d "$LOCAL_BACKEND_PATH" ]; then
    echo -e "${RED}❌ Backend directory '$LOCAL_BACKEND_PATH' not found!${NC}"
    exit 1
fi

# Always rebuild frontend for latest changes
echo -e "${YELLOW}🔨 Building frontend for latest changes...${NC}"
cd "frontend" && npm run build
if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Frontend build failed!${NC}"
    exit 1
fi
echo -e "${GREEN}✅ Frontend build completed successfully!${NC}"

# Go back to parent directory for deployment
cd ..

# Verify frontend build exists
if [ ! -d "$LOCAL_FRONTEND_BUILD_PATH" ]; then
    echo -e "${RED}❌ Frontend build directory '$LOCAL_FRONTEND_BUILD_PATH' not found after build!${NC}"
    exit 1
fi

echo -e "${YELLOW}📦 Preparing files for deployment...${NC}"

# Create temporary directory for deployment
TEMP_DIR=$(mktemp -d)
BACKEND_TEMP="$TEMP_DIR/backend"
FRONTEND_TEMP="$TEMP_DIR/frontend-build"

# Copy backend files (excluding unnecessary files)
echo -e "${YELLOW}📋 Copying backend files...${NC}"
rsync -a --exclude='venv' \
        --exclude='__pycache__' \
        --exclude='*.pyc' \
        --exclude='.git' \
        --exclude='node_modules' \
        --exclude='*.log' \
        --exclude='.env' \
        --exclude='Dockerfile*' \
        --exclude='docker-compose*' \
        --exclude='*.sqlite3' \
        "$LOCAL_BACKEND_PATH/" "$BACKEND_TEMP/"

# Copy frontend build files
echo -e "${YELLOW}📋 Copying frontend build files...${NC}"
rsync -a "$LOCAL_FRONTEND_BUILD_PATH/" "$FRONTEND_TEMP/"

# Upload backend files using rsync (only changed files)
echo -e "${GREEN}⬆️  Uploading backend files to server...${NC}"
ssh -p $SSH_PORT $SSH_USER@$SERVER "mkdir -p $REMOTE_PATH"
rsync -avz --delete \
      -e "ssh -p $SSH_PORT" \
      --exclude='__pycache__' \
      --exclude='*.pyc' \
      --exclude='*.log' \
      "$BACKEND_TEMP/" "$SSH_USER@$SERVER:~/$REMOTE_PATH/"

# Upload frontend build files
echo -e "${GREEN}⬆️  Uploading frontend build files to server...${NC}"
rsync -avz --delete \
      -e "ssh -p $SSH_PORT" \
      "$FRONTEND_TEMP/" "$SSH_USER@$SERVER:~/$REMOTE_PATH/frontend/"

# Clean up temporary directory
rm -rf "$TEMP_DIR"

echo -e "${GREEN}✅ Files uploaded successfully!${NC}"
echo -e "${YELLOW}🔧 Configuring Django for Namecheap cPanel...${NC}"

# Configure Django settings for Namecheap cPanel
ssh -p $SSH_PORT $SSH_USER@$SERVER "cd $REMOTE_PATH && cat > configure_django.py << 'DJANGO_EOF'
import os
import sys

# Add project directory to Python path
project_home = '/home/elteijae/$REMOTE_PATH'
if project_home not in sys.path:
    sys.path.insert(0, project_home)

# Set Django settings module
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'spotter.settings')

# Read current settings
with open('spotter/settings.py', 'r') as f:
    content = f.read()

# Fix settings for Namecheap cPanel
content = content.replace(
    \"DEBUG = False\",
    \"DEBUG = False\"
)

content = content.replace(
    \"ALLOWED_HOSTS = ['exponentialpotential.space', 'www.exponentialpotential.space', '198.54.114.246']\",
    \"ALLOWED_HOSTS = ['exponentialpotential.space', 'www.exponentialpotential.space', '198.54.114.246']\"
)

# Fix static files configuration for Namecheap cPanel
import re
static_config = '''
# Static files (CSS, JavaScript, Images)
STATIC_URL = '/staticfiles/'
STATICFILES_DIRS = [os.path.join(BASE_DIR, 'staticfiles')]
STATIC_ROOT = os.path.join(BASE_DIR, 'staticfiles')
'''

content = re.sub(
    r'STATIC_URL = .*?STATICFILES_DIRS = .*?STATIC_ROOT = .*?\]',
    static_config.strip(),
    content,
    flags=re.DOTALL
)

# Write back the updated settings
with open('spotter/settings.py', 'w') as f:
    f.write(content)

print(\"✅ Django settings configured for Namecheap cPanel\")
DJANGO_EOF\"

# Configure Django settings for Namecheap cPanel
ssh -p $SSH_PORT $SSH_USER@$SERVER "cd $REMOTE_PATH && source /virtualenv/$REMOTE_PATH/bin/activate && pip install -r requirements.txt && python manage.py collectstatic --noinput && cp -r staticfiles/* ../public_html/ 2>/dev/null && echo '✅ Static files moved to public_html'"

echo -e "${GREEN}✅ Django configuration completed!${NC}"
echo -e "${YELLOW}🔍 Final verification...${NC}"

# Verify files on server
ssh -p $SSH_PORT $SSH_USER@$SERVER "cd $REMOTE_PATH && echo 'Django project files:' && ls -la | grep -E '(manage.py|requirements.txt|passenger_wsgi.py)' && echo 'Static files in public_html:' && ls -la ../public_html/ | grep static"

echo -e "${GREEN}🎉 Deployment completed successfully!${NC}"
echo -e "${YELLOW}📝 Your application should now be available at:${NC}"
echo -e "${GREEN}🌐 https://exponentialpotential.space${NC}"
echo -e "${YELLOW}📋 Next steps:${NC}"
echo -e "1. Access cPanel: https://$SERVER:2083"
echo -e "2. Go to Software → Setup Python App"
echo -e "3. Create/update Python application with:"
echo -e "   - Application Root: exponentialpotential.space"
echo -e "   - Startup File: passenger_wsgi.py"
echo -e "4. The app should now serve your React frontend!"
