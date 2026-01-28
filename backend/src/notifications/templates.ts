// Email templates for notifications

const BASE_URL = process.env.FRONTEND_URL || 'https://basewill.xyz';

interface EmailTemplate {
  subject: string;
  html: string;
}

export function getEmailTemplate(
  type: string,
  willId?: string,
  data?: Record<string, any>
): EmailTemplate {
  const templates: Record<string, () => EmailTemplate> = {
    CHECK_IN_REMINDER_30D: () => ({
      subject: '🔔 BaseWill: Check-in Reminder - 30 Days Left',
      html: checkInReminderTemplate(30, willId),
    }),
    CHECK_IN_REMINDER_7D: () => ({
      subject: '⚠️ BaseWill: Check-in Reminder - 7 Days Left',
      html: checkInReminderTemplate(7, willId),
    }),
    CHECK_IN_REMINDER_24H: () => ({
      subject: '🚨 URGENT: Check-in Required Within 24 Hours',
      html: urgentCheckInTemplate(willId),
    }),
    WILL_TRIGGERED: () => ({
      subject: '⚠️ BaseWill: Your Will Has Been Triggered',
      html: willTriggeredTemplate(willId),
    }),
    GRACE_PERIOD_ENDING: () => ({
      subject: '🚨 BaseWill: Grace Period Ending Soon',
      html: gracePeriodEndingTemplate(willId),
    }),
    WILL_EXECUTED: () => ({
      subject: '✅ BaseWill: Will Executed Successfully',
      html: willExecutedTemplate(willId),
    }),
    ASSET_DISTRIBUTED: () => ({
      subject: '💰 BaseWill: You Have Received Assets',
      html: assetDistributedTemplate(willId, data),
    }),
    BENEFICIARY_DESIGNATED: () => ({
      subject: '📋 BaseWill: You\'ve Been Named as a Beneficiary',
      html: beneficiaryDesignatedTemplate(willId),
    }),
    NOTARY_VERIFICATION_REQUESTED: () => ({
      subject: '📝 BaseWill: Verification Request',
      html: notaryVerificationRequestTemplate(willId),
    }),
  };

  const template = templates[type];
  if (template) {
    return template();
  }

  // Default template
  return {
    subject: 'BaseWill Notification',
    html: defaultTemplate(),
  };
}

