/**
 * Parser for Georgia DCH CON Tracking Report PDFs.
 *
 * The tracking report is published weekly by the Georgia Department of Community Health
 * and contains sections covering Letters of Intent, new CON applications,
 * approved/denied/withdrawn decisions, DET-EQT requests, DET-ASC requests, etc.
 *
 * This is a best-effort parser: unparseable entries are logged as warnings
 * rather than causing failures.
 */

// @ts-ignore - pdf-parse doesn't have proper ESM types
import pdfParse from "pdf-parse";
import { db } from "../db";
import {
  proceedings,
  proceedingEvents,
  trackingReportImports,
  type InsertProceeding,
} from "@shared/schema";
import { eq } from "drizzle-orm";

// ===================== Types =====================

export interface ParsedEntry {
  caseNumber: string;
  proceedingType: "con" | "det" | "det_eqt" | "det_asc";
  status: string;
  applicant: string;
  facilityName: string;
  county: string;
  filingDate?: Date;
  description?: string;
  /** Which section of the tracking report this entry came from. */
  section: string;
}

export interface ParsedTrackingReport {
  reportDate: Date;
  entries: ParsedEntry[];
}

// ===================== Section Definitions =====================

interface SectionDef {
  pattern: RegExp;
  name: string;
  status: string;
  proceedingType: "con" | "det" | "det_eqt" | "det_asc";
}

const SECTION_DEFS: SectionDef[] = [
  {
    pattern: /letters?\s+of\s+intent/i,
    name: "Letters of Intent",
    status: "loi_filed",
    proceedingType: "con",
  },
  {
    pattern: /new\s+con\s+applications?/i,
    name: "New CON Applications",
    status: "application_filed",
    proceedingType: "con",
  },
  {
    pattern: /applications?\s+under\s+review/i,
    name: "Applications Under Review",
    status: "under_review",
    proceedingType: "con",
  },
  {
    pattern: /approved/i,
    name: "Approved",
    status: "approved",
    proceedingType: "con",
  },
  {
    pattern: /denied/i,
    name: "Denied",
    status: "denied",
    proceedingType: "con",
  },
  {
    pattern: /withdrawn/i,
    name: "Withdrawn",
    status: "withdrawn",
    proceedingType: "con",
  },
  {
    pattern: /requests?\s+for\s+det[- ]?eqt/i,
    name: "Requests for DET-EQT",
    status: "request_filed",
    proceedingType: "det_eqt",
  },
  {
    pattern: /requests?\s+for\s+det[- ]?asc/i,
    name: "Requests for DET-ASC",
    status: "request_filed",
    proceedingType: "det_asc",
  },
  {
    pattern: /determinations?\s+issued/i,
    name: "Determinations Issued",
    status: "determination_issued",
    proceedingType: "det",
  },
  {
    pattern: /appeals?/i,
    name: "Appeals",
    status: "appeal_filed",
    proceedingType: "con",
  },
  {
    pattern: /pending\s+decision/i,
    name: "Pending Decision",
    status: "pending_decision",
    proceedingType: "con",
  },
  {
    pattern: /incomplete/i,
    name: "Incomplete",
    status: "incomplete",
    proceedingType: "con",
  },
];

// ===================== Case Number Patterns =====================

/**
 * Matches known Georgia DCH case number formats:
 *   CON-XXXX-XXX    (e.g., CON-2024-001)
 *   CON20XXXXX       (e.g., CON2024001)
 *   DET-EQTXXXXXXX  (e.g., DET-EQT2024001)
 *   DET-ASCXXXXXXX  (e.g., DET-ASC2024001)
 */
const CASE_NUMBER_REGEX =
  /\b(CON-?\d{4}-?\d{2,5}|CON\d{7,9}|DET-?EQT\d{5,9}|DET-?ASC\d{5,9})\b/gi;

// ===================== Date Parsing =====================

const DATE_PATTERNS = [
  // "January 15, 2024" or "Jan 15, 2024"
  /\b(\w+)\s+(\d{1,2}),?\s+(\d{4})\b/,
  // "01/15/2024" or "1/15/2024"
  /\b(\d{1,2})\/(\d{1,2})\/(\d{4})\b/,
  // "2024-01-15"
  /\b(\d{4})-(\d{2})-(\d{2})\b/,
];

