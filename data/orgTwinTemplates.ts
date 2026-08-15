import type { OrgUnit } from '../types/org';

export type OrgTwinTemplateId = 'pharma' | 'staffing';

export type OrgTwinScenario = {
  id: string;
  label: string;
  colorClass: string;
  description: string;
};

export type OrgTwinTemplate = {
  id: OrgTwinTemplateId;
  label: string;
  description: string;
  orgTree: OrgUnit;
  kpis: {
    totalLabel: string;
    primaryLabel: string;
    scenarioLabel: string;
  };
  scenarios: OrgTwinScenario[];
};

// Existing Merck-style (Pharma) org tree lives in `data/orgStructure.ts`.
// We re-import it in `OrgTwinService` to keep this file focused on templates.

export const STAFFING_ORG_TREE: OrgUnit = {
  id: 'randstad_global',
  name: 'Randstad Talent Operations',
  type: 'GLOBAL',
  headcount: 6500,
  children: [
    {
      id: 'region_central_europe',
      name: 'Region: Central Europe',
      type: 'REGION',
      headcount: 1400,
      children: [
        {
          id: 'country_hungary',
          name: 'Hungary',
          type: 'BU',
          location: 'Hungary',
          headcount: 420,
          parentId: 'region_central_europe',
          children: [
            {
              id: 'branch_budapest',
              name: 'Branch: Budapest',
              type: 'SITE',
              location: 'Budapest, Hungary',
              headcount: 180,
              parentId: 'country_hungary',
              children: [
                { id: 'team_it_bud', name: 'IT & Engineering Desk', type: 'TEAM', headcount: 45, parentId: 'branch_budapest' },
                { id: 'team_ops_bud', name: 'Operations & Logistics Desk', type: 'TEAM', headcount: 35, parentId: 'branch_budapest' },
                { id: 'team_hr_bud', name: 'HR & Finance Desk', type: 'TEAM', headcount: 25, parentId: 'branch_budapest' }
              ]
            },
            {
              id: 'branch_debrecen',
              name: 'Branch: Debrecen',
              type: 'SITE',
              location: 'Debrecen, Hungary',
              headcount: 120,
              parentId: 'country_hungary',
              children: [
                { id: 'team_contact_deb', name: 'Customer Support Desk', type: 'TEAM', headcount: 30, parentId: 'branch_debrecen' },
                { id: 'team_marketing_deb', name: 'Marketing & Sales Desk', type: 'TEAM', headcount: 20, parentId: 'branch_debrecen' }
              ]
            },
            {
              id: 'branch_szeged',
              name: 'Branch: Szeged',
              type: 'SITE',
              location: 'Szeged, Hungary',
              headcount: 70,
              parentId: 'country_hungary',
              children: [
                { id: 'team_bi_szeged', name: 'Business Intelligence Desk', type: 'TEAM', headcount: 15, parentId: 'branch_szeged' },
                { id: 'team_product_szeged', name: 'Product & Tech Desk', type: 'TEAM', headcount: 18, parentId: 'branch_szeged' }
              ]
            }
          ]
        }
      ]
    },
    {
      id: 'region_benelux',
      name: 'Region: Benelux',
      type: 'REGION',
      headcount: 2100,
      children: [
        { id: 'branch_amsterdam', name: 'Branch: Amsterdam', type: 'SITE', location: 'Amsterdam, Netherlands', headcount: 320, parentId: 'region_benelux' },
        { id: 'branch_rotterdam', name: 'Branch: Rotterdam', type: 'SITE', location: 'Rotterdam, Netherlands', headcount: 280, parentId: 'region_benelux' }
      ]
    },
    {
      id: 'region_dach',
      name: 'Region: DACH',
      type: 'REGION',
      headcount: 3000,
      children: [
        { id: 'branch_berlin', name: 'Branch: Berlin', type: 'SITE', location: 'Berlin, Germany', headcount: 420, parentId: 'region_dach' },
        { id: 'branch_munich', name: 'Branch: Munich', type: 'SITE', location: 'Munich, Germany', headcount: 380, parentId: 'region_dach' }
      ]
    }
  ]
};

export const ORG_TWIN_TEMPLATES: Omit<OrgTwinTemplate, 'orgTree'>[] = [
  {
    id: 'pharma',
    label: 'Pharma Manufacturing',
    description: 'Sites, departments, and capability heatmaps oriented around manufacturing and regulated operations.',
    kpis: {
      totalLabel: 'Total Headcount',
      primaryLabel: 'Primary Sites',
      scenarioLabel: 'Critical Scenarios'
    },
    scenarios: [
      {
        id: 'IRELAND_EXPANSION',
        label: 'Ireland Biologics Launch',
        colorClass: 'bg-purple-600',
        description: 'Launch a new biologics capability and build critical mass over 12–18 months.'
      },
      {
        id: 'APAC_SCALE',
        label: 'APAC Scale-Up',
        colorClass: 'bg-blue-600',
        description: 'Scale regulated operations in APAC; strengthen regional compliance and language coverage.'
      },
      {
        id: 'DIGITAL_TRANSFORM',
        label: 'Digital Transformation',
        colorClass: 'bg-green-600',
        description: 'Accelerate digital manufacturing; close gaps in IoT, MES, and industrial analytics.'
      }
    ]
  },
  {
    id: 'staffing',
    label: 'Staffing (Randstad)',
    description: 'Branches, desks, and client ramp scenarios oriented around staffing operations and fill-rate risk.',
    kpis: {
      totalLabel: 'Total Consultants',
      primaryLabel: 'Active Branches',
      scenarioLabel: 'Active Alerts'
    },
    scenarios: [
      {
        id: 'CLIENT_RAMP',
        label: 'New Client Ramp (+50 in 2 weeks)',
        colorClass: 'bg-purple-600',
        description: 'Rapid ramp for a new client account; prioritize bench utilization and fast screening.'
      },
      {
        id: 'SEASONAL_SPIKE',
        label: 'Seasonal Spike (+200 in 30 days)',
        colorClass: 'bg-blue-600',
        description: 'High-volume hiring surge; optimize recruiter capacity and interview scheduling throughput.'
      },
      {
        id: 'COMPLIANCE_CHANGE',
        label: 'Compliance Change (Re-verify docs)',
        colorClass: 'bg-green-600',
        description: 'Document/compliance update; identify workforce segments at risk and remediate.'
      }
    ]
  }
];

