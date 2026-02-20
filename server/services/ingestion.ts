import type { IStorage } from "../storage";
import type { IngestDocket } from "@shared/types";
import type { InsertDocket } from "@shared/schema";

export interface ImportJobResult {
  jobId: number;
  totalRecords: number;
  createdRecords: number;
  updatedRecords: number;
  skippedRecords: number;
  failedRecords: number;
  status: "completed" | "failed";
}

export class IngestionService {
  constructor(private storage: IStorage) {}

  async processJob(
    jobId: number,
    records: { data: IngestDocket; rowNumber: number }[],
    createdBy: string,
  ): Promise<ImportJobResult> {
    let createdRecords = 0;
    let updatedRecords = 0;
    let skippedRecords = 0;
    let failedRecords = 0;

    // Mark job as running
    await this.storage.updateImportJob(jobId, {
      status: "running",
      startedAt: new Date(),
      totalRecords: records.length,
    });

    for (let i = 0; i < records.length; i++) {
      const { data: record, rowNumber } = records[i];

      try {
        // Resolve parent_case_number to parent_docket_id
        let parentDocketId: number | null = null;
        if (record.parent_case_number) {
          const parent = await this.storage.getDocketByCaseNumber(record.parent_case_number);
          if (parent) {
            parentDocketId = parent.id;
          }
        }

        // Check if docket with this case_number already exists
        const existing = await this.storage.getDocketByCaseNumber(record.case_number);

        if (existing) {
          // Update: only overwrite fields present in the IngestDocket
          const updateData: Partial<InsertDocket> = {};

          if (record.title !== undefined) updateData.title = record.title;
          if (record.status !== undefined) updateData.status = record.status;
          if (record.docket_type !== undefined) updateData.docketType = record.docket_type;
          if (record.applicant !== undefined) updateData.applicant = record.applicant;
          if (record.facility_name !== undefined) updateData.facilityName = record.facility_name;
          if (record.facility_type !== undefined) updateData.facilityType = record.facility_type;
          if (record.county !== undefined) updateData.county = record.county;
          if (record.description !== undefined) updateData.description = record.description;
          if (record.filing_date !== undefined) updateData.filingDate = new Date(record.filing_date);
          if (record.hearing_date !== undefined) updateData.hearingDate = new Date(record.hearing_date);
          if (record.decision_date !== undefined) updateData.decisionDate = new Date(record.decision_date);
          if (record.estimated_cost !== undefined) updateData.estimatedCost = String(record.estimated_cost);
          if (record.bed_count !== undefined) updateData.bedCount = record.bed_count;
          if (record.equipment_type !== undefined) updateData.equipmentType = record.equipment_type;
          if (record.service_type !== undefined) updateData.serviceType = record.service_type;
          if (record.laserfiche_url !== undefined) updateData.laserficheUrl = record.laserfiche_url;
          if (parentDocketId !== null) updateData.parentDocketId = parentDocketId;

          await this.storage.updateDocket(existing.id, updateData);
          updatedRecords++;

          await this.storage.createImportRecord({
            jobId,
            rowNumber,
            caseNumber: record.case_number,
            action: "updated",
            rawData: record as unknown as Record<string, unknown>,
          });
        } else {
          // Create new docket
          const newDocket: InsertDocket = {
            caseNumber: record.case_number,
            docketType: record.docket_type,
            title: record.title,
            status: record.status,
            applicant: record.applicant || "Unknown",
            facilityName: record.facility_name || "Unknown",
            facilityType: record.facility_type || "Unknown",
            county: record.county || "Unknown",
            description: record.description || null,
            filingDate: record.filing_date ? new Date(record.filing_date) : new Date(),
            hearingDate: record.hearing_date ? new Date(record.hearing_date) : null,
            decisionDate: record.decision_date ? new Date(record.decision_date) : null,
            estimatedCost: record.estimated_cost != null ? String(record.estimated_cost) : null,
            bedCount: record.bed_count ?? null,
            equipmentType: record.equipment_type || null,
            serviceType: record.service_type || null,
            laserficheUrl: record.laserfiche_url || null,
            parentDocketId: parentDocketId,
          };

          await this.storage.createDocket(newDocket);
          createdRecords++;

          await this.storage.createImportRecord({
            jobId,
            rowNumber,
            caseNumber: record.case_number,
            action: "created",
            rawData: record as unknown as Record<string, unknown>,
          });
        }
      } catch (error: any) {
        failedRecords++;
        await this.storage.createImportRecord({
          jobId,
          rowNumber,
          caseNumber: record.case_number || null,
          action: "failed",
          errorMessage: error.message || String(error),
          rawData: record as unknown as Record<string, unknown>,
        });
      }
    }

    const allFailed = failedRecords === records.length && records.length > 0;
    const status = allFailed ? "failed" : "completed";

    await this.storage.updateImportJob(jobId, {
      status,
      completedAt: new Date(),
      totalRecords: records.length,
      createdRecords,
      updatedRecords,
      skippedRecords,
      failedRecords,
      ...(allFailed ? { errorMessage: "All records failed to process" } : {}),
    });

    return {
      jobId,
      totalRecords: records.length,
      createdRecords,
      updatedRecords,
      skippedRecords,
      failedRecords,
      status,
    };
  }
}
