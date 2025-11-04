# Deployment Notes

## Nginx Configuration Update Required

**Date**: 2025-11-04

### Issue
The nginx configuration needs to be updated to allow large file uploads (audiobook chapters can be 50-100MB+).

### Solution
The `scripts/taptunes-nginx.conf` file has been updated with:
```nginx
client_max_body_size 500M;
```

### Deployment Steps

#### On your Raspberry Pi:

1. **Backup current config**:
   ```bash
   sudo cp /etc/nginx/sites-available/taptunes /etc/nginx/sites-available/taptunes.backup
   ```

2. **Copy new config** (from your development machine):
   ```bash
   # From dev machine
   scp scripts/taptunes-nginx.conf pi@taptunes.local:/tmp/

   # On RPi
   sudo cp /tmp/taptunes-nginx.conf /etc/nginx/sites-available/taptunes
   ```

3. **Test nginx config**:
   ```bash
   sudo nginx -t
   ```

4. **Reload nginx**:
   ```bash
   sudo systemctl reload nginx
   ```

5. **Verify** by uploading an audiobook with large chapter files (should now work without 413 errors).

### Alternative: Manual Update
If you prefer to manually edit the config:

```bash
sudo nano /etc/nginx/sites-available/taptunes
```

Add this line after the `server_name` line:
```nginx
client_max_body_size 500M;
```

Save, test (`sudo nginx -t`), and reload (`sudo systemctl reload nginx`).

---

## Backend Configuration
✅ The Express backend is already configured for 500MB uploads:
- JSON body parser limit: 500MB
- Multer file upload limit: 500MB

No backend changes are required.
