const { Resend } = require("resend");

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM   = process.env.FROM_EMAIL || "onboarding@resend.dev";
const APP_URL = process.env.FRONTEND_URL || "https://hso-phex.vercel.app";

async function sendPasswordReset(toEmail, resetToken) {
  const resetUrl = `${APP_URL}/reset-password?token=${resetToken}`;
  await resend.emails.send({
    from: FROM,
    to:   toEmail,
    subject: "Reset your PHEx Portal password",
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px 24px">
        <div style="background:#1e3a8a;border-radius:12px;padding:20px 24px;margin-bottom:24px">
          <h2 style="color:#fff;margin:0;font-size:20px">DLSU · Health Services Office</h2>
          <p style="color:rgba(255,255,255,0.7);margin:4px 0 0;font-size:13px">PHEx Portal</p>
        </div>
        <h3 style="color:#111827;margin-bottom:8px">Reset your password</h3>
        <p style="color:#6b7280;font-size:14px;line-height:1.6;margin-bottom:24px">
          We received a request to reset your password. Click the button below to set a new one.
          This link expires in <strong>1 hour</strong>.
        </p>
        <a href="${resetUrl}" style="display:inline-block;background:#1d4ed8;color:#fff;text-decoration:none;padding:12px 28px;border-radius:8px;font-weight:700;font-size:14px">
          Reset password
        </a>
        <p style="color:#9ca3af;font-size:12px;margin-top:24px;line-height:1.6">
          If you didn't request this, ignore this email — your password won't change.<br/>
          Link: <a href="${resetUrl}" style="color:#1d4ed8">${resetUrl}</a>
        </p>
      </div>
    `,
  });
}

async function sendBookingCode(toEmail, studentName, bookingCode, appointmentType, appointmentDate, timeSlot) {
  await resend.emails.send({
    from: FROM,
    to:   toEmail,
    subject: `Your ${appointmentType.toUpperCase()} booking code — PHEx Portal`,
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px 24px">
        <div style="background:#1e3a8a;border-radius:12px;padding:20px 24px;margin-bottom:24px">
          <h2 style="color:#fff;margin:0;font-size:20px">DLSU · Health Services Office</h2>
          <p style="color:rgba(255,255,255,0.7);margin:4px 0 0;font-size:13px">PHEx Portal</p>
        </div>
        <h3 style="color:#111827;margin-bottom:8px">Your booking code</h3>
        <p style="color:#6b7280;font-size:14px;line-height:1.6;margin-bottom:20px">
          Hi ${studentName}, here is your booking code for your ${appointmentType.toUpperCase()} appointment.
        </p>
        <div style="background:#f0f9ff;border:1px solid #bae6fd;border-radius:10px;padding:16px 20px;margin-bottom:20px">
          <div style="font-size:12px;color:#0369a1;font-weight:600;margin-bottom:4px">BOOKING CODE</div>
          <div style="font-size:28px;font-weight:800;color:#1d4ed8;letter-spacing:0.1em">${bookingCode}</div>
        </div>
        <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:10px;padding:14px 16px;margin-bottom:20px">
          <div style="font-size:12px;color:#374151;margin-bottom:4px"><strong>Appointment:</strong> ${appointmentType.toUpperCase()}</div>
          <div style="font-size:12px;color:#374151;margin-bottom:4px"><strong>Date:</strong> ${appointmentDate}</div>
          <div style="font-size:12px;color:#374151"><strong>Time:</strong> ${timeSlot}</div>
        </div>
        <p style="color:#9ca3af;font-size:12px;line-height:1.6">
          Use this code if you need to reschedule your appointment on the PHEx Portal.
        </p>
      </div>
    `,
  });
}

async function sendAppointmentReminder(email, name, appointmentType, appointmentDate, timeSlot, venue) {
  const label = appointmentType === "phex" ? "PHEx (Physical Examination)" : "Drug Test";
  const d = new Date(appointmentDate + "T00:00:00");
  const dateStr = d.toLocaleDateString("en-PH", { weekday: "long", month: "long", day: "numeric", year: "numeric" });

  await resend.emails.send({
    from: FROM_EMAIL,
    to: email,
    subject: `Reminder: Your ${label} appointment is tomorrow`,
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px 24px">
        <h2 style="color:#1e3a8a">Appointment Reminder</h2>
        <p>Hi ${name},</p>
        <p>This is a reminder that your <strong>${label}</strong> appointment is <strong>tomorrow</strong>.</p>
        <div style="background:#f0f9ff;border-radius:10px;padding:16px;margin:20px 0">
          <p style="margin:4px 0"><strong>Date:</strong> ${dateStr}</p>
          <p style="margin:4px 0"><strong>Time:</strong> ${timeSlot}</p>
          <p style="margin:4px 0"><strong>Venue:</strong> ${venue}</p>
        </div>
        <p>Please bring your printed form and DLSU ID. Show your confirmation email to the guard.</p>
        <p style="color:#6b7280;font-size:12px">DLSU Health Services Office</p>
      </div>
    `,
  });
}

module.exports = { sendPasswordReset, sendBookingCode, sendAppointmentReminder };