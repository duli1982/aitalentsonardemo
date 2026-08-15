import { OrgUnit } from '../types/org';

export const ORG_TREE: OrgUnit = {
    id: 'global_mfg',
    name: 'Global Manufacturing & Supply',
    type: 'BU',
    headcount: 12500,
    children: [
        {
            id: 'site_darmstadt',
            name: 'Site: Darmstadt (HQ)',
            type: 'SITE',
            location: 'Germany',
            headcount: 4500,
            parentId: 'global_mfg',
            children: [
                {
                    id: 'dept_biologics_de',
                    name: 'Biologics Production',
                    type: 'DEPARTMENT',
                    headcount: 450,
                    parentId: 'site_darmstadt',
                    children: [
                        { id: 'team_upstream_de', name: 'Upstream Processing Team A', type: 'TEAM', headcount: 12, parentId: 'dept_biologics_de' },
                        { id: 'team_downstream_de', name: 'Downstream Processing Team B', type: 'TEAM', headcount: 15, parentId: 'dept_biologics_de' },
                        { id: 'team_qa_de', name: 'Quality Assurance Biologics', type: 'TEAM', headcount: 8, parentId: 'dept_biologics_de' }
                    ]
                }
            ]
        },
        {
            id: 'site_cork',
            name: 'Site: Cork (Expansion Focus)',
            type: 'SITE',
            location: 'Ireland',
            headcount: 850,
            parentId: 'global_mfg',
            children: [
                {
                    id: 'dept_solids_ie',
                    name: 'Oral Solid Dosage',
                    type: 'DEPARTMENT',
                    headcount: 300,
                    parentId: 'site_cork'
                },
                {
                    id: 'dept_new_biologics_ie',
                    name: 'Biologics Launch Pad (New)',
                    type: 'DEPARTMENT',
                    headcount: 0, // Currently empty
                    parentId: 'site_cork'
                }
            ]
        },
        {
            id: 'site_vevey',
            name: 'Site: Vevey',
            type: 'SITE',
            location: 'Switzerland',
            headcount: 1200,
            parentId: 'global_mfg',
            children: [
                {
                    id: 'dept_biotech_ch',
                    name: 'Biotech Center of Excellence',
                    type: 'DEPARTMENT',
                    headcount: 200,
                    parentId: 'site_vevey'
                }
            ]
        }
    ]
};
