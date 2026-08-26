import nodemailer from 'nodemailer'

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.SMTP_USER || 'voxai4278@gmail.com',
    pass: process.env.SMTP_PASS || 'kuliulufzwdibrct'
  }
})

interface SendBookingEmailOptions {
  to: string
  subject: string
  recipientName: string
  eventTitle: string
  bookingDate: string
  startTime: string
  meetingLink: string
  notes?: string
  isAdmin?: boolean
  leadPhone?: string
  leadEmail?: string
}

export async function sendBookingEmail(options: SendBookingEmailOptions) {
  try {
    const { to, subject, recipientName, eventTitle, bookingDate, startTime, meetingLink, notes, isAdmin, leadPhone, leadEmail } = options

    const htmlContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #0f172a; color: #f8fafc; border-radius: 16px; overflow: hidden; border: 1px solid #1e293b;">
        <div style="background-color: #1e293b; padding: 24px; text-align: center; border-bottom: 1px solid #334155;">
          <h2 style="margin: 0; color: #10b981; font-size: 20px; font-weight: 800;">🗓️ ${isAdmin ? 'New Booking Alert' : 'Booking Confirmed!'}</h2>
          <p style="margin: 4px 0 0 0; color: #94a3b8; font-size: 13px;">VoxAI Appointment Scheduler</p>
        </div>

        <div style="padding: 28px;">
          <p style="font-size: 14px; color: #cbd5e1; margin-top: 0;">Hello <strong>${recipientName}</strong>,</p>

          <p style="font-size: 14px; color: #94a3b8; line-height: 1.5;">
            ${isAdmin 
              ? `A new meeting has been booked on your calendar:` 
              : `Your appointment for <strong>${eventTitle}</strong> has been successfully confirmed.`}
          </p>

          <div style="background-color: #1e293b; padding: 20px; border-radius: 12px; margin: 20px 0; border: 1px solid #334155;">
            <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
              <tr>
                <td style="padding: 8px 0; color: #94a3b8; width: 120px;">Meeting Title:</td>
                <td style="padding: 8px 0; color: #ffffff; font-weight: bold;">${eventTitle}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #94a3b8;">Date:</td>
                <td style="padding: 8px 0; color: #10b981; font-weight: bold;">${bookingDate}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #94a3b8;">Time Slot:</td>
                <td style="padding: 8px 0; color: #10b981; font-weight: bold;">${startTime}</td>
              </tr>
              ${isAdmin ? `
              <tr>
                <td style="padding: 8px 0; color: #94a3b8;">Attendee Phone:</td>
                <td style="padding: 8px 0; color: #ffffff; font-family: monospace;">${leadPhone || ''}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #94a3b8;">Attendee Email:</td>
                <td style="padding: 8px 0; color: #ffffff;">${leadEmail || ''}</td>
              </tr>
              ` : ''}
              ${notes ? `
              <tr>
                <td style="padding: 8px 0; color: #94a3b8;">Notes / Agenda:</td>
                <td style="padding: 8px 0; color: #cbd5e1; font-style: italic;">${notes}</td>
              </tr>
              ` : ''}
            </table>
          </div>

          <div style="text-align: center; margin-top: 28px;">
            <a href="${meetingLink.startsWith('http') ? meetingLink : 'https://' + meetingLink}" target="_blank" style="display: inline-block; background-color: #2563eb; color: #ffffff; text-decoration: none; padding: 12px 28px; font-size: 13px; font-weight: bold; border-radius: 10px; box-shadow: 0 4px 12px rgba(37, 99, 235, 0.3);">
              📹 Join Google Meet / Call Link
            </a>
          </div>
        </div>

        <div style="background-color: #020617; padding: 16px; text-align: center; border-top: 1px solid #1e293b; font-size: 11px; color: #64748b;">
          VoxAI Automated Calendar Scheduler • Sent via voxai4278@gmail.com
        </div>
      </div>
    `

    const textContent = `Hello ${recipientName},\n\n` +
      `${isAdmin ? 'New appointment booked:' : `Your meeting "${eventTitle}" is confirmed!`}\n\n` +
      `Date: ${bookingDate}\n` +
      `Time: ${startTime}\n` +
      `Meeting Link: ${meetingLink}\n` +
      (notes ? `Notes: ${notes}\n` : '') +
      `\nThank you!`

    const info = await transporter.sendMail({
      from: '"VoxAI Calendar" <voxai4278@gmail.com>',
      to,
      subject,
      text: textContent,
      html: htmlContent
    })

    console.log(`[SMTP Email] Sent to ${to} (Message ID: ${info.messageId})`)
    return { success: true, messageId: info.messageId }
  } catch (err: any) {
    console.error(`[SMTP Email Error] Failed to send email to ${options.to}:`, err)
    return { success: false, error: err.message }
  }
}

export async function sendOrderStatusNotification(order: any, newStatus: string) {
  try {
    if (!order?.customer_email) return
    const info = await transporter.sendMail({
      from: '"VoxAI Orders" <voxai4278@gmail.com>',
      to: order.customer_email,
      subject: `Order Update #${order.id || ''}: ${newStatus.toUpperCase()}`,
      html: `<p>Your order status has been updated to: <strong>${newStatus}</strong></p>`
    })
    return { success: true, messageId: info.messageId }
  } catch (err: any) {
    console.error('[SMTP Email Error] Failed to send order status notification:', err)
    return { success: false, error: err.message }
  }
}

export async function sendEmail({ to, subject, html, text }: { to: string; subject: string; html?: string; text?: string }) {
  try {
    const info = await transporter.sendMail({
      from: '"VoxAI System" <voxai4278@gmail.com>',
      to,
      subject,
      text: text || '',
      html: html || `<p>${text || ''}</p>`
    })
    return { success: true, messageId: info.messageId }
  } catch (err: any) {
    console.error('[SMTP Email Error] Failed to send generic email:', err)
    return { success: false, error: err.message }
  }
}
