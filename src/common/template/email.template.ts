// src/common/templates/email.templates.ts

export function getMeterRechargeEmail(data: {
  firstName:    string;
  amount:       number;
  units:        string;
  meterNumber:  string;
  token:        string;
  disco:        string;
  reference:    string;
  date:         string;
  paymentMethod?: string;
  meterNickname?: string;
}): string {
  const {
    firstName,
    amount,
    units,
    meterNumber,
    token,
    disco,
    reference,
    date,
    paymentMethod  = 'Wallet',
    meterNickname  = 'My Meter',
  } = data;

  // Format token with spaces: 1234 5678 9012 3456 7890
  const formattedToken = token
    .replace(/\s/g, '')
    .replace(/(\d{4})/g, '$1 ')
    .trim();

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>Meter Recharged — Pay4light.ng</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{background:#f4f5f0;font-family:Arial,Helvetica,sans-serif;padding:24px 16px}
.email-card{background:#fff;border-radius:14px;overflow:hidden;border:1px solid #e2e8e0;max-width:560px;margin:0 auto}
.logo-bar{text-align:center;margin-bottom:18px}
.logo-pill{display:inline-block;background:#0f6e56;border-radius:10px;padding:8px 18px;font-size:17px;font-weight:700;color:#fff;letter-spacing:-.3px}
.logo-pill span{color:#9FE1CB}
.top-bar{background:#0f6e56;padding:28px 32px;text-align:center}
.icon{width:50px;height:50px;border-radius:50%;background:#fff;margin:0 auto 14px;display:flex;align-items:center;justify-content:center;font-size:22px}
.label{color:#9FE1CB;font-size:11px;font-weight:700;letter-spacing:1px;text-transform:uppercase;margin-bottom:6px}
.amount{color:#fff;font-size:32px;font-weight:700;letter-spacing:-1px;margin-bottom:6px}
.sub{color:#9FE1CB;font-size:13px}
.token-box{background:#f4f9f6;padding:20px 32px;border-bottom:1px solid #dceee5;text-align:center}
.token-label{font-size:11px;font-weight:700;color:#0f6e56;letter-spacing:.8px;text-transform:uppercase;margin-bottom:8px}
.token-val{font-size:24px;font-weight:700;color:#0a4a38;letter-spacing:5px;font-family:'Courier New',monospace;margin-bottom:6px}
.token-hint{font-size:11.5px;color:#6b7c74}
.body{padding:28px 32px}
.greeting{font-size:14px;color:#3d4a42;line-height:1.6;margin-bottom:20px}
.section-title{font-size:11px;font-weight:700;color:#0f6e56;letter-spacing:.8px;text-transform:uppercase;margin-bottom:10px}
.detail-box{background:#f4f9f6;border-radius:10px;border:1px solid #c0ddd0;margin-bottom:20px;overflow:hidden}
.detail-row{display:flex;justify-content:space-between;align-items:center;padding:8px 16px;border-bottom:1px solid #dceee5;font-size:12.5px}
.detail-row:last-child{border-bottom:none}
.dk{color:#6b7c74}
.dv{color:#1a2e26;font-weight:600;text-align:right}
.dv.green{color:#0f6e56}
.dv.mono{font-family:'Courier New',monospace;font-size:11.5px}
.steps-box{background:#f4f9f6;border-radius:10px;border:1px solid #c0ddd0;padding:16px 18px;margin-bottom:20px}
.step{display:flex;align-items:flex-start;gap:10px;margin-bottom:10px;font-size:13px;color:#3d4a42;line-height:1.5}
.step:last-child{margin-bottom:0}
.step-num{width:20px;height:20px;min-width:20px;border-radius:50%;background:#0f6e56;color:#fff;font-size:11px;font-weight:700;display:flex;align-items:center;justify-content:center;margin-top:1px}
.cta-row{display:flex;gap:10px;justify-content:center;margin-bottom:20px;flex-wrap:wrap}
.btn-primary{background:#0f6e56;color:#fff;font-size:13px;font-weight:600;padding:11px 24px;border-radius:8px;text-decoration:none;display:inline-block}
.btn-outline{background:#fff;color:#0f6e56;font-size:13px;font-weight:600;padding:10px 24px;border-radius:8px;text-decoration:none;display:inline-block;border:1.5px solid #0f6e56}
.warn-box{background:#fff8e6;border-radius:8px;border-left:4px solid #EF9F27;padding:12px 16px;margin-bottom:20px;font-size:12.5px;color:#7a5c10;line-height:1.5}
.closing{font-size:13.5px;color:#6b7c74;line-height:1.6}
.footer{padding:18px 32px;text-align:center;font-size:11.5px;color:#9aaba2;border-top:1px solid #f0f5f2;line-height:1.8}
.footer a{color:#0f6e56;text-decoration:none}
</style>
</head>
<body>
<div class="logo-bar">
  <div class="logo-pill">⚡ Pay4light<span>.ng</span></div>
</div>
<div class="email-card">
  <div class="top-bar">
    <div class="icon">⚡</div>
    <div class="label">Meter Recharged</div>
    <div class="amount">₦${amount.toLocaleString()}</div>
    <div class="sub">${units} kWh credited to meter ${meterNumber}</div>
  </div>

  <div class="token-box">
    <div class="token-label">Your Vending Token</div>
    <div class="token-val">${formattedToken}</div>
    <div class="token-hint">Enter this 20-digit token on your prepaid meter keypad to load your units.</div>
  </div>

  <div class="body">
    <p class="greeting">
      Hi <strong>${firstName}</strong>,<br/>
      Your prepaid meter has been recharged successfully. Enter the token above
      on your meter keypad to load <strong>${units} kWh</strong> of electricity.
    </p>

    <div class="section-title" style="margin-bottom:10px">How to load your token</div>
    <div class="steps-box">
      <div class="step">
        <div class="step-num">1</div>
        <span>Press the <strong>0</strong> key (or any key) to wake your meter</span>
      </div>
      <div class="step">
        <div class="step-num">2</div>
        <span>Enter the <strong>20-digit token</strong> exactly as shown above</span>
      </div>
      <div class="step">
        <div class="step-num">3</div>
        <span>Press the <strong>Enter</strong> or <strong>#</strong> key to confirm</span>
      </div>
      <div class="step">
        <div class="step-num">4</div>
        <span>Your meter will display <strong>ACCEPTED</strong> and update your balance</span>
      </div>
    </div>

    <div class="section-title">Transaction Details</div>
    <div class="detail-box">
      <div class="detail-row">
        <span class="dk">Meter Number</span>
        <span class="dv mono">${meterNumber}</span>
      </div>
      <div class="detail-row">
        <span class="dk">Meter Nickname</span>
        <span class="dv">${meterNickname}</span>
      </div>
      <div class="detail-row">
        <span class="dk">Distribution Company</span>
        <span class="dv">${disco}</span>
      </div>
      <div class="detail-row">
        <span class="dk">Amount Paid</span>
        <span class="dv">₦${amount.toLocaleString()}.00</span>
      </div>
      <div class="detail-row">
        <span class="dk">Units Credited</span>
        <span class="dv green">${units} kWh</span>
      </div>
      <div class="detail-row">
        <span class="dk">Payment Method</span>
        <span class="dv">${paymentMethod}</span>
      </div>
      <div class="detail-row">
        <span class="dk">Date &amp; Time</span>
        <span class="dv">${date}</span>
      </div>
      <div class="detail-row">
        <span class="dk">Transaction Ref</span>
        <span class="dv mono">${reference}</span>
      </div>
    </div>

    <div class="cta-row">
      <a href="https://pay4light.ng/history" class="btn-primary">View Recharge History</a>
      <a href="https://pay4light.ng/recharge" class="btn-outline">Recharge Again</a>
    </div>

    <div class="warn-box">
      <strong>Token not accepted by your meter?</strong> Do not recharge again.
      Contact support at <strong>support@pay4light.ng</strong> or
      <strong>0800-PAY4LIGHT</strong> with your transaction reference and we
      will resolve it within 24 hours.
    </div>

    <p class="closing">
      Thank you for choosing Pay4light.ng — powering Nigerian homes,
      one recharge at a time.
    </p>
  </div>

  <div class="footer">
    Pay4light.ng &nbsp;·&nbsp; Lagos, Nigeria<br/>
    <a href="https://pay4light.ng">www.pay4light.ng</a>
    &nbsp;·&nbsp;
    <a href="https://pay4light.ng/privacy" style="color:#9aaba2">Privacy Policy</a>
    &nbsp;·&nbsp;
    <a href="https://pay4light.ng/unsubscribe" style="color:#9aaba2">Unsubscribe</a><br/>
    © 2026 Pay4light.ng. All rights reserved.
  </div>
</div>
</body>
</html>`;
}

export function getWalletFundedEmail(data: {
  firstName:      string;
  amount:         number;
  newBalance:     number;
  paymentMethod:  string;
  reference:      string;
  date:           string;
}): string {
  const { firstName, amount, newBalance, paymentMethod, reference, date } = data;

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>Wallet Funded — Pay4light.ng</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{background:#f4f5f0;font-family:Arial,Helvetica,sans-serif;padding:24px 16px}
.email-card{background:#fff;border-radius:14px;overflow:hidden;border:1px solid #e2e8e0;max-width:560px;margin:0 auto}
.logo-bar{text-align:center;margin-bottom:18px}
.logo-pill{display:inline-block;background:#0f6e56;border-radius:10px;padding:8px 18px;font-size:17px;font-weight:700;color:#fff;letter-spacing:-.3px}
.logo-pill span{color:#9FE1CB}
.top-bar{background:#0f6e56;padding:28px 32px;text-align:center}
.icon{width:50px;height:50px;border-radius:50%;background:#fff;margin:0 auto 14px;display:flex;align-items:center;justify-content:center;font-size:22px}
.label{color:#9FE1CB;font-size:11px;font-weight:700;letter-spacing:1px;text-transform:uppercase;margin-bottom:6px}
.amount{color:#fff;font-size:32px;font-weight:700;letter-spacing:-1px;margin-bottom:6px}
.sub{color:#9FE1CB;font-size:13px}
.body{padding:28px 32px}
.greeting{font-size:14px;color:#3d4a42;line-height:1.6;margin-bottom:20px}
.section-title{font-size:11px;font-weight:700;color:#0f6e56;letter-spacing:.8px;text-transform:uppercase;margin-bottom:10px}
.detail-box{background:#f4f9f6;border-radius:10px;border:1px solid #c0ddd0;margin-bottom:20px;overflow:hidden}
.detail-row{display:flex;justify-content:space-between;align-items:center;padding:8px 16px;border-bottom:1px solid #dceee5;font-size:12.5px}
.detail-row:last-child{border-bottom:none}
.dk{color:#6b7c74}
.dv{color:#1a2e26;font-weight:600;text-align:right}
.dv.green{color:#0f6e56}
.dv.mono{font-family:'Courier New',monospace;font-size:11.5px}
.cta-row{display:flex;gap:10px;justify-content:center;margin-bottom:20px}
.btn-primary{background:#0f6e56;color:#fff;font-size:13px;font-weight:600;padding:11px 24px;border-radius:8px;text-decoration:none;display:inline-block}
.warn-box{background:#fff8e6;border-radius:8px;border-left:4px solid #EF9F27;padding:12px 16px;margin-bottom:20px;font-size:12.5px;color:#7a5c10;line-height:1.5}
.closing{font-size:13.5px;color:#6b7c74;line-height:1.6}
.footer{padding:18px 32px;text-align:center;font-size:11.5px;color:#9aaba2;border-top:1px solid #f0f5f2;line-height:1.8}
.footer a{color:#0f6e56;text-decoration:none}
</style>
</head>
<body>
<div class="logo-bar">
  <div class="logo-pill">⚡ Pay4light<span>.ng</span></div>
</div>
<div class="email-card">
  <div class="top-bar">
    <div class="icon">✅</div>
    <div class="label">Wallet Funded</div>
    <div class="amount">₦${amount.toLocaleString()}</div>
    <div class="sub">has been added to your Pay4light wallet</div>
  </div>

  <div class="body">
    <p class="greeting">
      Hi <strong>${firstName}</strong>,<br/>
      Your Pay4light wallet has been funded successfully. You can now use
      your balance to recharge any of your registered prepaid meters instantly.
    </p>

    <div class="section-title">Transaction Details</div>
    <div class="detail-box">
      <div class="detail-row">
        <span class="dk">Amount Funded</span>
        <span class="dv">₦${amount.toLocaleString()}.00</span>
      </div>
      <div class="detail-row">
        <span class="dk">New Wallet Balance</span>
        <span class="dv green">₦${newBalance.toLocaleString()}.00</span>
      </div>
      <div class="detail-row">
        <span class="dk">Payment Method</span>
        <span class="dv">${paymentMethod}</span>
      </div>
      <div class="detail-row">
        <span class="dk">Date &amp; Time</span>
        <span class="dv">${date}</span>
      </div>
      <div class="detail-row">
        <span class="dk">Transaction Ref</span>
        <span class="dv mono">${reference}</span>
      </div>
    </div>

    <div class="cta-row">
      <a href="https://pay4light.ng/recharge" class="btn-primary">Recharge a Meter Now</a>
    </div>

    <div class="warn-box">
      <strong>Did not make this transaction?</strong> If you did not fund your
      wallet, please contact our support team immediately at
      <strong>support@pay4light.ng</strong> or call <strong>0800-PAY4LIGHT</strong>.
    </div>

    <p class="closing">
      Thank you for choosing Pay4light.ng — powering Nigerian homes,
      one recharge at a time.
    </p>
  </div>

  <div class="footer">
    Pay4light.ng &nbsp;·&nbsp; Lagos, Nigeria<br/>
    <a href="https://pay4light.ng">www.pay4light.ng</a>
    &nbsp;·&nbsp;
    <a href="https://pay4light.ng/privacy" style="color:#9aaba2">Privacy Policy</a>
    &nbsp;·&nbsp;
    <a href="https://pay4light.ng/unsubscribe" style="color:#9aaba2">Unsubscribe</a><br/>
    © 2026 Pay4light.ng. All rights reserved.
  </div>
</div>
</body>
</html>`;
}