function tryParseDate(text: string): Date | undefined {
  // Try MM/DD/YYYY
  const slashMatch = text.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (slashMatch) {
    const d = new Date(
      parseInt(slashMatch[3]),
      parseInt(slashMatch[1]) - 1,
      parseInt(slashMatch[2])
    );
    if (!isNaN(d.getTime())) return d;
  }

  // Try ISO format
  const isoMatch = text.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) {
    const d = new Date(isoMatch[0]);
    if (!isNaN(d.getTime())) return d;
  }

  // Try "Month DD, YYYY"
  const longMatch = text.match(
    /\b(January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{1,2}),?\s+(\d{4})\b/i
  );
  if (longMatch) {
    const d = new Date(`${longMatch[1]} ${longMatch[2]}, ${longMatch[3]}`);
    if (!isNaN(d.getTime())) return d;
  }

  return undefined;
}

// ===================== Report Date Extraction =====================

function extractReportDate(text: string): Date {
  // Look for a date near the top of the document, typically after "Tracking Report" or "Report Date"
  const headerBlock = text.substring(0, 1500);

  const reportDateMatch = headerBlock.match(
    /(?:report\s+date|as\s+of|dated?|week\s+(?:of|ending))[:\s]*([^\n]{8,30})/i
  );
  if (reportDateMatch) {
    const d = tryParseDate(reportDateMatch[1]);
    if (d) return d;
  }

  // Fallback: find any date in the first 1500 chars
  const d = tryParseDate(headerBlock);
  if (d) return d;

  // Last resort: use current date
  console.warn(
    "Could not extract report date from tracking report; defaulting to today."
  );
  return new Date();
}

// ===================== Section Splitting =====================

interface TextSection {
  def: SectionDef;
  content: string;
}

function splitIntoSections(text: string): TextSection[] {
  const sections: TextSection[] = [];

  // Build an array of (position, sectionDef) for each section header found
  const found: Array<{ index: number; def: SectionDef }> = [];

  for (const def of SECTION_DEFS) {
    // Search for section headers; they are typically on their own line
    const lineRegex = new RegExp(`^.*${def.pattern.source}.*$`, "gim");
    let match: RegExpExecArray | null;
    while ((match = lineRegex.exec(text)) !== null) {
      found.push({ index: match.index, def });
    }
  }

  // Sort by position
  found.sort((a, b) => a.index - b.index);

  // Extract content between each section header and the next
  for (let i = 0; i < found.length; i++) {
    const start = found[i].index;
    const end = i + 1 < found.length ? found[i + 1].index : text.length;
    const content = text.substring(start, end);
    sections.push({ def: found[i].def, content });
  }

  return sections;
}

// ===================== Entry Parsing =====================

function inferProceedingType(
  caseNumber: string,
  sectionDefault: "con" | "det" | "det_eqt" | "det_asc"
): "con" | "det" | "det_eqt" | "det_asc" {
  const upper = caseNumber.toUpperCase();
  if (upper.startsWith("DET-EQT") || upper.startsWith("DETEQT")) return "det_eqt";
  if (upper.startsWith("DET-ASC") || upper.startsWith("DETASC")) return "det_asc";
  if (upper.startsWith("DET")) return "det";
  if (upper.startsWith("CON")) return "con";
  return sectionDefault;
}

function parseEntriesFromSection(section: TextSection): ParsedEntry[] {
  const entries: ParsedEntry[] = [];
  const lines = section.content.split("\n");

  // Find all case numbers in the section content
  let currentEntry: Partial<ParsedEntry> | null = null;
  let accumulatedText = "";

  for (const line of lines) {
    const caseMatch = line.match(CASE_NUMBER_REGEX);

    if (caseMatch) {
      // Flush previous entry
      if (currentEntry?.caseNumber) {
        finalizeEntry(currentEntry, accumulatedText, section, entries);
      }

      currentEntry = {
        caseNumber: normalizeCaseNumber(caseMatch[0]),
        proceedingType: inferProceedingType(caseMatch[0], section.def.proceedingType),
        status: section.def.status,
        section: section.def.name,
      };
      accumulatedText = line;
    } else if (currentEntry) {
      accumulatedText += " " + line.trim();
    }
  }

  // Flush last entry
  if (currentEntry?.caseNumber) {
    finalizeEntry(currentEntry, accumulatedText, section, entries);
  }

  return entries;
}

