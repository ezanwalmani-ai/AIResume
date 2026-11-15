import {
  DEFAULT_SECTION_ORDER,
  type AtsClassification,
  type MasterResumeData,
  type ResumeSectionKey,
  type ResumeTemplateId,
  type TailoredResumeContent,
  type TemplateCategory,
  type TemplateCustomization,
} from '../types/resume.ts';

export interface ColorPreset {
  id: string;
  name: string;
  primaryColor: string;
  secondaryColor: string;
}

export const COLOR_PRESETS: ColorPreset[] = [
  { id: 'navy_blue', name: 'Navy Blue', primaryColor: '#1E3A5F', secondaryColor: '#334155' },
  { id: 'black_white', name: 'Black & White', primaryColor: '#0F172A', secondaryColor: '#475569' },
  { id: 'charcoal_grey', name: 'Charcoal Grey', primaryColor: '#27272A', secondaryColor: '#52525B' },
  { id: 'corporate_blue', name: 'Corporate Blue', primaryColor: '#2563EB', secondaryColor: '#1E40AF' },
  { id: 'dark_green', name: 'Dark Green', primaryColor: '#14532D', secondaryColor: '#3F6212' },
  { id: 'burgundy', name: 'Burgundy', primaryColor: '#7F1D1D', secondaryColor: '#57534E' },
  { id: 'minimal_grey', name: 'Minimal Grey', primaryColor: '#475569', secondaryColor: '#64748B' },
];

export const TEMPLATE_CATEGORY_META: Array<{
  id: TemplateCategory;
  label: string;
  subtitle: string;
}> = [
  {
    id: 'ats_professional',
    label: 'ATS-Friendly Professional',
    subtitle: 'Single-column layouts engineered for maximum parser accuracy.',
  },
  {
    id: 'modern_corporate',
    label: 'Modern Corporate',
    subtitle: 'Polished contemporary styling for enterprise and multinational roles.',
  },
  {
    id: 'creative',
    label: 'Creative & Visual',
    subtitle: 'Distinctive typography, color bands, and visual skill indicators.',
  },
  {
    id: 'industry_specific',
    label: 'Industry-Specific',
    subtitle: 'Targeted section prioritization for Procurement, Supply Chain, Finance, IT, and Ops.',
  },
];

export const ATS_CLASSIFICATION_LABELS: Record<AtsClassification, string> = {
  ats_friendly: 'ATS-Friendly',
  ats_caution: 'ATS-Compatible with Caution',
  creative_not_recommended: 'Creative / Visual – Not Recommended for strict ATS systems',
};

export interface TemplateDefinition {
  id: ResumeTemplateId;
  name: string;
  category: TemplateCategory;
  categoryLabel: string;
  description: string;
  atsClassification: AtsClassification;
  atsLabel: string;
  recommendedFor: string[];
  preferredSectionOrder?: ResumeSectionKey[];
  defaultCustomization: TemplateCustomization;
}

