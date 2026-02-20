import type { docketStatusEnum, docketTypeEnum } from "./schema";

export type DocketStatus = (typeof docketStatusEnum.enumValues)[number];
export type DocketType = (typeof docketTypeEnum.enumValues)[number];

/**
 * Normalized ingest record — the contract all import sources must conform to.
 * Fields are snake_case to match CSV column headers directly.
 */
export type IngestDocket = {
  case_number: string;            // required, used as upsert key
  docket_type: DocketType;        // 'loi'|'con'|'det'|'det_eqt'|'det_asc'
  title: string;
  status: DocketStatus;
  applicant?: string;
  facility_name?: string;
  facility_type?: string;
  county?: string;
  description?: string;
  filing_date?: string;           // ISO date string
  hearing_date?: string;
  decision_date?: string;
  estimated_cost?: number;
  bed_count?: number;
  equipment_type?: string;
  service_type?: string;
  laserfiche_url?: string;
  parent_case_number?: string;    // resolved to parent_docket_id by ingestion service
};
