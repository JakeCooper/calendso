import dayjs, { Dayjs } from "dayjs";
import localizedFormat from "dayjs/plugin/localizedFormat";
import timezone from "dayjs/plugin/timezone";
import toArray from "dayjs/plugin/toArray";
import utc from "dayjs/plugin/utc";
import { createEvent, DateArray } from "ics";
import nodemailer from "nodemailer";

import { getCancelLink } from "@lib/CalEventParser";
import { CalendarEvent, Person } from "@lib/calendarClient";
import { getErrorFromUnknown } from "@lib/errors";
import { serverConfig } from "@lib/serverConfig";

import { emailHead } from "./common/head";

dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.extend(localizedFormat);
dayjs.extend(toArray);

export default class OrganizerScheduledEmail {
  calEvent: CalendarEvent;

  constructor(calEvent: CalendarEvent) {
    this.calEvent = calEvent;
  }

  public sendEmail() {
    new Promise((resolve, reject) =>
      nodemailer
        .createTransport(this.getMailerOptions().transport)
        .sendMail(this.getNodeMailerPayload(), (_err, info) => {
          if (_err) {
            const err = getErrorFromUnknown(_err);
            this.printNodeMailerError(err);
            reject(err);
          } else {
            resolve(info);
          }
        })
    ).catch((e) => console.error("sendEmail", e));
    return new Promise((resolve) => resolve("send mail async"));
  }

  protected getiCalEventAsString(): string | undefined {
    const icsEvent = createEvent({
      start: dayjs(this.calEvent.startTime)
        .utc()
        .toArray()
        .slice(0, 6)
        .map((v, i) => (i === 1 ? v + 1 : v)) as DateArray,
      startInputType: "utc",
      productId: "calendso/ics",
      title: this.calEvent.language("ics_event_title", {
        eventType: this.calEvent.type,
        name: this.calEvent.attendees[0].name,
      }),
      description: this.getTextBody(),
      duration: { minutes: dayjs(this.calEvent.endTime).diff(dayjs(this.calEvent.startTime), "minute") },
      organizer: { name: this.calEvent.organizer.name, email: this.calEvent.organizer.email },
      attendees: this.calEvent.attendees.map((attendee: Person) => ({
        name: attendee.name,
        email: attendee.email,
      })),
      status: "CONFIRMED",
    });
    if (icsEvent.error) {
      throw icsEvent.error;
    }
    return icsEvent.value;
  }

  protected getNodeMailerPayload(): Record<string, unknown> {
    const toAddresses = [this.calEvent.organizer.email];
    if (this.calEvent.team) {
      this.calEvent.team.members.forEach((member) => {
        const memberAttendee = this.calEvent.attendees.find((attendee) => attendee.name === member);
        if (memberAttendee) {
          toAddresses.push(memberAttendee.email);
        }
      });
    }

    return {
      icalEvent: {
        filename: "event.ics",
        content: this.getiCalEventAsString(),
      },
      from: `Cal.com <${this.getMailerOptions().from}>`,
      to: toAddresses.join(","),
      subject: `${this.calEvent.language("confirmed_event_type_subject", {
        eventType: this.calEvent.type,
        name: this.calEvent.attendees[0].name,
        date: `${this.getOrganizerStart().format("h:mma")} - ${this.getOrganizerEnd().format(
          "h:mma"
        )}, ${this.calEvent.language(
          this.getOrganizerStart().format("dddd").toLowerCase()
        )}, ${this.calEvent.language(
          this.getOrganizerStart().format("MMMM").toLowerCase()
        )} ${this.getOrganizerStart().format("D")}, ${this.getOrganizerStart().format("YYYY")}`,
      })}`,
      html: this.getHtmlBody(),
      text: this.getTextBody(),
    };
  }

  protected getMailerOptions() {
    return {
      transport: serverConfig.transport,
      from: serverConfig.from,
    };
  }

  protected getTextBody(): string {
    return `
${this.calEvent.language("new_event_scheduled")}
${this.calEvent.language("emailed_you_and_any_other_attendees")}
${this.getWhat()}
${this.getWhen()}
${this.getLocation()}
${this.getAdditionalNotes()}
${this.calEvent.language("need_to_reschedule_or_cancel")}
${getCancelLink(this.calEvent)}
`.replace(/(<([^>]+)>)/gi, "");
  }