export const RESUME_TEMPLATES: TemplateDefinition[] = [
  // -------------------------------------------------------------------------
  // A. ATS-FRIENDLY PROFESSIONAL TEMPLATES (5)
  // -------------------------------------------------------------------------
  {
    id: 'classic_professional',
    name: 'Classic Professional',
    category: 'ats_professional',
    categoryLabel: 'ATS-Friendly Professional',
    description:
      'Traditional centered corporate resume with monochrome typography and clean horizontal rules.',
    atsClassification: 'ats_friendly',
    atsLabel: ATS_CLASSIFICATION_LABELS.ats_friendly,
    recommendedFor: ['Procurement Buyer', 'Corporate Operations', 'Legal & Compliance'],
    defaultCustomization: {
      primaryColor: '#0F172A',
      secondaryColor: '#475569',
      fontFamily: 'sans',
      fontSize: 'standard',
      headingStyle: 'uppercase_rule',
      sectionSpacing: 'standard',
      lineSpacing: 'normal',
      pageMargin: 'standard',
      layout: 'single_column',
      showPhoto: false,
      headerStyle: 'centered',
    },
  },
  {
    id: 'modern_ats',
    name: 'Modern ATS',
    category: 'ats_professional',
    categoryLabel: 'ATS-Friendly Professional',
    description:
      'Clean left-aligned hierarchy with sharp corporate blue accents and crisp section underlines.',
    atsClassification: 'ats_friendly',
    atsLabel: ATS_CLASSIFICATION_LABELS.ats_friendly,
    recommendedFor: ['Procurement Buyer', 'Business Analyst', 'Operations Specialist'],
    defaultCustomization: {
      primaryColor: '#2563EB',
      secondaryColor: '#334155',
      fontFamily: 'sans',
      fontSize: 'standard',
      headingStyle: 'clean_underline',
      sectionSpacing: 'standard',
      lineSpacing: 'normal',
      pageMargin: 'standard',
      layout: 'single_column',
      showPhoto: false,
      headerStyle: 'left_clean',
    },
  },
  {
    id: 'minimalist',
    name: 'Minimalist',
    category: 'ats_professional',
    categoryLabel: 'ATS-Friendly Professional',
    description:
      'Simple, airy single-column design with generous whitespace and subtle hairline dividers.',
    atsClassification: 'ats_friendly',
    atsLabel: ATS_CLASSIFICATION_LABELS.ats_friendly,
    recommendedFor: ['PO Management Analyst', 'Strategy Associate', 'Consultant'],
    defaultCustomization: {
      primaryColor: '#334155',
      secondaryColor: '#64748B',
      fontFamily: 'sans',
      fontSize: 'standard',
      headingStyle: 'clean_underline',
      sectionSpacing: 'relaxed',
      lineSpacing: 'airy',
      pageMargin: 'wide',
      layout: 'single_column',
      showPhoto: false,
      headerStyle: 'left_clean',
    },
  },
  {
    id: 'executive_professional',
    name: 'Executive Professional',
    category: 'ats_professional',
    categoryLabel: 'ATS-Friendly Professional',
    description:
      'Authoritative serif headings with bold navy top rule crafted for senior management and directors.',
    atsClassification: 'ats_friendly',
    atsLabel: ATS_CLASSIFICATION_LABELS.ats_friendly,
    recommendedFor: ['Senior Procurement Manager', 'VP Supply Chain', 'Operations Director'],
    defaultCustomization: {
      primaryColor: '#1E3A5F',
      secondaryColor: '#334155',
      fontFamily: 'serif',
      fontSize: 'standard',
      headingStyle: 'uppercase_rule',
      sectionSpacing: 'standard',
      lineSpacing: 'normal',
      pageMargin: 'standard',
      layout: 'single_column',
      showPhoto: false,
      headerStyle: 'top_accent_bar',
    },
  },
  {
    id: 'compact_professional',
    name: 'Compact Professional',
    category: 'ats_professional',
    categoryLabel: 'ATS-Friendly Professional',
    description:
      'Space-efficient single-column layout calibrated to fit dense multi-year experience cleanly.',
    atsClassification: 'ats_friendly',
    atsLabel: ATS_CLASSIFICATION_LABELS.ats_friendly,
    recommendedFor: ['Senior Specialist', 'Multi-Employer History', 'Project Lead'],
    defaultCustomization: {
      primaryColor: '#27272A',
      secondaryColor: '#52525B',
      fontFamily: 'sans',
      fontSize: 'compact',
      headingStyle: 'left_bar',
      sectionSpacing: 'compact',
      lineSpacing: 'tight',
      pageMargin: 'narrow',
      layout: 'single_column',
      showPhoto: false,
      headerStyle: 'left_clean',
    },
  },

  // -------------------------------------------------------------------------
  // B. MODERN CORPORATE TEMPLATES (5)
  // -------------------------------------------------------------------------
  {
    id: 'modern_business',
    name: 'Modern Business',
    category: 'modern_corporate',
    categoryLabel: 'Modern Corporate',
    description:
      'Contemporary corporate styling with a subtle tinted header band and left-accent section headers.',
    atsClassification: 'ats_friendly',
    atsLabel: ATS_CLASSIFICATION_LABELS.ats_friendly,
    recommendedFor: ['PO Management Analyst', 'Category Manager', 'Commercial Analyst'],
    defaultCustomization: {
      primaryColor: '#1E3A5F',
      secondaryColor: '#2563EB',
      fontFamily: 'sans',
      fontSize: 'standard',
      headingStyle: 'left_bar',
      sectionSpacing: 'standard',
      lineSpacing: 'normal',
      pageMargin: 'standard',
      layout: 'single_column',
      showPhoto: false,
      headerStyle: 'tinted_band',
    },
  },
  {
    id: 'professional_blue',
    name: 'Professional Blue',
    category: 'modern_corporate',
    categoryLabel: 'Modern Corporate',
    description:
      'Blue and white corporate styling with structured solid section banners for clear scannability.',
    atsClassification: 'ats_friendly',
    atsLabel: ATS_CLASSIFICATION_LABELS.ats_friendly,
    recommendedFor: ['Supply Chain Executive', 'Enterprise Sales', 'Account Manager'],
    defaultCustomization: {
      primaryColor: '#2563EB',
      secondaryColor: '#1E3A5F',
      fontFamily: 'sans',
      fontSize: 'standard',
      headingStyle: 'solid_banner',
      sectionSpacing: 'standard',
      lineSpacing: 'normal',
      pageMargin: 'standard',
      layout: 'single_column',
      showPhoto: false,
      headerStyle: 'top_accent_bar',
    },
  },
  {
    id: 'elegant_grey',
    name: 'Elegant Grey',
    category: 'modern_corporate',
    categoryLabel: 'Modern Corporate',
    description:
      'Sophisticated charcoal grey and crisp white layout pairing editorial serif headlines with sans body.',
    atsClassification: 'ats_friendly',
    atsLabel: ATS_CLASSIFICATION_LABELS.ats_friendly,
    recommendedFor: ['Corporate Governance', 'HR & Talent', 'Advisory'],
    defaultCustomization: {
      primaryColor: '#475569',
      secondaryColor: '#334155',
      fontFamily: 'georgia_sans',
      fontSize: 'standard',
      headingStyle: 'uppercase_rule',
      sectionSpacing: 'relaxed',
      lineSpacing: 'normal',
      pageMargin: 'standard',
      layout: 'single_column',
      showPhoto: false,
      headerStyle: 'centered',
    },
  },
  {
    id: 'clean_sidebar',
    name: 'Clean Sidebar',
    category: 'modern_corporate',
    categoryLabel: 'Modern Corporate',
    description:
      'Structured left sidebar presenting contact info, skills, ERP systems, and education beside experience.',
    atsClassification: 'ats_caution',
    atsLabel: ATS_CLASSIFICATION_LABELS.ats_caution,
    recommendedFor: ['Direct Recruiter Submission', 'Portfolio Roles', 'Operations Coordinator'],
    defaultCustomization: {
      primaryColor: '#1E3A5F',
      secondaryColor: '#475569',
      fontFamily: 'sans',
      fontSize: 'standard',
      headingStyle: 'clean_underline',
      sectionSpacing: 'standard',
      lineSpacing: 'normal',
      pageMargin: 'narrow',
      layout: 'two_column_left',
      showPhoto: true,
      headerStyle: 'left_clean',
    },
  },
  {
    id: 'structured_two_column',
    name: 'Structured Two-Column',
    category: 'modern_corporate',
    categoryLabel: 'Modern Corporate',
    description:
      'Organized two-column layout with primary work history on the left and skills/credentials on the right.',
    atsClassification: 'ats_caution',
    atsLabel: ATS_CLASSIFICATION_LABELS.ats_caution,
    recommendedFor: ['Hiring Manager Review', 'Product Operations', 'Mid-Career Specialist'],
    defaultCustomization: {
      primaryColor: '#0F172A',
      secondaryColor: '#2563EB',
      fontFamily: 'sans',
      fontSize: 'standard',
      headingStyle: 'left_bar',
      sectionSpacing: 'standard',
      lineSpacing: 'normal',
      pageMargin: 'narrow',
      layout: 'two_column_right',
      showPhoto: false,
      headerStyle: 'split_box',
    },
  },

  // -------------------------------------------------------------------------
  // C. CREATIVE TEMPLATES (5)
  // -------------------------------------------------------------------------
  {
    id: 'creative_modern',
    name: 'Creative Modern',
    category: 'creative',
    categoryLabel: 'Creative',
    description:
      'Distinctive asymmetric dark header banner with vibrant accent markers and two-column visual rhythm.',
    atsClassification: 'creative_not_recommended',
    atsLabel: ATS_CLASSIFICATION_LABELS.creative_not_recommended,
    recommendedFor: ['Creative Director', 'Brand Marketing', 'Design & Media'],
    defaultCustomization: {
      primaryColor: '#7F1D1D',
      secondaryColor: '#1E3A5F',
      fontFamily: 'sans',
      fontSize: 'standard',
      headingStyle: 'accent_tag',
      sectionSpacing: 'standard',
      lineSpacing: 'normal',
      pageMargin: 'narrow',
      layout: 'two_column_left',
      showPhoto: true,
      headerStyle: 'dark_banner',
    },
  },
  {
    id: 'contemporary',
    name: 'Contemporary',
    category: 'creative',
    categoryLabel: 'Creative',
    description:
      'Modern geometric typography with cyan accent bar and monospace dates for contemporary teams.',
    atsClassification: 'ats_caution',
    atsLabel: ATS_CLASSIFICATION_LABELS.ats_caution,
    recommendedFor: ['Digital Product', 'Tech Operations', 'Transformation Lead'],
    defaultCustomization: {
      primaryColor: '#0284C7',
      secondaryColor: '#0F172A',
      fontFamily: 'mono_accent',
      fontSize: 'standard',
      headingStyle: 'left_bar',
      sectionSpacing: 'standard',
      lineSpacing: 'normal',
      pageMargin: 'standard',
      layout: 'single_column',
      showPhoto: false,
      headerStyle: 'split_box',
    },
  },
  {
    id: 'premium_minimal',
    name: 'Premium Minimal',
    category: 'creative',
    categoryLabel: 'Creative',
    description:
      'Editorial luxury spacing pairing refined Georgia headings with ultra-clean dark slate body copy.',
    atsClassification: 'ats_friendly',
    atsLabel: ATS_CLASSIFICATION_LABELS.ats_friendly,
    recommendedFor: ['Management Consulting', 'Luxury Retail Procurement', 'Executive Advisory'],
    defaultCustomization: {
      primaryColor: '#14532D',
      secondaryColor: '#334155',
      fontFamily: 'georgia_sans',
      fontSize: 'standard',
      headingStyle: 'clean_underline',
      sectionSpacing: 'relaxed',
      lineSpacing: 'airy',
      pageMargin: 'wide',
      layout: 'single_column',
      showPhoto: false,
      headerStyle: 'centered',
    },
  },
  {
    id: 'bold_professional',
    name: 'Bold Professional',
    category: 'creative',
    categoryLabel: 'Creative',
    description:
      'Strong visual hierarchy featuring a full-width dark header block and high-contrast section headers.',
    atsClassification: 'ats_caution',
    atsLabel: ATS_CLASSIFICATION_LABELS.ats_caution,
    recommendedFor: ['Commercial Lead', 'Program Manager', 'Startups'],
    defaultCustomization: {
      primaryColor: '#0F172A',
      secondaryColor: '#2563EB',
      fontFamily: 'sans',
      fontSize: 'standard',
      headingStyle: 'solid_banner',
      sectionSpacing: 'standard',
      lineSpacing: 'normal',
      pageMargin: 'standard',
      layout: 'single_column',
      showPhoto: false,
      headerStyle: 'dark_banner',
    },
  },
  {
    id: 'infographic_style',
    name: 'Infographic Style',
    category: 'creative',
    categoryLabel: 'Creative',
    description:
      'Visual sidebar design with competency bars and highlighted profile blocks for portfolio outreach.',
    atsClassification: 'creative_not_recommended',
    atsLabel: ATS_CLASSIFICATION_LABELS.creative_not_recommended,
    recommendedFor: ['Design & Growth', 'Direct Email Outreach', 'Visual Portfolios'],
    defaultCustomization: {
      primaryColor: '#2563EB',
      secondaryColor: '#1E3A5F',
      fontFamily: 'sans',
      fontSize: 'compact',
      headingStyle: 'accent_tag',
      sectionSpacing: 'compact',
      lineSpacing: 'normal',
      pageMargin: 'narrow',
      layout: 'two_column_left',
      showPhoto: true,
      headerStyle: 'dark_banner',
      showSkillBars: true,
    },
  },

  // -------------------------------------------------------------------------
  // D. INDUSTRY-SPECIFIC TEMPLATES (5)
  // -------------------------------------------------------------------------
  {
    id: 'procurement_executive',
    name: 'Procurement & Purchase Executive',
    category: 'industry_specific',
    categoryLabel: 'Industry-Specific',
    description:
      'Engineered to spotlight P2P workflows, SAP MM, RFQ/vendor negotiation, and PO execution immediately.',
    atsClassification: 'ats_friendly',
    atsLabel: ATS_CLASSIFICATION_LABELS.ats_friendly,
    recommendedFor: ['Purchase Executive', 'Procurement Officer', 'SAP MM Buyer'],
    preferredSectionOrder: [
      'summary',
      'competencies',
      'erp_knowledge',
      'experience',
      'technical_skills',
      'education',
      'certifications',
      'languages',
    ],
    defaultCustomization: {
      primaryColor: '#1E3A5F',
      secondaryColor: '#0F172A',
      fontFamily: 'sans',
      fontSize: 'standard',
      headingStyle: 'uppercase_rule',
      sectionSpacing: 'standard',
      lineSpacing: 'normal',
      pageMargin: 'standard',
      layout: 'single_column',
      showPhoto: false,
      headerStyle: 'tinted_band',
    },
  },
  {
    id: 'supply_chain_logistics',
    name: 'Supply Chain & Logistics',
    category: 'industry_specific',
    categoryLabel: 'Industry-Specific',
    description:
      'Emphasizes inventory coordination, vendor lead-time reliability, ERP execution, and operations.',
    atsClassification: 'ats_friendly',
    atsLabel: ATS_CLASSIFICATION_LABELS.ats_friendly,
    recommendedFor: ['Supply Chain Coordinator', 'Materials Planner', 'Logistics Specialist'],
    preferredSectionOrder: [
      'summary',
      'competencies',
      'experience',
      'erp_knowledge',
      'technical_skills',
      'education',
      'certifications',
      'languages',
    ],
    defaultCustomization: {
      primaryColor: '#14532D',
      secondaryColor: '#334155',
      fontFamily: 'sans',
      fontSize: 'standard',
      headingStyle: 'left_bar',
      sectionSpacing: 'standard',
      lineSpacing: 'normal',
      pageMargin: 'standard',
      layout: 'single_column',
      showPhoto: false,
      headerStyle: 'top_accent_bar',
    },
  },
  {
    id: 'finance_accounts',
    name: 'Finance & Accounts',
    category: 'industry_specific',
    categoryLabel: 'Industry-Specific',
    description:
      'Crisp ledger-inspired formatting prioritizing invoice verification, compliance, audit, and certifications.',
    atsClassification: 'ats_friendly',
    atsLabel: ATS_CLASSIFICATION_LABELS.ats_friendly,
    recommendedFor: ['Accounts Payable', 'Financial Analyst', 'Audit & Compliance'],
    preferredSectionOrder: [
      'summary',
      'certifications',
      'experience',
      'technical_skills',
      'erp_knowledge',
      'competencies',
      'education',
      'languages',
    ],
    defaultCustomization: {
      primaryColor: '#0F172A',
      secondaryColor: '#334155',
      fontFamily: 'serif',
      fontSize: 'standard',
      headingStyle: 'uppercase_rule',
      sectionSpacing: 'standard',
      lineSpacing: 'normal',
      pageMargin: 'standard',
      layout: 'single_column',
      showPhoto: false,
      headerStyle: 'centered',
    },
  },
  {
    id: 'it_technical',
    name: 'IT & Technical',
    category: 'industry_specific',
    categoryLabel: 'Industry-Specific',
    description:
      'Surfaces technical skills, ERP/software stack, and certifications upfront with monospace dates.',
    atsClassification: 'ats_friendly',
    atsLabel: ATS_CLASSIFICATION_LABELS.ats_friendly,
    recommendedFor: ['IT Procurement', 'Systems Analyst', 'Technical Specialist'],
    preferredSectionOrder: [
      'summary',
      'technical_skills',
      'erp_knowledge',
      'experience',
      'certifications',
      'competencies',
      'education',
      'languages',
    ],
    defaultCustomization: {
      primaryColor: '#2563EB',
      secondaryColor: '#0F172A',
      fontFamily: 'mono_accent',
      fontSize: 'standard',
      headingStyle: 'clean_underline',
      sectionSpacing: 'standard',
      lineSpacing: 'normal',
      pageMargin: 'standard',
      layout: 'single_column',
      showPhoto: false,
      headerStyle: 'left_clean',
    },
  },
  {
    id: 'management_operations',
    name: 'Management & Operations',
    category: 'industry_specific',
    categoryLabel: 'Industry-Specific',
    description:
      'Built for operations leads, prioritizing cross-functional leadership, KPI execution, and governance.',
    atsClassification: 'ats_friendly',
    atsLabel: ATS_CLASSIFICATION_LABELS.ats_friendly,
    recommendedFor: ['Operations Manager', 'Department Lead', 'Vendor Governance Manager'],
    preferredSectionOrder: [
      'summary',
      'competencies',
      'experience',
      'erp_knowledge',
      'technical_skills',
      'education',
      'certifications',
      'languages',
    ],
    defaultCustomization: {
      primaryColor: '#7F1D1D',
      secondaryColor: '#1E3A5F',
      fontFamily: 'georgia_sans',
      fontSize: 'standard',
      headingStyle: 'left_bar',
      sectionSpacing: 'standard',
      lineSpacing: 'normal',
      pageMargin: 'standard',
      layout: 'single_column',
      showPhoto: false,
      headerStyle: 'split_box',
    },
  },
];

