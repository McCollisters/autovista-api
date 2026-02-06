import fs from "node:fs/promises";
import path from "node:path";
import { DateTime } from "luxon";
import { logger } from "@/core/logger";
import { getNotificationManager } from "@/notification";
import {
  buildPortalMonthlyReport,
  getPortalMonthlyReportFilename,
  PortalMonthlyReportDateField,
} from "@/order/reports/portalMonthlyReport";

const DEFAULT_PORTAL_ID = "69664e5968d3227b9d6860c6";
const DEFAULT_RECIPIENTS = ["anna@periscopeworks.io"];
const REPORT_TIMEZONE = "America/New_York";
const DEFAULT_DATE_FIELD: PortalMonthlyReportDateField = "createdAt";

interface PortalMonthlyReportJobOptions {
  portalIdOrName?: string;
  recipients?: string[];
  month?: DateTime;
  dateField?: PortalMonthlyReportDateField;
}

export async function sendPortalMonthlyReport(
  options: PortalMonthlyReportJobOptions = {},
): Promise<void> {
  const portalIdOrName = options.portalIdOrName || DEFAULT_PORTAL_ID;
  const recipients = options.recipients?.length
    ? options.recipients
    : DEFAULT_RECIPIENTS;
  const dateField = options.dateField || DEFAULT_DATE_FIELD;

  const nowEastern = DateTime.now().setZone(REPORT_TIMEZONE);
  const reportMonthBase = options.month || nowEastern.plus({ months: 1 });
  const reportMonth = DateTime.fromObject(
    {
      year: reportMonthBase.year,
      month: reportMonthBase.month,
      day: 1,
    },
    { zone: "utc" },
  );

  const report = await buildPortalMonthlyReport({
    portalIdOrName,
    month: reportMonth,
    dateField,
  });

  const filename = getPortalMonthlyReportFilename(
    report.portal.companyName,
    report.monthLabel,
  );
  const outputDir = path.join(process.cwd(), "reports");
  const outputPath = path.join(outputDir, filename);

  await fs.mkdir(outputDir, { recursive: true });
  await fs.writeFile(outputPath, report.csvString, "utf-8");

  const notificationManager = getNotificationManager();
  const subject = `Monthly Portal Report - ${report.portal.companyName} - ${report.monthLabel}`;
  const text = `Attached is the monthly portal report for ${report.portal.companyName} (${report.monthLabel}). Orders are filtered by ${dateField}.`;
  const html = `<p>Attached is the monthly portal report for <strong>${report.portal.companyName}</strong> (${report.monthLabel}).</p><p>Orders are filtered by <strong>${dateField}</strong>.</p>`;

  const emailResult = await notificationManager.sendEmail({
    to: recipients,
    subject,
    text,
    html,
    templateName: "Portal Monthly Report",
    attachments: [
      {
        filename,
        content: Buffer.from(report.csvString),
        contentType: "text/csv",
      },
    ],
  });

  if (!emailResult.success) {
    logger.error("Portal monthly report email failed", {
      portal: report.portal.companyName,
      month: report.monthLabel,
      recipients,
      error: emailResult.error,
    });
    return;
  }

  logger.info("Portal monthly report emailed", {
    portal: report.portal.companyName,
    month: report.monthLabel,
    recipients,
    outputPath,
    orders: report.ordersCount,
  });
}