function baseTemplate(content: string): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>BaseWill</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      line-height: 1.6;
      color: #1a1a1a;
      margin: 0;
      padding: 0;
      background-color: #f5f5f5;
    }
    .container {
      max-width: 600px;
      margin: 0 auto;
      padding: 20px;
    }
    .card {
      background: white;
      border-radius: 12px;
      padding: 32px;
      margin: 20px 0;
      box-shadow: 0 2px 8px rgba(0,0,0,0.08);
    }
    .header {
      text-align: center;
      padding: 20px 0;
    }
    .logo {
      font-size: 28px;
      font-weight: bold;
      color: #1e3a5f;
    }
    .logo span {
      color: #c9a227;
    }
    h1 {
      color: #1e3a5f;
      font-size: 24px;
      margin: 0 0 16px;
    }
    p {
      color: #4a5568;
      margin: 0 0 16px;
    }
    .button {
      display: inline-block;
      background: #1e3a5f;
      color: white;
      padding: 14px 28px;
      border-radius: 8px;
      text-decoration: none;
      font-weight: 600;
      margin: 16px 0;
    }
    .button:hover {
      background: #2d4a6f;
    }
    .button-urgent {
      background: #dc2626;
    }
    .button-urgent:hover {
      background: #b91c1c;
    }
    .alert {
      padding: 16px;
      border-radius: 8px;
      margin: 16px 0;
    }
    .alert-warning {
      background: #fef3c7;
      border: 1px solid #f59e0b;
      color: #92400e;
    }
    .alert-danger {
      background: #fee2e2;
      border: 1px solid #ef4444;
      color: #991b1b;
    }
    .alert-success {
      background: #d1fae5;
      border: 1px solid #10b981;
      color: #065f46;
    }
    .footer {
      text-align: center;
      padding: 20px;
      color: #718096;
      font-size: 12px;
    }
    .footer a {
      color: #1e3a5f;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="logo">Base<span>Will</span></div>
    </div>
    <div class="card">
      ${content}
    </div>
    <div class="footer">
      <p>
        This email was sent by BaseWill, a decentralized inheritance platform on Base.<br>
        <a href="${BASE_URL}">Visit BaseWill</a> | <a href="${BASE_URL}/settings">Manage Notifications</a>
      </p>
      <p>© ${new Date().getFullYear()} BaseWill. All rights reserved.</p>
    </div>
  </div>
</body>
</html>
`;
}

function checkInReminderTemplate(days: number, willId?: string): string {
  return baseTemplate(`
    <h1>Check-in Reminder</h1>
    <div class="alert alert-warning">
      <strong>Your will's inactivity threshold is approaching.</strong><br>
      ${days} days remaining until your will may be triggered.
    </div>
    <p>
      To ensure your assets remain secure and your will stays inactive, please check in
      to confirm you're still active.
    </p>
    <p>
      A simple check-in resets your activity timer and prevents any automated actions.
    </p>
    <p style="text-align: center;">
      <a href="${BASE_URL}/will/${willId || ''}" class="button">Check In Now</a>
    </p>
    <p style="font-size: 14px; color: #718096;">
      If you're unable to check in, your will will enter a grace period after the threshold,
      giving you additional time to respond.
    </p>
  `);
}

function urgentCheckInTemplate(willId?: string): string {
  return baseTemplate(`
    <h1>🚨 Urgent Action Required</h1>
    <div class="alert alert-danger">
      <strong>Your will will be triggered in 24 hours!</strong><br>
      Check in immediately to prevent this.
    </div>
    <p>
      Your inactivity threshold is about to be reached. If you don't check in within
      the next 24 hours, your will will be triggered and enter the grace period.
    </p>
    <p style="text-align: center;">
      <a href="${BASE_URL}/will/${willId || ''}" class="button button-urgent">Check In Now</a>
    </p>
    <p style="font-size: 14px; color: #718096;">
      If this is intentional or you need assistance, please contact support.
    </p>
  `);
}

function willTriggeredTemplate(willId?: string): string {
  return baseTemplate(`
    <h1>Your Will Has Been Triggered</h1>
    <div class="alert alert-warning">
      <strong>Your will has entered the grace period.</strong><br>
      You can still cancel the trigger if this was unintentional.
    </div>
    <p>
      Due to inactivity, your will has been triggered. You now have a grace period
      to check in and cancel the trigger.
    </p>
    <p>
      If you don't take action during the grace period, your will will be executed
      and your assets will be distributed to your beneficiaries.
    </p>
    <p style="text-align: center;">
      <a href="${BASE_URL}/will/${willId || ''}" class="button button-urgent">Cancel Trigger</a>
    </p>
    <p style="font-size: 14px; color: #718096;">
      If this is intentional or expected, no action is needed.
    </p>
  `);
}

function gracePeriodEndingTemplate(willId?: string): string {
  return baseTemplate(`
    <h1>🚨 Grace Period Ending Soon</h1>
    <div class="alert alert-danger">
      <strong>Your grace period is about to end!</strong><br>
      This is your final chance to cancel the will trigger.
    </div>
    <p>
      Once the grace period ends, your will will be executed and cannot be stopped.
      Your assets will be distributed to your designated beneficiaries.
    </p>
    <p style="text-align: center;">
      <a href="${BASE_URL}/will/${willId || ''}" class="button button-urgent">Cancel Now</a>
    </p>
  `);
}

function willExecutedTemplate(willId?: string): string {
  return baseTemplate(`
    <h1>Will Successfully Executed</h1>
    <div class="alert alert-success">
      <strong>Assets have been distributed.</strong><br>
      The will has been executed as planned.
    </div>
    <p>
      A will you're associated with has been executed, and assets have been
      distributed to the designated beneficiaries.
    </p>
    <p style="text-align: center;">
      <a href="${BASE_URL}/will/${willId || ''}" class="button">View Details</a>
    </p>
  `);
}

function assetDistributedTemplate(willId?: string, data?: Record<string, any>): string {
  return baseTemplate(`
    <h1>You've Received Assets</h1>
    <div class="alert alert-success">
      <strong>Assets have been distributed to you.</strong>
    </div>
    <p>
      You have received assets from an executed will. The assets are now available
      in your wallet or may be subject to a vesting schedule.
    </p>
    ${data?.amount ? `<p><strong>Amount received:</strong> ${data.amount}</p>` : ''}
    <p style="text-align: center;">
      <a href="${BASE_URL}/beneficiary" class="button">View Your Assets</a>
    </p>
  `);
}

function beneficiaryDesignatedTemplate(willId?: string): string {
  return baseTemplate(`
    <h1>You've Been Named as a Beneficiary</h1>
    <p>
      Good news! Someone has designated you as a beneficiary in their BaseWill.
      This means you may receive assets in the future.
    </p>
    <p>
      You can view the details of your designation in the beneficiary dashboard.
    </p>
    <p style="text-align: center;">
      <a href="${BASE_URL}/beneficiary" class="button">View Dashboard</a>
    </p>
    <p style="font-size: 14px; color: #718096;">
      Note: You will only receive assets if and when the will is executed.
    </p>
  `);
}

function notaryVerificationRequestTemplate(willId?: string): string {
  return baseTemplate(`
    <h1>Verification Request</h1>
    <p>
      You have been assigned to verify a will on BaseWill. Please review the
      documentation and submit your verification.
    </p>
    <p>
      As a notary, your verification helps ensure the integrity of the inheritance
      process and protects all parties involved.
    </p>
    <p style="text-align: center;">
      <a href="${BASE_URL}/notary" class="button">Review Request</a>
    </p>
    <p style="font-size: 14px; color: #718096;">
      Remember: False verifications may result in stake slashing.
    </p>
  `);
}

function defaultTemplate(): string {
  return baseTemplate(`
    <h1>Notification from BaseWill</h1>
    <p>
      You have a new notification from BaseWill. Please log in to view the details.
    </p>
    <p style="text-align: center;">
      <a href="${BASE_URL}" class="button">Go to BaseWill</a>
    </p>
  `);
}