export const LEGACY_TEMPLATE_MAP: Record<string, ResumeTemplateId> = {
  classic_ats: 'classic_professional',
  modern_minimal: 'minimalist',
  executive_navy: 'executive_professional',
  executive_bold: 'executive_professional',
  creative_tech: 'contemporary',
};

export function normalizeTemplateId(id?: ResumeTemplateId | string | null): ResumeTemplateId {
  if (!id) return 'classic_professional';
  if (id in LEGACY_TEMPLATE_MAP) {
    return LEGACY_TEMPLATE_MAP[id];
  }
  const found = RESUME_TEMPLATES.find((t) => t.id === id);
  return found ? found.id : 'classic_professional';
}

export function getTemplateDefinition(id?: ResumeTemplateId | string | null): TemplateDefinition {
  const normalized = normalizeTemplateId(id);
  return (
    RESUME_TEMPLATES.find((t) => t.id === normalized) ??
    RESUME_TEMPLATES[0]
  );
}

export function resolveTemplateCustomization(
  templateId?: ResumeTemplateId | string | null,
  overrides?: Partial<TemplateCustomization> | null,
): TemplateCustomization {
  const def = getTemplateDefinition(templateId);
  if (!overrides) return { ...def.defaultCustomization };
  return {
    ...def.defaultCustomization,
    ...overrides,
  };
}

