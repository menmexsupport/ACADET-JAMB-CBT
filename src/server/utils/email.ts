interface SendEmailParams {
  to: string;
  subject: string;
  html: string;
  text: string;
}

export async function sendTransactionalEmail(params: SendEmailParams): Promise<{ sent: boolean; provider: string }> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = process.env.SMTP_FROM_EMAIL?.trim() || 'Acadet JAMB CBT <no-reply@acadetjamb.com>';

  if (!apiKey) {
    console.log(`[email:dev-preview] To=${params.to} | Subject="${params.subject}" (RESEND_API_KEY not configured)`);
    return { sent: false, provider: 'unconfigured' };
  }

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from,
        to: [params.to],
        subject: params.subject,
        html: params.html,
        text: params.text,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('[email] Resend API error:', response.status, errText);
      return { sent: false, provider: 'resend_error' };
    }

    return { sent: true, provider: 'resend' };
  } catch (error) {
    console.error('[email] Failed to send email:', error);
    return { sent: false, provider: 'network_error' };
  }
}