function normalizeCaseNumber(raw: string): string {
  // Normalize to uppercase, preserve hyphens
  return raw.toUpperCase().trim();
}

function finalizeEntry(
  partial: Partial<ParsedEntry>,
  text: string,
  section: TextSection,
  entries: ParsedEntry[]
): void {
  try {
    // Extract applicant and facility from the text block.
    // Common formats in tracking reports:
    //   "CON-2024-001 - Acme Health - Acme Hospital - Fulton County - MRI Equipment"
    //   "CON-2024-001   Applicant: Acme Health   Facility: Acme Hospital   County: Fulton"
    const cleaned = text.replace(/\s+/g, " ").trim();

    let applicant = "Unknown Applicant";
    let facilityName = "Unknown Facility";
    let county = "Unknown";
    let description: string | undefined;
    let filingDate: Date | undefined;

    // Try labeled format first
    const applicantMatch = cleaned.match(/applicant[:\s]+([^,\n]+?)(?=\s*(?:facility|county|$))/i);
    const facilityMatch = cleaned.match(/facility[:\s]+([^,\n]+?)(?=\s*(?:county|applicant|$))/i);
    const countyMatch = cleaned.match(/county[:\s]+([^,\n]+?)(?=\s*(?:facility|applicant|date|$))/i);

    if (applicantMatch) applicant = applicantMatch[1].trim();
    if (facilityMatch) facilityName = facilityMatch[1].trim();
    if (countyMatch) county = countyMatch[1].trim();

    // If no labeled format, try dash-separated format
    if (!applicantMatch && !facilityMatch) {
      // Remove the case number from the text, then split by " - "
      const withoutCase = cleaned
        .replace(CASE_NUMBER_REGEX, "")
        .replace(/^\s*[-:]\s*/, "")
        .trim();
      const parts = withoutCase.split(/\s+-\s+/).map((p) => p.trim()).filter(Boolean);

      if (parts.length >= 1) applicant = parts[0];
      if (parts.length >= 2) facilityName = parts[1];
      if (parts.length >= 3) {
        // Check if any part looks like a county
        const countyPart = parts.find((p) => /county/i.test(p));
        if (countyPart) {
          county = countyPart.replace(/\s*county\s*/i, "").trim() || countyPart;
        } else {
          county = parts[2];
        }
      }
      if (parts.length >= 4) {
        description = parts.slice(3).join(" - ");
      }
    }

    // Try to extract a filing date from the text
    filingDate = tryParseDate(cleaned);

    entries.push({
      caseNumber: partial.caseNumber!,
      proceedingType: partial.proceedingType ?? section.def.proceedingType,
      status: partial.status ?? section.def.status,
      applicant,
      facilityName,
      county,
      filingDate,
      description: description ?? undefined,
      section: partial.section ?? section.def.name,
    });
  } catch (error) {
    console.warn(
      `Could not parse tracking report entry for case ${partial.caseNumber}:`,
      error
    );
  }
}

// ===================== Main Parser =====================

/**
 * Parse a Georgia DCH CON Tracking Report PDF into structured data.
 *
 * @param pdfBuffer - The raw PDF file as a Buffer.
 * @returns Parsed tracking report with date and structured entries.
 */
export async function parseTrackingReport(
  pdfBuffer: Buffer
): Promise<ParsedTrackingReport> {
  const pdfData = await pdfParse(pdfBuffer);
  const text = pdfData.text;

  const reportDate = extractReportDate(text);
  const sections = splitIntoSections(text);

  const entries: ParsedEntry[] = [];
  for (const section of sections) {
    try {
      const sectionEntries = parseEntriesFromSection(section);
      entries.push(...sectionEntries);
    } catch (error) {
      console.warn(
        `Error parsing section "${section.def.name}":`,
        error
      );
    }
  }

  // Also try to catch case numbers that appeared outside recognized sections
  const allCaseNumbers = new Set(entries.map((e) => e.caseNumber));
  let orphanMatch: RegExpExecArray | null;
  const orphanRegex = new RegExp(CASE_NUMBER_REGEX.source, "gi");
  while ((orphanMatch = orphanRegex.exec(text)) !== null) {
    const normalized = normalizeCaseNumber(orphanMatch[0]);
    if (!allCaseNumbers.has(normalized)) {
      console.warn(
        `Found case number ${normalized} outside any recognized section; skipping.`
      );
    }
  }

  console.log(
    `Parsed tracking report dated ${reportDate.toISOString().split("T")[0]}: ` +
      `${entries.length} entries across ${sections.length} sections.`
  );

  return { reportDate, entries };
}

