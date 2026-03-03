import { db } from "./db";
import { dockets, docketEvents, researchDocuments, draftTemplates, caseBriefs } from "@shared/schema";
import { sql } from "drizzle-orm";

export async function seedDatabase() {
  const existingDockets = await db.select().from(dockets).limit(1);
  if (existingDockets.length > 0) return;

  console.log("Seeding database with initial data...");

  const [d1, d2, d3, d4, d5] = await db.insert(dockets).values([
    {
      caseNumber: "CON-2025-001",
      title: "Piedmont Augusta Medical Center - Cardiac Catheterization Lab",
      applicant: "Piedmont Healthcare, Inc.",
      facilityName: "Piedmont Augusta Medical Center",
      facilityType: "Hospital",
      county: "Richmond",
      docketType: "con",
      status: "under_review",
      filingDate: new Date("2025-01-15"),
      description: "Application for establishment of a new cardiac catheterization laboratory with two procedure rooms at the existing Piedmont Augusta Medical Center campus.",
      estimatedCost: "$12,500,000",
      laserficheUrl: "https://weblink.dch.georgia.gov/WebLink/Browse.aspx?startid=63&dbid=1&cr=1",
    },
    {
      caseNumber: "CON-2025-002",
      title: "Sunrise Senior Living - Skilled Nursing Facility",
      applicant: "Sunrise Senior Living of Georgia, LLC",
      facilityName: "Sunrise at Buckhead",
      facilityType: "Skilled Nursing Facility",
      county: "Fulton",
      docketType: "con",
      status: "under_review",
      filingDate: new Date("2025-01-22"),
      hearingDate: new Date("2025-04-15"),
      description: "Application for a new 120-bed skilled nursing facility in the Buckhead area of Atlanta to serve the growing elderly population in North Fulton County.",
      estimatedCost: "$28,000,000",
      laserficheUrl: "https://weblink.dch.georgia.gov/WebLink/Browse.aspx?startid=63&dbid=1&cr=1",
    },
    {
      caseNumber: "CON-2024-047",
      title: "Emory Johns Creek Hospital - MRI Expansion",
      applicant: "Emory Healthcare",
      facilityName: "Emory Johns Creek Hospital",
      facilityType: "Hospital",
      county: "Gwinnett",
      docketType: "con",
      status: "approved",
      filingDate: new Date("2024-09-10"),
      hearingDate: new Date("2024-12-05"),
      decisionDate: new Date("2025-01-20"),
      description: "Application for the addition of one MRI unit at Emory Johns Creek Hospital to address growing diagnostic imaging demand in the northeast Atlanta metropolitan area.",
      estimatedCost: "$3,200,000",
      laserficheUrl: "https://weblink.dch.georgia.gov/WebLink/Browse.aspx?startid=63&dbid=1&cr=1",
    },
    {
      caseNumber: "CON-2025-003",
      title: "WellStar Cobb Hospital - Ambulatory Surgery Center",
      applicant: "WellStar Health System",
      facilityName: "WellStar Cobb Ambulatory Surgery Center",
      facilityType: "Ambulatory Surgery Center",
      county: "Cobb",
      docketType: "con",
      status: "filed",
      filingDate: new Date("2025-02-01"),
      description: "Application for establishment of a new multi-specialty ambulatory surgery center with four operating rooms adjacent to the existing WellStar Cobb Hospital.",
      estimatedCost: "$18,500,000",
      laserficheUrl: "https://weblink.dch.georgia.gov/WebLink/Browse.aspx?startid=63&dbid=1&cr=1",
    },
    {
      caseNumber: "CON-2024-052",
      title: "Navicent Health - Psychiatric Bed Addition",
      applicant: "Atrium Health Navicent",
      facilityName: "Atrium Health Navicent Medical Center",
      facilityType: "Hospital",
      county: "Bibb",
      docketType: "con",
      status: "desk_determination_issued",
      filingDate: new Date("2024-10-15"),
      hearingDate: new Date("2025-01-28"),
      description: "Application to add 30 adult psychiatric beds at the Navicent Medical Center campus in Macon to address critical behavioral health capacity shortages in Central Georgia.",
      estimatedCost: "$8,750,000",
      laserficheUrl: "https://weblink.dch.georgia.gov/WebLink/Browse.aspx?startid=63&dbid=1&cr=1",
    },
  ]).returning();

  await db.insert(docketEvents).values([
    { docketId: d1.id, title: "Application Filed", description: "Initial CON application submitted to DCH.", eventDate: new Date("2025-01-15"), eventType: "filing" },
    { docketId: d1.id, title: "Application Deemed Complete", description: "DCH staff confirmed application meets completeness requirements.", eventDate: new Date("2025-01-29"), eventType: "staff_report" },
    { docketId: d1.id, title: "Staff Review Initiated", description: "Application assigned to review staff for analysis.", eventDate: new Date("2025-02-03"), eventType: "staff_report" },
    { docketId: d2.id, title: "Application Filed", description: "Initial CON application for 120-bed SNF submitted.", eventDate: new Date("2025-01-22"), eventType: "filing" },
    { docketId: d2.id, title: "Opposition Filed", description: "Competing facility filed opposition letter citing bed oversupply.", eventDate: new Date("2025-02-10"), eventType: "public_comment" },
    { docketId: d2.id, title: "Hearing Scheduled", description: "Public hearing set for April 15, 2025 at DCH offices.", eventDate: new Date("2025-02-28"), eventType: "hearing" },
    { docketId: d3.id, title: "Application Filed", description: "CON application for additional MRI unit submitted.", eventDate: new Date("2024-09-10"), eventType: "filing" },
    { docketId: d3.id, title: "Staff Analysis Report Published", description: "DCH staff report recommends approval with conditions.", eventDate: new Date("2024-11-15"), eventType: "staff_report" },
    { docketId: d3.id, title: "Public Hearing Held", description: "No opposition presented at hearing. Applicant testified.", eventDate: new Date("2024-12-05"), eventType: "hearing" },
    { docketId: d3.id, title: "CON Approved", description: "Application approved with condition to implement within 24 months.", eventDate: new Date("2025-01-20"), eventType: "decision" },
    { docketId: d4.id, title: "Application Filed", description: "Initial CON application for ASC submitted to DCH.", eventDate: new Date("2025-02-01"), eventType: "filing" },
    { docketId: d5.id, title: "Application Filed", description: "CON application for psychiatric bed addition submitted.", eventDate: new Date("2024-10-15"), eventType: "filing" },
    { docketId: d5.id, title: "Staff Analysis Complete", description: "Staff analysis supports need for additional psychiatric capacity.", eventDate: new Date("2024-12-20"), eventType: "staff_report" },
    { docketId: d5.id, title: "Public Hearing Held", description: "Multiple community organizations testified in support.", eventDate: new Date("2025-01-28"), eventType: "hearing" },
  ]);

  await db.insert(researchDocuments).values([
    {
      title: "O.C.G.A. § 31-6: Certificate of Need Act",
      category: "Statute",
      description: "The complete text of Georgia's Certificate of Need statute governing healthcare facility construction, expansion, and new services.",
      tags: ["statute", "CON law", "Georgia", "O.C.G.A."],
      sourceUrl: "https://law.justia.com/codes/georgia/title-31/chapter-6/",
      laserficheUrl: "https://weblink.dch.georgia.gov/WebLink/Browse.aspx?startid=63&dbid=1&cr=1",
    },
    {
      title: "DCH Rules Chapter 111-2-2: Certificate of Need",
      category: "Regulation",
      description: "Administrative rules implementing the Georgia Certificate of Need program, including application procedures, review criteria, and hearing processes.",
      tags: ["regulation", "DCH", "rules", "administrative"],
      laserficheUrl: "https://weblink.dch.georgia.gov/WebLink/Browse.aspx?startid=63&dbid=1&cr=1",
    },
    {
      title: "2024 Georgia State Health Plan - CON Component",
      category: "Guidance",
      description: "The annual State Health Plan establishes need projections for healthcare services and facilities subject to CON review in Georgia.",
      tags: ["state health plan", "need methodology", "projections", "2024"],
      laserficheUrl: "https://weblink.dch.georgia.gov/WebLink/Browse.aspx?startid=63&dbid=1&cr=1",
    },
    {
      title: "Piedmont Healthcare v. DCH - CON Appeal Decision",
      category: "Decision",
      description: "Superior Court decision on appeal of DCH's denial of a CON application for cardiac surgery services. Establishes precedent on need methodology review.",
      tags: ["appeal", "court decision", "cardiac surgery", "Piedmont"],
      relatedDocketId: d1.id,
      laserficheUrl: "https://weblink.dch.georgia.gov/WebLink/Browse.aspx?startid=63&dbid=1&cr=1",
    },
    {
      title: "DCH Advisory Opinion: Replacement Equipment Exemption",
      category: "Advisory Opinion",
      description: "DCH advisory opinion clarifying when medical equipment replacement qualifies for the CON exemption under O.C.G.A. § 31-6-47.",
      tags: ["advisory opinion", "exemption", "equipment", "replacement"],
      laserficheUrl: "https://weblink.dch.georgia.gov/WebLink/Browse.aspx?startid=63&dbid=1&cr=1",
    },
    {
      title: "Skilled Nursing Facility Need Methodology Analysis",
      category: "Staff Report",
      description: "Staff analysis of the bed need methodology for skilled nursing facilities in Georgia, including population projections and utilization trends.",
      tags: ["SNF", "need methodology", "bed projections", "utilization"],
      relatedDocketId: d2.id,
      laserficheUrl: "https://weblink.dch.georgia.gov/WebLink/Browse.aspx?startid=63&dbid=1&cr=1",
    },
    {
      title: "Recent CON Decisions Summary - Q4 2024",
      category: "Guidance",
      description: "Summary of all CON decisions issued by DCH during the fourth quarter of 2024, including approvals, denials, and conditions imposed.",
      tags: ["decisions", "summary", "Q4 2024", "quarterly report"],
      laserficheUrl: "https://weblink.dch.georgia.gov/WebLink/Browse.aspx?startid=63&dbid=1&cr=1",
    },
    {
      title: "CON Application Checklist and Requirements",
      category: "Template",
      description: "Comprehensive checklist of all required components for a Georgia CON application, including financial projections, architectural plans, and community benefit documentation.",
      tags: ["checklist", "application", "requirements", "filing"],
      laserficheUrl: "https://weblink.dch.georgia.gov/WebLink/Browse.aspx?startid=63&dbid=1&cr=1",
    },
  ]);

  await db.insert(draftTemplates).values([
    {
      name: "Letter of Intent",
      category: "Application",
      description: "Template for the Letter of Intent required prior to filing a CON application.",
      templateContent: `[FIRM LETTERHEAD]

[Date]

Healthcare Facility Regulation Division
Georgia Department of Community Health
2 Peachtree Street NW, Suite 31-447
Atlanta, Georgia 30303

RE: Letter of Intent to File Certificate of Need Application

Dear Director:

Pursuant to O.C.G.A. § 31-6-40 and DCH Rule 111-2-2-.04, this letter serves as formal notification of the intent of [APPLICANT NAME] to file a Certificate of Need application for the following:

1. PROJECT DESCRIPTION:
[Describe the proposed project in detail]

2. FACILITY:
[Name and address of the facility]

3. COUNTY:
[County where the facility will be located]

4. ESTIMATED PROJECT COST:
[Total estimated project cost]

5. PROPOSED TIMELINE:
[Expected filing date and implementation timeline]

We anticipate filing the formal CON application on or about [DATE]. Please direct any correspondence regarding this matter to the undersigned.

Respectfully submitted,

[ATTORNEY NAME]
[FIRM NAME]
[ADDRESS]
[PHONE/EMAIL]`,
    },
    {
      name: "Opposition Letter",
      category: "Opposition",
      description: "Template for filing opposition to a pending CON application.",
      templateContent: `[FIRM LETTERHEAD]

[Date]

Healthcare Facility Regulation Division
Georgia Department of Community Health
2 Peachtree Street NW, Suite 31-447
Atlanta, Georgia 30303

RE: Opposition to CON Application No. [CASE NUMBER]
    Applicant: [APPLICANT NAME]

Dear Director:

On behalf of [CLIENT NAME], we hereby submit this letter of opposition to the above-referenced Certificate of Need application pursuant to DCH Rule 111-2-2-.07.

I. STANDING

[CLIENT NAME] is an existing healthcare provider operating [FACILITY TYPE] in [COUNTY] County, Georgia, and will be directly affected by the proposed project.

II. GROUNDS FOR OPPOSITION

A. Lack of Need
[Describe why the proposed project is not needed based on the State Health Plan need methodology, existing capacity, and utilization data]

B. Adverse Impact on Existing Providers
[Describe the anticipated adverse impact on existing providers in the service area]

C. Failure to Meet Review Criteria
[Address specific CON review criteria under O.C.G.A. § 31-6-42 that the application fails to satisfy]

III. REQUEST FOR HEARING

[CLIENT NAME] requests a public hearing on this application pursuant to O.C.G.A. § 31-6-43.

IV. CONCLUSION

For the reasons stated above, we respectfully request that the Department deny the application.

Respectfully submitted,

[ATTORNEY NAME]
[FIRM NAME]`,
    },
    {
      name: "Hearing Brief",
      category: "Hearing",
      description: "Template for a pre-hearing brief in a CON proceeding.",
      templateContent: `BEFORE THE DEPARTMENT OF COMMUNITY HEALTH
STATE OF GEORGIA

In the Matter of:

CON Application No. [CASE NUMBER]
[APPLICANT NAME]

PRE-HEARING BRIEF OF [PARTY NAME]

[PARTY NAME], by and through undersigned counsel, respectfully submits this Pre-Hearing Brief.

I. INTRODUCTION

[Brief overview of the case and the party's position]

II. STATEMENT OF FACTS

[Detailed factual background relevant to the application]

III. APPLICABLE LAW AND REVIEW CRITERIA

The Department must evaluate CON applications against the criteria set forth in O.C.G.A. § 31-6-42, including:

A. Whether the proposed project is consistent with the State Health Plan;
B. Whether the project will promote accessibility to needed services;
C. Whether the project meets quality of care standards;
D. Whether the project promotes cost containment; and
E. Whether the applicant demonstrates financial feasibility.

IV. ARGUMENT

A. [First Major Argument]

B. [Second Major Argument]

C. [Third Major Argument]

V. CONCLUSION

For the foregoing reasons, [PARTY NAME] respectfully requests [approval/denial] of the application.

Respectfully submitted,

[ATTORNEY NAME]
[FIRM NAME]
[ADDRESS]
[PHONE/EMAIL]
[DATE]`,
    },
    {
      name: "CON Application Narrative",
      category: "Application",
      description: "Template for the narrative portion of a CON application addressing all review criteria.",
      templateContent: `CERTIFICATE OF NEED APPLICATION NARRATIVE

APPLICATION NO.: [TO BE ASSIGNED]
APPLICANT: [APPLICANT NAME]
PROJECT: [PROJECT DESCRIPTION]

SECTION I: PROJECT DESCRIPTION AND RATIONALE

[Comprehensive description of the proposed project, including scope, timeline, and justification]

SECTION II: CONSISTENCY WITH STATE HEALTH PLAN

[Analysis demonstrating how the project aligns with the current State Health Plan need methodology and projections]

SECTION III: NEED AND ACCESSIBILITY

A. Population-Based Need
[Demonstrate need using demographic data, population projections, and utilization trends]

B. Geographic Access
[Address geographic accessibility for the target population]

C. Service Area Analysis
[Define and analyze the proposed service area]

SECTION IV: QUALITY OF CARE

[Address quality standards, staffing plans, accreditation, and outcome measurement]

SECTION V: COST CONTAINMENT

[Demonstrate how the project promotes cost containment and healthcare affordability]

SECTION VI: FINANCIAL FEASIBILITY

A. Capital Budget
[Detailed project cost breakdown]

B. Revenue Projections
[Three-year revenue projections with assumptions]

C. Funding Sources
[Identify sources of project financing]

SECTION VII: IMPACT ON EXISTING PROVIDERS

[Address potential impact on existing healthcare providers in the service area]

SECTION VIII: COMMUNITY BENEFIT

[Describe charity care commitments, community outreach, and other public benefits]`,
    },
  ]);

  await db.insert(caseBriefs).values([
    {
      docketId: d3.id,
      summary: "Emory Healthcare seeks to add one MRI unit at Emory Johns Creek Hospital in Gwinnett County, Georgia. The application (CON-2024-047) was filed on September 10, 2024, with a total estimated project cost of $3,200,000. The project aims to address growing diagnostic imaging demand in the northeast Atlanta metropolitan area. Following staff review and a public hearing on December 5, 2024, the application was approved on January 20, 2025, with a condition requiring implementation within 24 months. No opposition was presented at the hearing.",
      decisionIssues: "The primary issues evaluated at the decision level include:\n\n1. **Need for Additional MRI Capacity**: The Department assessed whether existing MRI capacity in the Gwinnett County service area was insufficient to meet current and projected demand. Emory Johns Creek Hospital demonstrated increased utilization rates exceeding 80% on its existing units, supporting the need for additional capacity under the State Health Plan methodology.\n\n2. **Accessibility**: The application demonstrated that adding an MRI unit would reduce patient wait times and improve timely access to diagnostic imaging services, particularly for emergency and oncology patients requiring urgent scans.\n\n3. **Quality of Care**: The applicant presented evidence of its existing accreditation and quality metrics, demonstrating capability to maintain high standards with the additional unit.\n\n4. **Cost Containment**: At $3.2 million, the project represents a relatively modest capital investment. The applicant showed that keeping patients within the Emory Johns Creek system rather than transferring them to other facilities would reduce overall healthcare costs.\n\n5. **Financial Feasibility**: Emory Healthcare provided three-year financial projections demonstrating the additional MRI unit would achieve operational sustainability within 18 months based on projected volume.",
      appellateIssues: "Although the application was approved, potential appellate issues include:\n\n1. **Need Methodology Challenge**: A competing facility could challenge the need methodology used by DCH staff, arguing that the existing MRI capacity in the broader service area (including facilities in nearby counties) was already adequate.\n\n2. **Implementation Condition**: The 24-month implementation condition could be challenged if circumstances change. Under O.C.G.A. § 31-6-44.1, conditions imposed on CON approvals must be reasonably related to the project.\n\n3. **Standing of Potential Opponents**: Any affected healthcare provider that did not participate in the hearing process may face standing challenges under O.C.G.A. § 31-6-44 if they later seek to appeal.\n\n4. **Standard of Review**: On appeal, the reviewing court would apply the \"any evidence\" standard to DCH's factual findings, making it difficult for appellants to overturn the approval on need-based grounds.",
      judicialReview: "Judicial review of this CON decision is available under O.C.G.A. § 31-6-44.1 and the Georgia Administrative Procedure Act (O.C.G.A. § 50-13-19).\n\n1. **Venue**: Any petition for judicial review must be filed in the Superior Court of Fulton County, as DCH is headquartered in Atlanta.\n\n2. **Timing**: A petition for review must be filed within 30 days of the final agency decision, pursuant to O.C.G.A. § 50-13-19(b).\n\n3. **Scope of Review**: The court reviews the agency record to determine whether the decision was supported by substantial evidence, was made in accordance with proper procedures, and was not arbitrary or capricious.\n\n4. **Burden of Proof**: The party challenging the DCH decision bears the burden of demonstrating that the decision was erroneous.\n\n5. **Relevant Precedent**: Georgia courts have generally deferred to DCH's expertise in applying need methodology, making successful judicial challenges to approved CON applications uncommon absent clear procedural errors.",
    },
    {
      docketId: d5.id,
      summary: "Atrium Health Navicent has applied to add 30 adult psychiatric beds at the Navicent Medical Center campus in Macon, Bibb County. The application (CON-2024-052) was filed on October 15, 2024, with an estimated project cost of $8,750,000. The project addresses critical behavioral health capacity shortages in Central Georgia. Staff analysis was completed in December 2024, supporting the identified need. A public hearing was held on January 28, 2025, where multiple community organizations testified in support. The decision is currently pending.",
      decisionIssues: "The DCH must evaluate the following primary issues:\n\n1. **Behavioral Health Need**: Georgia faces a well-documented shortage of psychiatric beds, particularly in rural and semi-rural areas. The application must demonstrate that the Central Georgia service area has insufficient psychiatric bed capacity relative to the State Health Plan bed need methodology.\n\n2. **Accessibility and Underserved Populations**: The application should address how adding psychiatric beds in Bibb County will improve access for underserved populations, including Medicaid recipients and uninsured patients who currently face extended emergency department boarding while awaiting psychiatric placement.\n\n3. **Quality of Care**: The Department must assess whether Navicent has the clinical infrastructure, staffing plans, and specialized training programs necessary to provide high-quality psychiatric care, including suicide prevention protocols and evidence-based treatment modalities.\n\n4. **Cost Containment**: The applicant should demonstrate that adding dedicated psychiatric beds will reduce the more expensive practice of boarding psychiatric patients in general medical-surgical beds and emergency departments.\n\n5. **Financial Feasibility**: Given the historically lower reimbursement rates for psychiatric services, the Department must carefully evaluate whether the proposed unit is financially sustainable, particularly with the payer mix typical of behavioral health patients in Central Georgia.",
      appellateIssues: "Regardless of the decision, the following appellate issues may arise:\n\n1. **Bed Need Methodology**: If denied, the applicant could challenge the Department's application of the psychiatric bed need methodology, arguing that emergency department psychiatric boarding data should be factored into need calculations.\n\n2. **Community Testimony Weight**: The significant community support demonstrated at the hearing creates a record that could support an appeal if the application is denied despite broad stakeholder endorsement.\n\n3. **Access to Care Arguments**: Constitutional and statutory arguments regarding access to care for individuals with mental illness could be raised under both state and federal disability laws.\n\n4. **Competing Applications**: If multiple behavioral health applications are pending in the same service area, the Department's comparative review process could be subject to challenge.\n\n5. **Conditions of Approval**: If approved with restrictive conditions (e.g., minimum Medicaid acceptance ratios), the applicant could appeal those conditions as exceeding the Department's statutory authority.",
      judicialReview: "The judicial review process for this case would proceed as follows:\n\n1. **Administrative Appeal**: Prior to judicial review, any aggrieved party must exhaust administrative remedies, including filing a request for reconsideration with DCH within the prescribed timeframe.\n\n2. **Venue and Filing**: Judicial review must be sought in the Superior Court of Fulton County within 30 days of the final administrative decision under O.C.G.A. § 50-13-19.\n\n3. **Record on Review**: The court reviews the complete administrative record, including the application, staff reports, hearing testimony, and the Department's written decision.\n\n4. **Standard of Review**: The court applies a deferential standard, examining whether DCH's decision was supported by \"any evidence\" in the record. However, questions of law (such as statutory interpretation of O.C.G.A. § 31-6) are reviewed de novo.\n\n5. **Special Considerations**: Given the strong public health component of this application and the documented behavioral health crisis in Georgia, the court may give particular weight to DCH's public health expertise and the community testimony supporting the project.\n\n6. **Timeline**: Judicial review proceedings typically take 6-12 months, during which the CON decision remains in effect unless stayed by the court.",
    },
  ]);

  console.log("Database seeded successfully!");
}