  protected printNodeMailerError(error: Error): void {
    console.error("SEND_BOOKING_CONFIRMATION_ERROR", this.calEvent.organizer.email, error);
  }

  protected getHtmlBody(): string {
    const headerContent = this.calEvent.language("confirmed_event_type_subject", {
      eventType: this.calEvent.type,
      name: this.calEvent.attendees[0].name,
      date: `${this.getOrganizerStart().format("h:mma")} - ${this.getOrganizerEnd().format(
        "h:mma"
      )}, ${this.calEvent.language(
        this.getOrganizerStart().format("dddd").toLowerCase()
      )}, ${this.calEvent.language(
        this.getOrganizerStart().format("MMMM").toLowerCase()
      )} ${this.getOrganizerStart().format("D")}, ${this.getOrganizerStart().format("YYYY")}`,
    });

    return `
    <!doctype html>
    <html xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
    ${emailHead(headerContent)}
    <body style="word-spacing:normal;background-color:#F5F5F5;">
      <div style="background-color:#F5F5F5;">
        <!--[if mso | IE]><table align="center" border="0" cellpadding="0" cellspacing="0" class="" style="width:600px;" width="600" ><tr><td style="line-height:0px;font-size:0px;mso-line-height-rule:exactly;"><![endif]-->
        <div style="margin:0px auto;max-width:600px;">
          <table align="center" border="0" cellpadding="0" cellspacing="0" role="presentation" style="width:100%;">
            <tbody>
              <tr>
                <td style="direction:ltr;font-size:0px;padding:0px;padding-top:40px;text-align:center;">
                  <!--[if mso | IE]><table role="presentation" border="0" cellpadding="0" cellspacing="0"><tr></tr></table><![endif]-->
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <!--[if mso | IE]></td></tr></table><table align="center" border="0" cellpadding="0" cellspacing="0" class="" style="width:600px;" width="600" bgcolor="#FFFFFF" ><tr><td style="line-height:0px;font-size:0px;mso-line-height-rule:exactly;"><![endif]-->
        <div style="background:#FFFFFF;background-color:#FFFFFF;margin:0px auto;max-width:600px;">
          <table align="center" border="0" cellpadding="0" cellspacing="0" role="presentation" style="background:#FFFFFF;background-color:#FFFFFF;width:100%;">
            <tbody>
              <tr>
                <td style="border-left:1px solid #E1E1E1;border-right:1px solid #E1E1E1;border-top:1px solid #E1E1E1;direction:ltr;font-size:0px;padding:30px 20px 0 20px;text-align:center;">
                  <!--[if mso | IE]><table role="presentation" border="0" cellpadding="0" cellspacing="0"><tr><td class="" style="vertical-align:top;width:558px;" ><![endif]-->
                  <div class="mj-column-per-100 mj-outlook-group-fix" style="font-size:0px;text-align:left;direction:ltr;display:inline-block;vertical-align:top;width:100%;">
                    <table border="0" cellpadding="0" cellspacing="0" role="presentation" style="vertical-align:top;" width="100%">
                      <tbody>
                        <tr>
                          <td align="center" style="font-size:0px;padding:10px 25px;word-break:break-word;">
                            <table border="0" cellpadding="0" cellspacing="0" role="presentation" style="border-collapse:collapse;border-spacing:0px;">
                              <tbody>
                                <tr>
                                  <td style="width:64px;">
                                    <img height="64" src="https://i.imgur.com/6BHFgjS.png" style="border:0;display:block;outline:none;text-decoration:none;height:64px;width:100%;font-size:13px;" width="64" />
                                  </td>
                                </tr>
                              </tbody>
                            </table>
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                  <!--[if mso | IE]></td></tr></table><![endif]-->
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <!--[if mso | IE]></td></tr></table><table align="center" border="0" cellpadding="0" cellspacing="0" class="" style="width:600px;" width="600" bgcolor="#FFFFFF" ><tr><td style="line-height:0px;font-size:0px;mso-line-height-rule:exactly;"><![endif]-->
        <div style="background:#FFFFFF;background-color:#FFFFFF;margin:0px auto;max-width:600px;">
          <table align="center" border="0" cellpadding="0" cellspacing="0" role="presentation" style="background:#FFFFFF;background-color:#FFFFFF;width:100%;">
            <tbody>
              <tr>
                <td style="border-left:1px solid #E1E1E1;border-right:1px solid #E1E1E1;direction:ltr;font-size:0px;padding:0px;text-align:center;">
                  <!--[if mso | IE]><table role="presentation" border="0" cellpadding="0" cellspacing="0"><tr><td class="" style="vertical-align:top;width:598px;" ><![endif]-->
                  <div class="mj-column-per-100 mj-outlook-group-fix" style="font-size:0px;text-align:left;direction:ltr;display:inline-block;vertical-align:top;width:100%;">
                    <table border="0" cellpadding="0" cellspacing="0" role="presentation" style="vertical-align:top;" width="100%">
                      <tbody>
                        <tr>
                          <td align="center" style="font-size:0px;padding:10px 25px;padding-top:24px;padding-bottom:0px;word-break:break-word;">
                            <div style="font-family:Roboto, Helvetica, sans-serif;font-size:24px;font-weight:700;line-height:24px;text-align:center;color:#292929;">${this.calEvent.language(
                              "new_event_scheduled"
                            )}</div>
                          </td>
                        </tr>
                        <tr>
                          <td align="center" style="font-size:0px;padding:10px 25px;word-break:break-word;">
                            <div style="font-family:Roboto, Helvetica, sans-serif;font-size:16px;font-weight:400;line-height:24px;text-align:center;color:#494949;">${this.calEvent.language(
                              "emailed_you_and_any_other_attendees"
                            )}</div>
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                  <!--[if mso | IE]></td></tr></table><![endif]-->
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <!--[if mso | IE]></td></tr></table><table align="center" border="0" cellpadding="0" cellspacing="0" class="" style="width:600px;" width="600" bgcolor="#FFFFFF" ><tr><td style="line-height:0px;font-size:0px;mso-line-height-rule:exactly;"><![endif]-->
        <div style="background:#FFFFFF;background-color:#FFFFFF;margin:0px auto;max-width:600px;">
          <table align="center" border="0" cellpadding="0" cellspacing="0" role="presentation" style="background:#FFFFFF;background-color:#FFFFFF;width:100%;">
            <tbody>
              <tr>
                <td style="border-left:1px solid #E1E1E1;border-right:1px solid #E1E1E1;direction:ltr;font-size:0px;padding:15px 0px 0 0px;text-align:center;">
                  <!--[if mso | IE]><table role="presentation" border="0" cellpadding="0" cellspacing="0"><tr><td class="" style="vertical-align:top;width:598px;" ><![endif]-->
                  <div class="mj-column-per-100 mj-outlook-group-fix" style="font-size:0px;text-align:left;direction:ltr;display:inline-block;vertical-align:top;width:100%;">
                    <table border="0" cellpadding="0" cellspacing="0" role="presentation" style="vertical-align:top;" width="100%">
                      <tbody>
                        <tr>
                          <td align="center" style="font-size:0px;padding:10px 25px;padding-bottom:15px;word-break:break-word;">
                            <p style="border-top:solid 1px #E1E1E1;font-size:1px;margin:0px auto;width:100%;">
                            </p>
                            <!--[if mso | IE]><table align="center" border="0" cellpadding="0" cellspacing="0" style="border-top:solid 1px #E1E1E1;font-size:1px;margin:0px auto;width:548px;" role="presentation" width="548px" ><tr><td style="height:0;line-height:0;"> &nbsp;
    </td></tr></table><![endif]-->
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                  <!--[if mso | IE]></td></tr></table><![endif]-->
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <!--[if mso | IE]></td></tr></table><table align="center" border="0" cellpadding="0" cellspacing="0" class="" style="width:600px;" width="600" bgcolor="#FFFFFF" ><tr><td style="line-height:0px;font-size:0px;mso-line-height-rule:exactly;"><![endif]-->
        <div style="background:#FFFFFF;background-color:#FFFFFF;margin:0px auto;max-width:600px;">
          <table align="center" border="0" cellpadding="0" cellspacing="0" role="presentation" style="background:#FFFFFF;background-color:#FFFFFF;width:100%;">
            <tbody>
              <tr>
                <td style="border-left:1px solid #E1E1E1;border-right:1px solid #E1E1E1;direction:ltr;font-size:0px;padding:0px;text-align:center;">
                  <!--[if mso | IE]><table role="presentation" border="0" cellpadding="0" cellspacing="0"><tr><td class="" style="vertical-align:top;width:598px;" ><![endif]-->
                  <div class="mj-column-per-100 mj-outlook-group-fix" style="font-size:0px;text-align:left;direction:ltr;display:inline-block;vertical-align:top;width:100%;">
                    <table border="0" cellpadding="0" cellspacing="0" role="presentation" style="vertical-align:top;" width="100%">
                      <tbody>
                        <tr>
                          <td align="left" style="font-size:0px;padding:10px 25px;word-break:break-word;">
                            <div style="font-family:Roboto, Helvetica, sans-serif;font-size:16px;font-weight:500;line-height:1;text-align:left;color:#3E3E3E;">
                              ${this.getWhat()}
                              ${this.getWhen()}
                              ${this.getWho()}
                              ${this.getLocation()}
                              ${this.getAdditionalNotes()}
                            </div>
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                  <!--[if mso | IE]></td></tr></table><![endif]-->
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <!--[if mso | IE]></td></tr></table><table align="center" border="0" cellpadding="0" cellspacing="0" class="" style="width:600px;" width="600" bgcolor="#FFFFFF" ><tr><td style="line-height:0px;font-size:0px;mso-line-height-rule:exactly;"><![endif]-->
        <div style="background:#FFFFFF;background-color:#FFFFFF;margin:0px auto;max-width:600px;">
          <table align="center" border="0" cellpadding="0" cellspacing="0" role="presentation" style="background:#FFFFFF;background-color:#FFFFFF;width:100%;">
            <tbody>
              <tr>
                <td style="border-left:1px solid #E1E1E1;border-right:1px solid #E1E1E1;direction:ltr;font-size:0px;padding:0px;text-align:center;">
                  <!--[if mso | IE]><table role="presentation" border="0" cellpadding="0" cellspacing="0"><tr><td class="" style="vertical-align:top;width:598px;" ><![endif]-->
                  <div class="mj-column-per-100 mj-outlook-group-fix" style="font-size:0px;text-align:left;direction:ltr;display:inline-block;vertical-align:top;width:100%;">
                    <table border="0" cellpadding="0" cellspacing="0" role="presentation" style="vertical-align:top;" width="100%">
                      <tbody>
                        <tr>
                          <td align="center" style="font-size:0px;padding:10px 25px;padding-bottom:15px;word-break:break-word;">
                            <p style="border-top:solid 1px #E1E1E1;font-size:1px;margin:0px auto;width:100%;">
                            </p>
                            <!--[if mso | IE]><table align="center" border="0" cellpadding="0" cellspacing="0" style="border-top:solid 1px #E1E1E1;font-size:1px;margin:0px auto;width:548px;" role="presentation" width="548px" ><tr><td style="height:0;line-height:0;"> &nbsp;
    </td></tr></table><![endif]-->
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                  <!--[if mso | IE]></td></tr></table><![endif]-->
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <!--[if mso | IE]></td></tr></table><table align="center" border="0" cellpadding="0" cellspacing="0" class="" style="width:600px;" width="600" bgcolor="#FFFFFF" ><tr><td style="line-height:0px;font-size:0px;mso-line-height-rule:exactly;"><![endif]-->
        <div style="background:#FFFFFF;background-color:#FFFFFF;margin:0px auto;max-width:600px;">
          <table align="center" border="0" cellpadding="0" cellspacing="0" role="presentation" style="background:#FFFFFF;background-color:#FFFFFF;width:100%;">
            <tbody>
              <tr>
                <td style="border-bottom:1px solid #E1E1E1;border-left:1px solid #E1E1E1;border-right:1px solid #E1E1E1;direction:ltr;font-size:0px;padding:0px;text-align:center;">
                  <!--[if mso | IE]><table role="presentation" border="0" cellpadding="0" cellspacing="0"><tr><td class="" style="vertical-align:top;width:598px;" ><![endif]-->
                  <div class="mj-column-per-100 mj-outlook-group-fix" style="font-size:0px;text-align:left;direction:ltr;display:inline-block;vertical-align:top;width:100%;">
                    <table border="0" cellpadding="0" cellspacing="0" role="presentation" style="vertical-align:top;" width="100%">
                      <tbody>
                        <tr>
                          <td align="left" style="font-size:0px;padding:10px 25px;word-break:break-word;">
                            <div style="font-family:Roboto, Helvetica, sans-serif;font-size:16px;font-weight:500;line-height:0px;text-align:left;color:#3E3E3E;">
                              ${this.getManageLink()}
                            </div>
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                  <!--[if mso | IE]></td></tr></table><![endif]-->
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <!--[if mso | IE]></td></tr></table><table align="center" border="0" cellpadding="0" cellspacing="0" class="" style="width:600px;" width="600" ><tr><td style="line-height:0px;font-size:0px;mso-line-height-rule:exactly;"><![endif]-->
        <div style="margin:0px auto;max-width:600px;">
          <table align="center" border="0" cellpadding="0" cellspacing="0" role="presentation" style="width:100%;">
            <tbody>
              <tr>
                <td style="direction:ltr;font-size:0px;padding:0px;text-align:center;">
                  <!--[if mso | IE]><table role="presentation" border="0" cellpadding="0" cellspacing="0"><tr><td class="" style="vertical-align:top;width:600px;" ><![endif]-->
                  <div class="mj-column-per-100 mj-outlook-group-fix" style="font-size:0px;text-align:left;direction:ltr;display:inline-block;vertical-align:top;width:100%;">
                    <table border="0" cellpadding="0" cellspacing="0" role="presentation" style="vertical-align:top;" width="100%">
                      <tbody>
                        <tr>
                          <td align="center" style="font-size:0px;padding:10px 25px;padding-top:32px;word-break:break-word;">
                            <table border="0" cellpadding="0" cellspacing="0" role="presentation" style="border-collapse:collapse;border-spacing:0px;">
                              <tbody>
                                <tr>
                                  <td style="width:89px;">
                                    <a href="#" target="_blank">
                                      <img height="19" src="https://i.imgur.com/esapZ47.png" style="border:0;display:block;outline:none;text-decoration:none;height:19px;width:100%;font-size:13px;" width="89" />
                                    </a>
                                  </td>
                                </tr>
                              </tbody>
                            </table>
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                  <!--[if mso | IE]></td></tr></table><![endif]-->
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <!--[if mso | IE]></td></tr></table><![endif]-->
      </div>
    </body>
    </html>
    `;
  }