// ===================== Database Application =====================

/**
 * Status mapping from tracking report status strings to the schema's proceedingStatusEnum values.
 */
const STATUS_MAP: Record<string, InsertProceeding["status"]> = {
  loi_filed: "loi_filed",
  application_filed: "application_filed",
  under_review: "under_review",
  incomplete: "incomplete",
  pending_decision: "pending_decision",
  approved: "approved",
  denied: "denied",
  withdrawn: "withdrawn",
  request_filed: "request_filed",
  determination_issued: "determination_issued",
  appeal_filed: "appeal_filed",
};

/**
 * Apply parsed tracking report data to the database.
 *
 * - Creates new proceedings for case numbers not already in the database.
 * - Updates status for existing proceedings whose status has changed.
 * - Creates proceeding events for status changes.
 *
 * @returns Counts of created and updated proceedings.
 */
export async function applyTrackingReportToDatabase(
  parsed: ParsedTrackingReport
): Promise<{ created: number; updated: number }> {
  let created = 0;
  let updated = 0;

  for (const entry of parsed.entries) {
    try {
      const mappedStatus = STATUS_MAP[entry.status] ?? "loi_filed";

      // Check if proceeding already exists
      const [existing] = await db
        .select()
        .from(proceedings)
        .where(eq(proceedings.caseNumber, entry.caseNumber))
        .limit(1);

      if (existing) {
        // Update if status changed
        if (existing.status !== mappedStatus) {
          const oldStatus = existing.status;

          await db
            .update(proceedings)
            .set({
              status: mappedStatus,
              updatedAt: new Date(),
            })
            .where(eq(proceedings.id, existing.id));

          // Create a status change event
          await db.insert(proceedingEvents).values({
            proceedingId: existing.id,
            title: `Status changed: ${oldStatus} -> ${mappedStatus}`,
            description: `Updated from tracking report dated ${parsed.reportDate.toISOString().split("T")[0]}. Section: ${entry.section}.`,
            eventDate: parsed.reportDate,
            eventType: "status_change",
            source: "tracking_report",
          });

          updated++;
        }
      } else {
        // Create new proceeding
        const title = `${entry.caseNumber} - ${entry.facilityName}`;

        const [newProceeding] = await db
          .insert(proceedings)
          .values({
            caseNumber: entry.caseNumber,
            proceedingType: entry.proceedingType,
            status: mappedStatus,
            title,
            applicant: entry.applicant,
            facilityName: entry.facilityName,
            facilityType: "Unknown", // Tracking report may not include this
            county: entry.county,
            filingDate: entry.filingDate ?? parsed.reportDate,
            description: entry.description ?? null,
            syncStatus: "metadata_only",
            lastSyncedAt: new Date(),
          })
          .returning();

        // Create initial event
        await db.insert(proceedingEvents).values({
          proceedingId: newProceeding.id,
          title: `Imported from tracking report`,
          description: `First seen in tracking report dated ${parsed.reportDate.toISOString().split("T")[0]}. Section: ${entry.section}. Status: ${mappedStatus}.`,
          eventDate: parsed.reportDate,
          eventType: "import",
          source: "tracking_report",
        });

        created++;
      }
    } catch (error) {
      console.warn(
        `Failed to apply tracking report entry for case ${entry.caseNumber}:`,
        error
      );
    }
  }

  // Record the import
  try {
    await db.insert(trackingReportImports).values({
      reportDate: parsed.reportDate,
      filename: `tracking_report_${parsed.reportDate.toISOString().split("T")[0]}.pdf`,
      recordsCreated: created,
      recordsUpdated: updated,
    });
  } catch (error) {
    console.warn("Failed to record tracking report import:", error);
  }

  console.log(
    `Tracking report applied: ${created} created, ${updated} updated.`
  );

  return { created, updated };
}
