export type GenerationMode = 'balanced' | 'maximum_alignment' | 'conservative';

export type TemplateCategory =
  | 'ats_professional'
  | 'modern_corporate'
  | 'creative'
  | 'industry_specific';

export type AtsClassification =
  | 'ats_friendly'
  | 'ats_caution'
  | 'creative_not_recommended';

export type ResumeTemplateId =
  // A. ATS-Friendly Professional (5)
  | 'classic_professional'
  | 'modern_ats'
  | 'minimalist'
  | 'executive_professional'
  | 'compact_professional'
  // B. Modern Corporate (5)
  | 'modern_business'
  | 'professional_blue'
  | 'elegant_grey'
  | 'clean_sidebar'
  | 'structured_two_column'
  // C. Creative (5)
  | 'creative_modern'
  | 'contemporary'
  | 'premium_minimal'
  | 'bold_professional'
  | 'infographic_style'
  // D. Industry-Specific (5)
  | 'procurement_executive'
  | 'supply_chain_logistics'
  | 'finance_accounts'
  | 'it_technical'
  | 'management_operations'
  // Legacy aliases for backward compatibility with existing DB rows
  | 'classic_ats'
  | 'executive_navy'
  | 'executive_bold'
  | 'creative_tech'
  | 'modern_minimal';

export interface TemplateCustomization {
  primaryColor: string;
  secondaryColor: string;
  fontFamily: 'sans' | 'serif' | 'mono_accent' | 'georgia_sans';
  fontSize: 'compact' | 'standard' | 'large';
  headingStyle: 'uppercase_rule' | 'left_bar' | 'solid_banner' | 'clean_underline' | 'accent_tag';
  sectionSpacing: 'compact' | 'standard' | 'relaxed';
  lineSpacing: 'tight' | 'normal' | 'airy';
  pageMargin: 'narrow' | 'standard' | 'wide';
  layout: 'single_column' | 'two_column_left' | 'two_column_right';
  showPhoto: boolean;
  headerStyle:
    | 'centered'
    | 'left_clean'
    | 'tinted_band'
    | 'dark_banner'
    | 'top_accent_bar'
    | 'split_box';
  showSkillBars?: boolean;
}

export interface TemplateRecommendation {
  recommendedTemplateId: ResumeTemplateId;
  alternativeTemplateIds: ResumeTemplateId[];
  reason: string;
}

export interface ExportValidationReport {
  valid: boolean;
  format: 'pdf' | 'docx';
  selectableTextVerified: boolean;
  readingOrderVerified: boolean;
  atsClassification: AtsClassification;
  warnings: string[];
}

export type ResumeSectionKey =
  | 'summary'
  | 'competencies'
  | 'experience'
  | 'technical_skills'
  | 'erp_knowledge'
  | 'education'
  | 'certifications'
  | 'languages';

export const DEFAULT_SECTION_ORDER: ResumeSectionKey[] = [
  'summary',
  'competencies',
  'experience',
  'technical_skills',
  'erp_knowledge',
  'education',
  'certifications',
  'languages',
];

export interface PersonalInfo {
  fullName: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  location: string;
  linkedin: string;
  portfolio: string;
}

export interface EmploymentRecord {
  id: string;
  companyName: string;
  jobTitle: string;
  location: string;
  startDate: string;
  endDate: string;
  isCurrent: boolean;
  responsibilities: string[];
  achievements: string[];
  procurementCategories: string[];
  toolsAndErp: string[];
}

export interface EducationRecord {
  id: string;
  institution: string;
  degree: string;
  fieldOfStudy: string;
  graduationDate: string;
  location: string;
  details: string;
}

export interface CertificationRecord {
  id: string;
  name: string;
  issuer: string;
  date: string;
}

export interface LanguageRecord {
  language: string;
  proficiency: string;
}

export interface MasterResumeData {
  personalInfo: PersonalInfo;
  headline: string;
  professionalSummary: string;
  employmentHistory: EmploymentRecord[];
  procurementExperience: string[];
  technicalSkills: string[];
  erpKnowledge: string[];
  education: EducationRecord[];
  certifications: CertificationRecord[];
  languages: LanguageRecord[];
  additionalQualifications: string[];
}

export type OptimizationAction =
  | 'improve_ats'
  | 'rewrite_summary'
  | 'optimize_experience'
  | 'optimize_skills';

export interface JobDescriptionAnalysis {
  jobTitle: string;
  companyName: string;
  department?: string;
  industry: string;
  seniority?: string;
  requiredExperience: string;
  educationalRequirements?: string[];
  requiredQualifications: string[];
  technicalSkills: string[];
  softwareAndErp: string[];
  jobResponsibilities: string[];
  procurementCategories: string[];
  purchasingProcesses: string[];
  importantAtsKeywords: string[];
  industryTerminology?: string[];
  essentialRequirements?: string[];
  preferredSkills: string[];
  mandatoryRequirements: string[];
  candidateGaps?: string[];
  templateRecommendation?: TemplateRecommendation;
}

export interface ExperienceMatch {
  companyName: string;
  jobTitle: string;
  relevanceScore: number;
  matchedResponsibilities: string[];
  transferableSkills: string[];
}