  protected getManageLink(): string {
    const manageText = this.calEvent.language("manage_this_event");
    return `<p>${this.calEvent.language(
      "need_to_reschedule_or_cancel"
    )}</p><p style="font-weight: 400; line-height: 24px;"><a href="${getCancelLink(
      this.calEvent
    )}" style="color: #3E3E3E;" alt="${manageText}">${manageText}</a></p>`;
  }

  protected getWhat(): string {
    return `
    <div style="line-height: 6px;">
      <p style="color: #494949;">${this.calEvent.language("what")}</p>
      <p style="color: #494949; font-weight: 400; line-height: 24px;">${this.calEvent.type}</p>
    </div>`;
  }

  protected getWhen(): string {
    return `
    <p style="height: 6px"></p>
    <div style="line-height: 6px;">
      <p style="color: #494949;">${this.calEvent.language("when")}</p>
      <p style="color: #494949; font-weight: 400; line-height: 24px;">
      ${this.calEvent.language(
        this.getOrganizerStart().format("dddd").toLowerCase()
      )}, ${this.calEvent.language(
      this.getOrganizerStart().format("MMMM").toLowerCase()
    )} ${this.getOrganizerStart().format("D")}, ${this.getOrganizerStart().format(
      "YYYY"
    )} | ${this.getOrganizerStart().format("h:mma")} - ${this.getOrganizerEnd().format(
      "h:mma"
    )} <span style="color: #888888">(${this.getTimezone()})</span>
      </p>
    </div>`;
  }

