# Email Notification Setup Guide

## Overview
This system includes email notifications for IT support tickets. Users receive emails when:
- They create a new ticket (confirmation)
- Their ticket status is updated
- High/urgent priority tickets are sent to the IT team

## Setup Instructions

### 1. Environment Variables
Copy the `.env.example` file to `.env.local` and configure the email settings:

```bash
cp .env.example .env.local
```

### 2. Gmail Configuration
If using Gmail, you need to:

1. **Enable 2-Factor Authentication** on your Google account
2. **Generate an App Password**:
   - Go to Google Account settings
   - Security → 2-Step Verification → App passwords
   - Generate a password for "Mail"
   - Use this password in `SMTP_PASS`

3. **Configure .env.local**:
```env
SMTP_HOST="smtp.gmail.com"
SMTP_PORT="587"
SMTP_SECURE="false"
SMTP_USER="your-gmail@gmail.com"
SMTP_PASS="your-16-character-app-password"
IT_TEAM_EMAIL="it-support@yourcompany.com"
```

### 3. Other Email Providers

#### Outlook/Hotmail
```env
SMTP_HOST="smtp-mail.outlook.com"
SMTP_PORT="587"
SMTP_SECURE="false"
SMTP_USER="your-email@outlook.com"
SMTP_PASS="your-password"
```

#### Custom SMTP Server
```env
SMTP_HOST="mail.yourserver.com"
SMTP_PORT="465"
SMTP_SECURE="true"
SMTP_USER="your-email@yourserver.com"
SMTP_PASS="your-password"
```

### 4. Testing Email Setup

1. **Check SMTP Connection**:
   Create a test ticket through the application and check the console logs for any email errors.

2. **Verify Email Templates**:
   The system includes responsive HTML email templates in Thai with:
   - Company branding
   - Ticket details
   - Status updates
   - Direct links to the system

### 5. Email Features

#### New Ticket Notifications
- **Recipient**: User who created the ticket
- **Content**: 
  - Ticket confirmation
  - Ticket ID and details
  - Link to view in system

#### Status Update Notifications
- **Recipient**: User who created the ticket
- **Content**:
  - Status change (old → new)
  - Current ticket details
  - Link to view in system

#### IT Team Notifications
- **Recipient**: IT team email (if configured)
- **Trigger**: High or Urgent priority tickets
- **Content**: Same as new ticket notification

### 6. Troubleshooting

#### Common Issues

1. **Gmail "Less secure app" error**:
   - Use App Password instead of regular password
   - Ensure 2FA is enabled

2. **Connection timeout**:
   - Check SMTP_HOST and SMTP_PORT
   - Verify network/firewall settings

3. **Authentication failed**:
   - Verify SMTP_USER and SMTP_PASS
   - Check if the email account is locked

4. **Emails not received**:
   - Check spam/junk folders
   - Verify recipient email addresses
   - Check console logs for errors

#### Debug Mode
Add this to your `.env.local` to see detailed email logs:
```env
NODE_ENV="development"
```

### 7. Production Considerations

1. **Security**:
   - Use environment variables for credentials
   - Consider using OAuth2 for Gmail
   - Regularly rotate SMTP passwords

2. **Rate Limiting**:
   - Gmail: 500 emails/day for free accounts
   - Consider using dedicated email services for high volume

3. **Monitoring**:
   - Monitor email delivery rates
   - Set up alerts for failed email notifications
   - Log email activities for audit

### 8. Optional: Disable Email Notifications

If you don't want to set up email notifications immediately, the system will:
- Continue to work normally
- Log warnings about missing SMTP configuration
- Not send any emails

To completely disable email attempts, you can comment out the email service calls in:
- `app/api/tickets/route.ts` (line ~155-170)
- `app/api/tickets/[id]/route.ts` (line ~200-230)

## Support

For technical support with email setup, please check:
1. Console logs for specific error messages
2. SMTP provider documentation
3. Network/firewall configuration