export interface ResumeMatchingResult {
  relevantExperiences: ExperienceMatch[];
  transferableSkillsSummary: string[];
  supportedKeywords: string[];
  unsupportedJdRequirements: string[];
}

export interface TailoredExperienceItem {
  id: string;
  companyName: string;
  jobTitle: string;
  location: string;
  startDate: string;
  endDate: string;
  isCurrent: boolean;
  bullets: string[];
}

export interface TailoredResumeContent {
  personalInfo: PersonalInfo;
  professionalTitle: string;
  professionalSummary: string;
  coreCompetencies: string[];
  professionalExperience: TailoredExperienceItem[];
  technicalSkills: string[];
  erpAndSoftwareKnowledge: string[];
  educationalQualifications: EducationRecord[];
  certifications: CertificationRecord[];
  languages: LanguageRecord[];
  sectionOrder: ResumeSectionKey[];
}

export interface AtsKeywordExplanation {
  keyword: string;
  category: 'matched' | 'partial' | 'missing';
  significance: string;
  suggestion: string;
}

export interface AtsCategoryScore {
  category: string;
  weight: number;
  originalScore: number;
  tailoredScore: number;
  notes: string;
}

export interface AtsChangeItem {
  section: string;
  change: string;
  reason: string;
}

export interface AtsAnalysisResult {
  estimatedAlignmentScore: number;
  originalAtsScore?: number;
  keywordMatchPercentage?: number;
  skillsMatchPercentage?: number;
  experienceRelevancePercentage?: number;
  scoreDisclaimer: string;
  matchedKeywords: string[];
  partiallyMatchedKeywords: string[];
  missingKeywords: string[];
  missingMandatorySkills?: string[];
  missingPreferredSkills?: string[];
  formattingIssues?: string[];
  categoryBreakdown?: AtsCategoryScore[];
  changesSummary?: AtsChangeItem[];
  improvementRecommendations?: string[];
  autoImprovementApplied?: boolean;
  autoImprovementNotes?: string[];
  belowTargetExplanation?: string | null;
  questionsForCandidate?: string[];
  relevantExperienceHighlights: string[];
  transferableSkills: string[];
  skillsRequiringVerification: string[];
  keywordExplanations?: AtsKeywordExplanation[];
}

export interface FactualViolation {
  field: string;
  severity: 'error' | 'warning';
  message: string;
}

export interface FactualVerificationResult {
  passed: boolean;
  checkedAt: string;
  immutableFieldsVerified: {
    fullNameMatch: boolean;
    contactDetailsMatch: boolean;
    companyNamesMatch: boolean;
    employmentDatesMatch: boolean;
    jobTitlesMatch: boolean;
    educationMatch: boolean;
    certificationsMatch: boolean;
  };
  violations: FactualViolation[];
  correctionsApplied: string[];
}

export interface ReviewerReport {
  reviewedAt: string;
  overallQuality: 'excellent' | 'good' | 'needs_attention';
  checks: {
    matchesJd: boolean;
    summaryRelevant: boolean;
    keywordsIncludedNaturally: boolean;
    experienceAccuratelyRepresented: boolean;
    noInventedInformation: boolean;
    datesAndCompaniesUnchanged: boolean;
    atsFriendly: boolean;
    grammarAndFormattingProfessional: boolean;
  };
  findings: string[];
  correctionsMade: string[];
}

export interface MasterResumeRecord {
  id: number;
  originalFileName: string | null;
  originalMimeType: string | null;
  fileSizeBytes: number | null;
  structuredData: MasterResumeData;
  isApproved: boolean;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface GeneratedResumeRecord {
  id: number;
  uuid?: string;
  masterResumeId: number | null;
  jobDescriptionId?: string | null;
  originalDocumentId?: string | null;
  resumeTemplateUuid?: string | null;
  resumeTitle?: string;
  jobTitle: string;
  companyName: string;
  originalJd: string;
  jdAnalysis: JobDescriptionAnalysis;
  generationMode: GenerationMode;
  templateId: ResumeTemplateId;
  templateCustomization?: TemplateCustomization | null;
  tailoredResume: TailoredResumeContent;
  generatedText?: string;
  pdfStoragePath?: string;
  docxStoragePath?: string;
  originalAtsScore?: number | null;
  finalAtsScore?: number | null;
  keywordMatchScore?: number | null;
  skillsMatchScore?: number | null;
  experienceMatchScore?: number | null;
  formattingScore?: number | null;
  missingKeywords?: string[];
  improvementNotes?: string[];
  generationStatus?: 'pending' | 'processing' | 'completed' | 'failed';
  atsAnalysis: AtsAnalysisResult;
  factualVerification: FactualVerificationResult;
  reviewReport: ReviewerReport;
  aiModel: string;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface UserSettings {
  id?: number;
  uuid?: string;
  email: string;
  fullName: string | null;
  displayName: string | null;
  phone: string | null;
  role: 'user' | 'admin';
  isAdmin: boolean;
  defaultMode: GenerationMode;
  defaultTemplate: ResumeTemplateId;
}