  protected getWho(): string {
    const attendees = this.calEvent.attendees
      .map((attendee) => {
        return `<div style="color: #494949; font-weight: 400; line-height: 24px;">${
          attendee?.name || `${this.calEvent.language("guest")}`
        } <span style="color: #888888"><a href="mailto:${attendee.email}" style="color: #888888;">${
          attendee.email
        }</a></span></div>`;
      })
      .join("");

    const organizer = `<div style="color: #494949; font-weight: 400; line-height: 24px;">${
      this.calEvent.organizer.name
    } - ${this.calEvent.language("organizer")} <span style="color: #888888"><a href="mailto:${
      this.calEvent.organizer.email
    }" style="color: #888888;">${this.calEvent.organizer.email}</a></span></div>`;

    return `
    <p style="height: 6px"></p>
    <div style="line-height: 6px;">
      <p style="color: #494949;">${this.calEvent.language("who")}</p>
      ${organizer + attendees}
    </div>`;
  }

  protected getAdditionalNotes(): string {
    return `
    <p style="height: 6px"></p>
    <div style="line-height: 6px;">
      <p style="color: #494949;">${this.calEvent.language("additional_notes")}</p>
      <p style="color: #494949; font-weight: 400; line-height: 24px;">${this.calEvent.description}</p>
    </div>
    `;
  }

