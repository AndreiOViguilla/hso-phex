const { Resend } = require("resend");

// Lazy init — only fails if you actually try to send an email without a key
let resend = null;
function getResend() {
  if (!resend) {
    if (!process.env.RESEND_API_KEY) {
      console.warn("⚠ RESEND_API_KEY not set — emails will be skipped");
      return null;
    }
    resend = new Resend(process.env.RESEND_API_KEY);
  }
  return resend;
}

async function sendBookingConfirmation(email, booking) {
  const typeLabel = booking.appointment_type === "phex" ? "Periodic Health Examination (PHEx)" : "Drug Test";
  const venue     = booking.appointment_type === "phex"
    ? "Waldo Perfecto Seminar Room, Ground floor, Br. Connon Hall"
    : "2nd floor, Enrique Razon Sports Center (ERSC)";

  const client = getResend();
  if (!client) {
    console.log("Email skipped (no API key):", email);
    return;
  }
  await client.emails.send({
    from: process.env.EMAIL_FROM || "noreply@yourdomain.com",
    to:   email,
    subject: `Booking Confirmed — ${typeLabel}`,
    html: `
      <div style="font-family: sans-serif; max-width: 500px; margin: 0 auto;">
        <div style="background: #1e3a8a; color: #fff; padding: 24px; border-radius: 8px 8px 0 0;">
          <div style="font-size: 12px; opacity: 0.7; margin-bottom: 6px;">DLSU · Health Services Office</div>
          <h2 style="margin: 0; font-size: 20px;">Booking Confirmed</h2>
        </div>
        <div style="background: #fff; border: 1px solid #e5e7eb; padding: 24px; border-radius: 0 0 8px 8px;">
          <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 16px; margin-bottom: 20px;">
            <div style="color: #16a34a; font-weight: 700; margin-bottom: 4px;">✓ You are scheduled!</div>
            <div style="color: #374151; font-size: 14px;">A calendar invitation has been sent to your email.</div>
          </div>
          <table style="width: 100%; font-size: 14px; border-collapse: collapse;">
            <tr><td style="padding: 8px 0; color: #6b7280;">Activity</td><td style="padding: 8px 0; font-weight: 600;">${typeLabel}</td></tr>
            <tr><td style="padding: 8px 0; color: #6b7280;">Date</td><td style="padding: 8px 0; font-weight: 600;">${booking.appointment_date}</td></tr>
            <tr><td style="padding: 8px 0; color: #6b7280;">Time</td><td style="padding: 8px 0; font-weight: 600;">${booking.time_slot}</td></tr>
            <tr><td style="padding: 8px 0; color: #6b7280;">Venue</td><td style="padding: 8px 0; font-weight: 600;">${venue}</td></tr>
            <tr><td style="padding: 8px 0; color: #6b7280;">Booking code</td><td style="padding: 8px 0; font-weight: 600;">${booking.booking_code || "—"}</td></tr>
          </table>
          <div style="background: #fffbeb; border: 1px solid #fde68a; border-radius: 8px; padding: 12px; margin-top: 20px; font-size: 13px; color: #92400e;">
            Please show this confirmation email to the guard at the ${typeLabel} station on your appointment day.
          </div>
        </div>
        <div style="text-align: center; padding: 16px; font-size: 12px; color: #9ca3af;">
          Questions? Email <a href="mailto:phex@dlsu.edu.ph" style="color: #1d4ed8;">phex@dlsu.edu.ph</a>
        </div>
      </div>
    `,
  });
}

module.exports = { sendBookingConfirmation };