export function getEffectiveSectionOrder(
  contentSectionOrder: ResumeSectionKey[] | undefined,
  templateId?: ResumeTemplateId | string | null,
  respectPreferredDefault = false,
): ResumeSectionKey[] {
  const def = getTemplateDefinition(templateId);
  const baseOrder =
    respectPreferredDefault && def.preferredSectionOrder
      ? def.preferredSectionOrder
      : contentSectionOrder && contentSectionOrder.length > 0
        ? contentSectionOrder
        : def.preferredSectionOrder || DEFAULT_SECTION_ORDER;

  const merged = [...baseOrder];
  for (const key of DEFAULT_SECTION_ORDER) {
    if (!merged.includes(key)) {
      merged.push(key);
    }
  }
  return merged;
}

export const SAMPLE_PREVIEW_RESUME: TailoredResumeContent = {
  personalInfo: {
    fullName: 'Asha Menon',
    firstName: 'Asha',
    lastName: 'Menon',
    email: 'asha.menon@example.com',
    phone: '+65 9123 4567',
    location: 'Singapore',
    linkedin: 'linkedin.com/in/ashamenon',
    portfolio: '',
  },
  professionalTitle: 'Procurement & Purchase Executive',
  professionalSummary:
    'Detail-oriented Procurement Executive experienced in end-to-end Purchase-to-Pay (P2P) workflows, SAP MM purchase order processing, RFQ management, commercial quotation comparisons, and three-way invoice verification across enterprise operations.',
  coreCompetencies: [
    'Purchase Order Management',
    'RFQ & Quotation Evaluation',
    'Vendor Coordination',
    'Procure-to-Pay (P2P)',
    'Goods Receipt Verification',
    'Three-Way Invoice Matching',
  ],
  professionalExperience: [
    {
      id: 'sample-1',
      companyName: 'Apex Industrial Systems Pte Ltd',
      jobTitle: 'Purchase Executive',
      location: 'Singapore',
      startDate: '2022-03',
      endDate: '',
      isCurrent: true,
      bullets: [
        'Issued and tracked Purchase Orders in SAP MM, ensuring timely order acknowledgement and delivery alignment with internal requestors.',
        'Coordinated RFQ dispatch and compiled commercial quotation comparison sheets to support management supplier selection.',
        'Verified Goods Receipt Notes (GRN) and reconciled supplier invoices against POs to resolve billing discrepancies promptly.',
      ],
    },
    {
      id: 'sample-2',
      companyName: 'Meridian Corporate Services',
      jobTitle: 'Procurement Coordinator',
      location: 'Singapore',
      startDate: '2020-01',
      endDate: '2022-02',
      isCurrent: false,
      bullets: [
        'Maintained approved vendor master lists, delivery schedules, and weekly open-order tracking reports in Microsoft Excel.',
        'Liaised with finance and warehouse teams to expedite urgent indirect and IT equipment requisitions.',
      ],
    },
  ],
  technicalSkills: [
    'RFQ Management',
    'Purchase Requisition Processing',
    'Quotation Comparison',
    'Vendor Follow-Up',
    'GRN & Invoice Reconciliation',
  ],
  erpAndSoftwareKnowledge: ['SAP MM', 'Microsoft Excel (Pivot Tables, VLOOKUP)', 'ERP Procurement Modules'],
  educationalQualifications: [
    {
      id: 'edu-1',
      institution: 'National University of Singapore',
      degree: 'Bachelor of Science',
      fieldOfStudy: 'Supply Chain & Operations Management',
      graduationDate: '2019',
      location: 'Singapore',
      details: '',
    },
  ],
  certifications: [
    {
      id: 'cert-1',
      name: 'Certified Purchasing Professional (CPP)',
      issuer: 'APICS / Supply Chain Institute',
      date: '2023',
    },
  ],
  languages: [
    { language: 'English', proficiency: 'Fluent' },
    { language: 'Malay', proficiency: 'Conversational' },
  ],
  sectionOrder: [...DEFAULT_SECTION_ORDER],
};

export function masterDataToPreviewContent(master?: MasterResumeData | null): TailoredResumeContent {
  if (!master) return SAMPLE_PREVIEW_RESUME;
  return {
    personalInfo: { ...master.personalInfo },
    professionalTitle: master.headline || master.employmentHistory[0]?.jobTitle || 'Professional',
    professionalSummary: master.professionalSummary || SAMPLE_PREVIEW_RESUME.professionalSummary,
    coreCompetencies:
      master.procurementExperience.length > 0
        ? master.procurementExperience
        : master.technicalSkills.slice(0, 6),
    professionalExperience: master.employmentHistory.map((e) => ({
      id: e.id,
      companyName: e.companyName,
      jobTitle: e.jobTitle,
      location: e.location,
      startDate: e.startDate,
      endDate: e.endDate,
      isCurrent: e.isCurrent,
      bullets: [...e.responsibilities, ...e.achievements].slice(0, 4),
    })),
    technicalSkills: master.technicalSkills,
    erpAndSoftwareKnowledge: master.erpKnowledge,
    educationalQualifications: master.education,
    certifications: master.certifications,
    languages: master.languages,
    sectionOrder: [...DEFAULT_SECTION_ORDER],
  };
}