  protected getLocation(): string {
    let providerName = "";

    if (this.calEvent.location && this.calEvent.location.includes("integrations:")) {
      const location = this.calEvent.location.split(":")[1];
      providerName = location[0].toUpperCase() + location.slice(1);
    }

    if (this.calEvent.videoCallData) {
      const meetingId = this.calEvent.videoCallData.id;
      const meetingPassword = this.calEvent.videoCallData.password;
      const meetingUrl = this.calEvent.videoCallData.url;

      return `
      <p style="height: 6px"></p>
      <div style="line-height: 6px;">
        <p style="color: #494949;">${this.calEvent.language("where")}</p>
        <p style="color: #494949; font-weight: 400; line-height: 24px;">${providerName} ${
        meetingUrl &&
        `<a href="${meetingUrl}" target="_blank" alt="${this.calEvent.language(
          "meeting_url"
        )}"><img src="https://i.imgur.com/rKsIBcc.png" width="12px"></img></a>`
      }</p>
        ${
          meetingId &&
          `<div style="color: #494949; font-weight: 400; line-height: 24px;">${this.calEvent.language(
            "meeting_id"
          )}: <span>${meetingId}</span></div>`
        }
        ${
          meetingPassword &&
          `<div style="color: #494949; font-weight: 400; line-height: 24px;">${this.calEvent.language(
            "meeting_password"
          )}: <span>${meetingPassword}</span></div>`
        }
        ${
          meetingUrl &&
          `<div style="color: #494949; font-weight: 400; line-height: 24px;">${this.calEvent.language(
            "meeting_url"
          )}: <a href="${meetingUrl}" alt="${this.calEvent.language(
            "meeting_url"
          )}" style="color: #3E3E3E" target="_blank">${meetingUrl}</a></div>`
        }
      </div>
      `;
    }

    if (this.calEvent.additionInformation?.hangoutLink) {
      const hangoutLink: string = this.calEvent.additionInformation.hangoutLink;

      return `
      <p style="height: 6px"></p>
      <div style="line-height: 6px;">
        <p style="color: #494949;">${this.calEvent.language("where")}</p>
        <p style="color: #494949; font-weight: 400; line-height: 24px;">${
          hangoutLink &&
          `<a href="${hangoutLink}" target="_blank" alt="${this.calEvent.language(
            "meeting_url"
          )}"><img src="https://i.imgur.com/rKsIBcc.png" width="12px"></img></a>`
        }</p>
        <div style="color: #494949; font-weight: 400; line-height: 24px;"><a href="${hangoutLink}" alt="${this.calEvent.language(
        "meeting_url"
      )}" style="color: #3E3E3E" target="_blank">${hangoutLink}</a></div>
      </div>
      `;
    }

    return `
    <p style="height: 6px"></p>
    <div style="line-height: 6px;">
      <p style="color: #494949;">${this.calEvent.language("where")}</p>
      <p style="color: #494949; font-weight: 400; line-height: 24px;">${this.calEvent.location}</p>
    </div>
    `;
  }

  protected getTimezone(): string {
    return this.calEvent.organizer.timeZone;
  }

  protected getOrganizerStart(): Dayjs {
    return dayjs(this.calEvent.startTime).tz(this.getTimezone());
  }

  protected getOrganizerEnd(): Dayjs {
    return dayjs(this.calEvent.endTime).tz(this.getTimezone());
  }
}
