# Linear Webhook Setup — MC Notifications

When a task is approved in Mission Control (moved to "In Progress" or "Todo" in Linear), Chuck gets notified via Discord.

## Setup

1. Go to **Linear Settings → API → Webhooks**
2. Create a new webhook:
   - **URL:** `https://api.ccxmc.ca/webhooks/linear`
   - **Events:** "Issues" only (state changes)
   - **Label:** "MC Notifications"
3. Copy the signing secret Linear generates
4. Add to Mac Mini environment:
   ```bash
   echo "export LINEAR_WEBHOOK_SECRET=paste-secret" >> ~/.zshrc
   source ~/.zshrc
   pm2 restart mc-api
   ```

## Testing

Change any COR task state in Linear and check Discord #general for the notification.

Manual test via the authenticated test endpoint:

```bash
curl -X POST http://localhost:3100/webhooks/linear/test \
  -H "Authorization: Bearer $MC_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"identifier":"COR-111","title":"Test notification","stateName":"In Progress"}'
```
