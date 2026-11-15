import { GoogleGenAI, Type, ThinkingLevel } from '@google/genai';
import mammoth from 'mammoth';
import {
  DEFAULT_SECTION_ORDER,
  type AtsAnalysisResult,
  type AtsCategoryScore,
  type AtsChangeItem,
  type AtsKeywordExplanation,
  type FactualVerificationResult,
  type GenerationMode,
  type JobDescriptionAnalysis,
  type MasterResumeData,
  type OptimizationAction,
  type ResumeMatchingResult,
  type ResumeSectionKey,
  type ReviewerReport,
  type TailoredResumeContent,
} from '../types/resume.ts';
import { enforceAndVerifyFactualAccuracy } from './factualGuard.ts';

const VALID_GEMINI_MODELS = new Set([
  'gemini-4-hydrogen',
  'gemini-3.1-flash-lite',
  'gemini-4-argon',
  'gemini-4-carbon',
  'gemini-2.5-flash',
  'gemini-2.5-pro',
]);

export function getConfiguredModel(): string {
  const configured = process.env.GEMINI_MODEL?.trim();
  if (configured && VALID_GEMINI_MODELS.has(configured)) {
    return configured;
  }
  return configured || 'gemini-4-hydrogen';
}

function createGeminiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not configured on the server.');
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

function translateGeminiError(error: unknown): Error {
  const message = error instanceof Error ? error.message : String(error);
  const lower = message.toLowerCase();

  if (lower.includes('api_key_invalid') || lower.includes('permission_denied') || lower.includes('403')) {
    return new Error(
      'Gemini API authentication failed. Please verify GEMINI_API_KEY in Settings > Secrets.',
    );
  }
  if (lower.includes('resource_exhausted') || lower.includes('429')) {
    return new Error(
      'Gemini API rate limit reached. Please wait a moment and retry your request.',
    );
  }
  if (lower.includes('not_found') || lower.includes('404')) {
    return new Error(
      `Configured Gemini model "${getConfiguredModel()}" was not found. Please check GEMINI_MODEL.`,
    );
  }
  if (lower.includes('timeout') || lower.includes('aborted')) {
    return new Error('Gemini AI request timed out. Please retry.');
  }
  return new Error(`Gemini AI processing failed: ${message}`);
}

async function withRetry<T>(fn: () => Promise<T>, maxAttempts = 3): Promise<T> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      const msg = error instanceof Error ? error.message.toLowerCase() : '';
      const isTransient =
        msg.includes('429') ||
        msg.includes('resource_exhausted') ||
        msg.includes('503') ||
        msg.includes('unavailable') ||
        msg.includes('econnreset') ||
        msg.includes('timeout');

      if (!isTransient || attempt === maxAttempts) {
        throw translateGeminiError(error);
      }
      const delayMs = 800 * Math.pow(2, attempt - 1) + Math.floor(Math.random() * 250);
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
  throw translateGeminiError(lastError);
}

function parseJsonResponse<T>(text: string | undefined, context: string): T {
  if (!text || !text.trim()) {
    throw new Error(`Gemini returned an empty response during ${context}.`);
  }
  const cleaned = text.trim().replace(/^```json\s*/i, '').replace(/```$/i, '').trim();
  try {
    return JSON.parse(cleaned) as T;
  } catch (err) {
    throw new Error(
      `Gemini returned invalid structured JSON during ${context}: ${err instanceof Error ? err.message : 'parse error'}`,
    );
  }
}

const SYSTEM_EXPERT_PERSONA = `You are an experienced recruitment specialist, professional resume writer, procurement & operations industry expert, and ATS resume optimization consultant.
You strictly preserve factual accuracy:
- NEVER invent employment history, companies, job titles, employment dates, degrees, certifications, percentages, cost savings, procurement volumes, supplier counts, SAP transactions, or software/technical skills not supported by the candidate's actual Master Resume.
- Strictly distinguish actual professional work experience from theoretical knowledge, coursework, training, and certifications. NEVER present training-only knowledge as professional work experience.
- Distinguish work the candidate personally executed from work handled by their manager or team if indicated in the Master Resume.`;

// ---------------------------------------------------------------------------
// 1. RESUME EXTRACTION (PDF / DOCX / Plain Text -> Structured Master Resume)
// ---------------------------------------------------------------------------

const masterResumeSchema = {
  type: Type.OBJECT,
  properties: {
    personalInfo: {
      type: Type.OBJECT,
      properties: {
        fullName: { type: Type.STRING },
        firstName: { type: Type.STRING },
        lastName: { type: Type.STRING },
        email: { type: Type.STRING },
        phone: { type: Type.STRING },
        location: { type: Type.STRING },
        linkedin: { type: Type.STRING },
        portfolio: { type: Type.STRING },
      },
      required: ['fullName', 'firstName', 'lastName', 'email', 'phone', 'location', 'linkedin', 'portfolio'],
    },
    headline: { type: Type.STRING },
    professionalSummary: { type: Type.STRING },
    employmentHistory: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          id: { type: Type.STRING },
          companyName: { type: Type.STRING },
          jobTitle: { type: Type.STRING },
          location: { type: Type.STRING },
          startDate: { type: Type.STRING },
          endDate: { type: Type.STRING },
          isCurrent: { type: Type.BOOLEAN },
          responsibilities: { type: Type.ARRAY, items: { type: Type.STRING } },
          achievements: { type: Type.ARRAY, items: { type: Type.STRING } },
          procurementCategories: { type: Type.ARRAY, items: { type: Type.STRING } },
          toolsAndErp: { type: Type.ARRAY, items: { type: Type.STRING } },
        },
        required: [
          'id',
          'companyName',
          'jobTitle',
          'location',
          'startDate',
          'endDate',
          'isCurrent',
          'responsibilities',
          'achievements',
          'procurementCategories',
          'toolsAndErp',
        ],
      },
    },
    procurementExperience: { type: Type.ARRAY, items: { type: Type.STRING } },
    technicalSkills: { type: Type.ARRAY, items: { type: Type.STRING } },
    erpKnowledge: { type: Type.ARRAY, items: { type: Type.STRING } },
    education: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          id: { type: Type.STRING },
          institution: { type: Type.STRING },
          degree: { type: Type.STRING },
          fieldOfStudy: { type: Type.STRING },
          graduationDate: { type: Type.STRING },
          location: { type: Type.STRING },
          details: { type: Type.STRING },
        },
        required: ['id', 'institution', 'degree', 'fieldOfStudy', 'graduationDate', 'location', 'details'],
      },
    },
    certifications: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          id: { type: Type.STRING },
          name: { type: Type.STRING },
          issuer: { type: Type.STRING },
          date: { type: Type.STRING },
        },
        required: ['id', 'name', 'issuer', 'date'],
      },
    },
    languages: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          language: { type: Type.STRING },
          proficiency: { type: Type.STRING },
        },
        required: ['language', 'proficiency'],
      },
    },
    additionalQualifications: { type: Type.ARRAY, items: { type: Type.STRING } },
  },
  required: [
    'personalInfo',
    'headline',
    'professionalSummary',
    'employmentHistory',
    'procurementExperience',
    'technicalSkills',
    'erpKnowledge',
    'education',
    'certifications',
    'languages',
    'additionalQualifications',
  ],
};

function sanitizeMasterResume(raw: MasterResumeData): MasterResumeData {
  const fullName = (raw.personalInfo?.fullName || '').trim();
  const parts = fullName.split(/\s+/).filter(Boolean);
  const firstName = (raw.personalInfo?.firstName || parts[0] || '').trim();
  const lastName = (raw.personalInfo?.lastName || parts.slice(1).join(' ') || '').trim();

  return {
    personalInfo: {
      fullName: fullName || `${firstName} ${lastName}`.trim(),
      firstName,
      lastName,
      email: (raw.personalInfo?.email || '').trim(),
      phone: (raw.personalInfo?.phone || '').trim(),
      location: (raw.personalInfo?.location || '').trim(),
      linkedin: (raw.personalInfo?.linkedin || '').trim(),
      portfolio: (raw.personalInfo?.portfolio || '').trim(),
    },
    headline: (raw.headline || '').trim(),
    professionalSummary: (raw.professionalSummary || '').trim(),
    employmentHistory: Array.isArray(raw.employmentHistory)
      ? raw.employmentHistory.map((e, idx) => ({
          id: e.id || `exp_${idx + 1}`,
          companyName: (e.companyName || '').trim(),
          jobTitle: (e.jobTitle || '').trim(),
          location: (e.location || '').trim(),
          startDate: (e.startDate || '').trim(),
          endDate: e.isCurrent ? 'Present' : (e.endDate || '').trim(),
          isCurrent: Boolean(e.isCurrent),
          responsibilities: Array.isArray(e.responsibilities)
            ? e.responsibilities.map((r) => r.trim()).filter(Boolean)
            : [],
          achievements: Array.isArray(e.achievements)
            ? e.achievements.map((a) => a.trim()).filter(Boolean)
            : [],
          procurementCategories: Array.isArray(e.procurementCategories)
            ? e.procurementCategories.map((p) => p.trim()).filter(Boolean)
            : [],
          toolsAndErp: Array.isArray(e.toolsAndErp)
            ? e.toolsAndErp.map((t) => t.trim()).filter(Boolean)
            : [],
        }))
      : [],
    procurementExperience: Array.isArray(raw.procurementExperience)
      ? raw.procurementExperience.map((s) => s.trim()).filter(Boolean)
      : [],
    technicalSkills: Array.isArray(raw.technicalSkills)
      ? raw.technicalSkills.map((s) => s.trim()).filter(Boolean)
      : [],
    erpKnowledge: Array.isArray(raw.erpKnowledge)
      ? raw.erpKnowledge.map((s) => s.trim()).filter(Boolean)
      : [],
    education: Array.isArray(raw.education)
      ? raw.education.map((ed, idx) => ({
          id: ed.id || `edu_${idx + 1}`,
          institution: (ed.institution || '').trim(),
          degree: (ed.degree || '').trim(),
          fieldOfStudy: (ed.fieldOfStudy || '').trim(),
          graduationDate: (ed.graduationDate || '').trim(),
          location: (ed.location || '').trim(),
          details: (ed.details || '').trim(),
        }))
      : [],
    certifications: Array.isArray(raw.certifications)
      ? raw.certifications.map((c, idx) => ({
          id: c.id || `cert_${idx + 1}`,
          name: (c.name || '').trim(),
          issuer: (c.issuer || '').trim(),
          date: (c.date || '').trim(),
        }))
      : [],
    languages: Array.isArray(raw.languages)
      ? raw.languages
          .map((l) => ({
            language: (l.language || '').trim(),
            proficiency: (l.proficiency || '').trim(),
          }))
          .filter((l) => l.language.length > 0)
      : [],
    additionalQualifications: Array.isArray(raw.additionalQualifications)
      ? raw.additionalQualifications.map((s) => s.trim()).filter(Boolean)
      : [],
  };
}

export async function extractMasterResumeFromFile(
  buffer: Buffer,
  mimeType: string,
  fileName: string,
): Promise<{ data: MasterResumeData; modelUsed: string }> {
  const ai = createGeminiClient();
  const model = getConfiguredModel();

  const lowerName = fileName.toLowerCase();
  const isPdf = mimeType === 'application/pdf' || lowerName.endsWith('.pdf');
  const isDocx =
    mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
    lowerName.endsWith('.docx');

  const extractionInstruction = `Extract every single factual detail from the provided resume into the JSON schema.
Rules:
1. Preserve exact full name, email, phone, company names, job titles, start dates, end dates, education, and certifications verbatim.
2. Do not fabricate or extrapolate missing fields—leave unknown strings empty ("") or arrays empty ([]).
3. Separate procurement/purchasing responsibilities and categories accurately if present; if the candidate is in another domain, list domain responsibilities under responsibilities and keep procurementExperience empty unless applicable.
4. Extract ERP systems (e.g., SAP MM, Oracle, Ariba, Coupa, Tally, NetSuite) into erpKnowledge and role-level toolsAndErp.
5. Assign unique short IDs like "exp_1", "edu_1", "cert_1".`;

  if (isPdf) {
    const base64Data = buffer.toString('base64');
    const response = await withRetry(() =>
      ai.models.generateContent({
        model,
        contents: {
          parts: [
            {
              inlineData: {
                mimeType: 'application/pdf',
                data: base64Data,
              },
            },
            { text: extractionInstruction },
          ],
        },
        config: {
          systemInstruction: SYSTEM_EXPERT_PERSONA,
          responseMimeType: 'application/json',
          responseSchema: masterResumeSchema,
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
        },
      }),
    );

    const parsed = parseJsonResponse<MasterResumeData>(response.text, 'PDF resume extraction');
    return { data: sanitizeMasterResume(parsed), modelUsed: model };
  }

  let rawText = '';
  if (isDocx) {
    const extracted = await mammoth.extractRawText({ buffer });
    rawText = extracted.value;
  } else {
    rawText = buffer.toString('utf8');
  }

  if (!rawText.trim()) {
    throw new Error('The uploaded document appears to be empty or unreadable.');
  }

  const data = await extractMasterResumeFromText(rawText);
  return data;
}

export async function extractMasterResumeFromText(
  rawText: string,
): Promise<{ data: MasterResumeData; modelUsed: string }> {
  const ai = createGeminiClient();
  const model = getConfiguredModel();

  const response = await withRetry(() =>
    ai.models.generateContent({
      model,
      contents: `Extract every factual detail from the following resume text into the structured JSON schema. Preserve exact names, dates, companies, titles, education, and certifications without inventing anything.\n\nRESUME TEXT:\n${rawText.slice(0, 45000)}`,
      config: {
        systemInstruction: SYSTEM_EXPERT_PERSONA,
        responseMimeType: 'application/json',
        responseSchema: masterResumeSchema,
        thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
      },
    }),
  );

  const parsed = parseJsonResponse<MasterResumeData>(response.text, 'text resume extraction');
  return { data: sanitizeMasterResume(parsed), modelUsed: model };
}

// ---------------------------------------------------------------------------
// 2. JOB DESCRIPTION EXTRACTION & DETAILED ANALYSIS
// ---------------------------------------------------------------------------

export async function extractTextFromJdFile(
  buffer: Buffer,
  mimeType: string,
  fileName: string,
): Promise<string> {
  const lowerName = fileName.toLowerCase();
  const isPdf = mimeType === 'application/pdf' || lowerName.endsWith('.pdf');
  const isDocx =
    mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
    lowerName.endsWith('.docx');

  if (isPdf) {
    const ai = createGeminiClient();
    const model = getConfiguredModel();
    const response = await withRetry(() =>
      ai.models.generateContent({
        model,
        contents: {
          parts: [
            {
              inlineData: {
                mimeType: 'application/pdf',
                data: buffer.toString('base64'),
              },
            },
            {
              text: 'Extract the complete verbatim text of this Job Description PDF cleanly, preserving headings, bullet points, requirements, and company/title details.',
            },
          ],
        },
        config: {
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
        },
      }),
    );
    const extracted = (response.text || '').trim();
    if (!extracted) {
      throw new Error('Could not extract readable text from the uploaded Job Description PDF.');
    }
    return extracted;
  }

  if (isDocx) {
    const extracted = await mammoth.extractRawText({ buffer });
    if (!extracted.value.trim()) {
      throw new Error('The uploaded Job Description DOCX appears empty.');
    }
    return extracted.value.trim();
  }

  const text = buffer.toString('utf8').trim();
  if (!text) {
    throw new Error('The uploaded Job Description file appears empty.');
  }
  return text;
}

const jdAnalysisSchema = {
  type: Type.OBJECT,
  properties: {
    jobTitle: { type: Type.STRING },
    companyName: { type: Type.STRING },
    department: { type: Type.STRING },
    industry: { type: Type.STRING },
    seniority: { type: Type.STRING },
    requiredExperience: { type: Type.STRING },
    educationalRequirements: { type: Type.ARRAY, items: { type: Type.STRING } },
    requiredQualifications: { type: Type.ARRAY, items: { type: Type.STRING } },
    technicalSkills: { type: Type.ARRAY, items: { type: Type.STRING } },
    softwareAndErp: { type: Type.ARRAY, items: { type: Type.STRING } },
    jobResponsibilities: { type: Type.ARRAY, items: { type: Type.STRING } },
    procurementCategories: { type: Type.ARRAY, items: { type: Type.STRING } },
    purchasingProcesses: { type: Type.ARRAY, items: { type: Type.STRING } },
    importantAtsKeywords: { type: Type.ARRAY, items: { type: Type.STRING } },
    industryTerminology: { type: Type.ARRAY, items: { type: Type.STRING } },
    essentialRequirements: { type: Type.ARRAY, items: { type: Type.STRING } },
    preferredSkills: { type: Type.ARRAY, items: { type: Type.STRING } },
    mandatoryRequirements: { type: Type.ARRAY, items: { type: Type.STRING } },
    candidateGaps: { type: Type.ARRAY, items: { type: Type.STRING } },
    templateRecommendation: {
      type: Type.OBJECT,
      properties: {
        recommendedTemplateId: { type: Type.STRING },
        alternativeTemplateIds: { type: Type.ARRAY, items: { type: Type.STRING } },
        reason: { type: Type.STRING },
      },
      required: ['recommendedTemplateId', 'alternativeTemplateIds', 'reason'],
    },
  },
  required: [
    'jobTitle',
    'companyName',
    'department',
    'industry',
    'seniority',
    'requiredExperience',
    'educationalRequirements',
    'requiredQualifications',
    'technicalSkills',
    'softwareAndErp',
    'jobResponsibilities',
    'procurementCategories',
    'purchasingProcesses',
    'importantAtsKeywords',
    'industryTerminology',
    'essentialRequirements',
    'preferredSkills',
    'mandatoryRequirements',
    'candidateGaps',
    'templateRecommendation',
  ],
};

const VALID_TEMPLATE_IDS = new Set([
  'classic_professional',
  'modern_ats',
  'minimalist',
  'executive_professional',
  'compact_professional',
  'modern_business',
  'professional_blue',
  'elegant_grey',
  'clean_sidebar',
  'structured_two_column',
  'creative_modern',
  'contemporary',
  'premium_minimal',
  'bold_professional',
  'infographic_style',
  'procurement_executive',
  'supply_chain_logistics',
  'finance_accounts',
  'it_technical',
  'management_operations',
]);

export async function analyzeJobDescription(
  jdText: string,
  masterResume?: MasterResumeData,
): Promise<JobDescriptionAnalysis> {
  const ai = createGeminiClient();
  const model = getConfiguredModel();

  const masterContext = masterResume
    ? `\n\nCANDIDATE MASTER RESUME (compare honestly to populate candidateGaps with any missing mandatory/preferred requirements or experience gaps; do not invent strengths):\n${JSON.stringify(masterResume)}`
    : '\n\nNo candidate profile provided yet; leave candidateGaps as [].';

  const response = await withRetry(() =>
    ai.models.generateContent({
      model,
      contents: `Analyze this Job Description thoroughly.
Extract:
- jobTitle, companyName (use "Target Company" if not stated), department, industry, seniority (e.g., Executive, Analyst, Senior, Manager, Entry-Level).
- requiredExperience and educationalRequirements.
- requiredQualifications, technicalSkills, softwareAndErp (tools, ERP modules, systems).
- jobResponsibilities and recurring importantAtsKeywords.
- procurementCategories (if applicable, else []) and purchasingProcesses.
- industryTerminology: domain-specific terms and phrases used in this JD.
- essentialRequirements vs preferredSkills vs mandatoryRequirements.
- candidateGaps: concrete gaps between the Candidate Master Resume and the JD requirements.
- templateRecommendation: Pick the best primary template ID and 2 alternative template IDs from this exact list of 20 IDs:
  ATS-Friendly Professional: classic_professional, modern_ats, minimalist, executive_professional, compact_professional
  Modern Corporate: modern_business, professional_blue, elegant_grey, clean_sidebar, structured_two_column
  Creative: creative_modern, contemporary, premium_minimal, bold_professional, infographic_style
  Industry-Specific: procurement_executive, supply_chain_logistics, finance_accounts, it_technical, management_operations
  Guidance:
  - Purchase Executive -> procurement_executive or classic_professional
  - Procurement Buyer -> classic_professional or modern_ats
  - PO Management Analyst -> minimalist or modern_business
  - Senior Procurement Manager -> executive_professional
  - Supply Chain / Logistics -> supply_chain_logistics
  - Finance / Accounts -> finance_accounts
  - IT / Technical -> it_technical
  - Management / Operations -> management_operations
  - Creative / Design / Marketing -> creative_modern or contemporary
  Provide a concise 1-2 sentence explanation in reason explaining why the recommended template fits this job description and ATS profile.

JOB DESCRIPTION:
${jdText.slice(0, 30000)}${masterContext}`,
      config: {
        systemInstruction: SYSTEM_EXPERT_PERSONA,
        responseMimeType: 'application/json',
        responseSchema: jdAnalysisSchema,
        thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
      },
    }),
  );

  const parsed = parseJsonResponse<JobDescriptionAnalysis>(
    response.text,
    'job description analysis',
  );

  if (parsed.templateRecommendation) {
    const recId = VALID_TEMPLATE_IDS.has(parsed.templateRecommendation.recommendedTemplateId)
      ? parsed.templateRecommendation.recommendedTemplateId
      : 'classic_professional';
    const alts = (parsed.templateRecommendation.alternativeTemplateIds || []).filter((id) =>
      VALID_TEMPLATE_IDS.has(id) && id !== recId,
    );
    parsed.templateRecommendation = {
      recommendedTemplateId: recId,
      alternativeTemplateIds: alts.length > 0 ? alts.slice(0, 2) : ['modern_ats', 'minimalist'],
      reason:
        parsed.templateRecommendation.reason?.trim() ||
        'Recommended for clean ATS readability and strong section alignment with the target role.',
    };
  }

  return parsed;
}

// ---------------------------------------------------------------------------
// 3. RESUME MATCHING & TRANSFERABLE SKILLS MAPPING
// ---------------------------------------------------------------------------

const matchingSchema = {
  type: Type.OBJECT,
  properties: {
    relevantExperiences: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          companyName: { type: Type.STRING },
          jobTitle: { type: Type.STRING },
          relevanceScore: { type: Type.INTEGER },
          matchedResponsibilities: { type: Type.ARRAY, items: { type: Type.STRING } },
          transferableSkills: { type: Type.ARRAY, items: { type: Type.STRING } },
        },
        required: [
          'companyName',
          'jobTitle',
          'relevanceScore',
          'matchedResponsibilities',
          'transferableSkills',
        ],
      },
    },
    transferableSkillsSummary: { type: Type.ARRAY, items: { type: Type.STRING } },
    supportedKeywords: { type: Type.ARRAY, items: { type: Type.STRING } },
    unsupportedJdRequirements: { type: Type.ARRAY, items: { type: Type.STRING } },
  },
  required: [
    'relevantExperiences',
    'transferableSkillsSummary',
    'supportedKeywords',
    'unsupportedJdRequirements',
  ],
};

export async function matchResumeToJobDescription(
  masterResume: MasterResumeData,
  jdAnalysis: JobDescriptionAnalysis,
): Promise<ResumeMatchingResult> {
  const ai = createGeminiClient();
  const model = getConfiguredModel();

  const response = await withRetry(() =>
    ai.models.generateContent({
      model,
      contents: `Compare the candidate's verified Master Resume against the analyzed Job Description.
Identify:
1. For each role in employmentHistory, score relevance (0-100) and list which real responsibilities directly match or transfer to the JD.
2. Transferable skills (e.g., if the JD asks for Raw Material Purchase and the candidate has IT or Hospitality purchasing, highlight transferable procurement workflows like Vendor Identification, RFQ Management, Quotation Comparison, Commercial Evaluation, PO Management, Goods Receipt, Invoice Verification, SAP MM, Procure-to-Pay—WITHOUT claiming direct raw material purchasing experience).
3. supportedKeywords: JD keywords truthfully supported by the Master Resume.
4. unsupportedJdRequirements: JD requirements NOT evidenced in the Master Resume (these MUST NOT be fabricated in the resume).

MASTER RESUME JSON:
${JSON.stringify(masterResume)}

ANALYZED JD JSON:
${JSON.stringify(jdAnalysis)}`,
      config: {
        systemInstruction: SYSTEM_EXPERT_PERSONA,
        responseMimeType: 'application/json',
        responseSchema: matchingSchema,
        thinkingConfig: { thinkingLevel: ThinkingLevel.MEDIUM },
      },
    }),
  );

  return parseJsonResponse<ResumeMatchingResult>(response.text, 'resume matching');
}

// ---------------------------------------------------------------------------
// 4. TAILORED RESUME CONTENT GENERATION
// ---------------------------------------------------------------------------

const tailoredResumeSchema = {
  type: Type.OBJECT,
  properties: {
    personalInfo: {
      type: Type.OBJECT,
      properties: {
        fullName: { type: Type.STRING },
        firstName: { type: Type.STRING },
        lastName: { type: Type.STRING },
        email: { type: Type.STRING },
        phone: { type: Type.STRING },
        location: { type: Type.STRING },
        linkedin: { type: Type.STRING },
        portfolio: { type: Type.STRING },
      },
      required: ['fullName', 'firstName', 'lastName', 'email', 'phone', 'location', 'linkedin', 'portfolio'],
    },
    professionalTitle: { type: Type.STRING },
    professionalSummary: { type: Type.STRING },
    coreCompetencies: { type: Type.ARRAY, items: { type: Type.STRING } },
    professionalExperience: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          id: { type: Type.STRING },
          companyName: { type: Type.STRING },
          jobTitle: { type: Type.STRING },
          location: { type: Type.STRING },
          startDate: { type: Type.STRING },
          endDate: { type: Type.STRING },
          isCurrent: { type: Type.BOOLEAN },
          bullets: { type: Type.ARRAY, items: { type: Type.STRING } },
        },
        required: [
          'id',
          'companyName',
          'jobTitle',
          'location',
          'startDate',
          'endDate',
          'isCurrent',
          'bullets',
        ],
      },
    },
    technicalSkills: { type: Type.ARRAY, items: { type: Type.STRING } },
    erpAndSoftwareKnowledge: { type: Type.ARRAY, items: { type: Type.STRING } },
    educationalQualifications: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          id: { type: Type.STRING },
          institution: { type: Type.STRING },
          degree: { type: Type.STRING },
          fieldOfStudy: { type: Type.STRING },
          graduationDate: { type: Type.STRING },
          location: { type: Type.STRING },
          details: { type: Type.STRING },
        },
        required: ['id', 'institution', 'degree', 'fieldOfStudy', 'graduationDate', 'location', 'details'],
      },
    },
    certifications: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          id: { type: Type.STRING },
          name: { type: Type.STRING },
          issuer: { type: Type.STRING },
          date: { type: Type.STRING },
        },
        required: ['id', 'name', 'issuer', 'date'],
      },
    },
    languages: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          language: { type: Type.STRING },
          proficiency: { type: Type.STRING },
        },
        required: ['language', 'proficiency'],
      },
    },
  },
  required: [
    'personalInfo',
    'professionalTitle',
    'professionalSummary',
    'coreCompetencies',
    'professionalExperience',
    'technicalSkills',
    'erpAndSoftwareKnowledge',
    'educationalQualifications',
    'certifications',
    'languages',
  ],
};

function getModeInstructions(mode: GenerationMode): string {
  switch (mode) {
    case 'maximum_alignment':
      return `GENERATION MODE: Maximum JD Alignment.
Prioritize and lead with the candidate's most JD-relevant responsibilities and transferable processes in every role. Naturally weave supported JD terminology into the professional title, summary, core competencies, and bullet points without keyword stuffing or inventing any unsupported skills/domains.`;
    case 'conservative':
      return `GENERATION MODE: Conservative Resume.
Make minimal structural changes to the candidate's original Master Resume wording. Refine grammar, clarity, active-voice phrasing, and ATS readability while keeping bullet ordering and scope very close to the original Master Resume.`;
    case 'balanced':
    default:
      return `GENERATION MODE: Balanced Resume.
Create a well-rounded, natural, executive-ready resume that balances all verified experience while highlighting the strongest genuine alignment with the target job description.`;
  }
}

export async function generateTailoredResume(
  masterResume: MasterResumeData,
  jdAnalysis: JobDescriptionAnalysis,
  matchResult: ResumeMatchingResult,
  mode: GenerationMode,
): Promise<TailoredResumeContent> {
  const ai = createGeminiClient();
  const model = getConfiguredModel();

  const prompt = `Generate a tailored, high-alignment, ATS-friendly resume based strictly on the Master Resume and Matching Analysis.

${getModeInstructions(mode)}

PROACTIVE OPTIMIZATION DIRECTIVES:
- Rewrite the professional summary to target "${jdAnalysis.jobTitle}" cleanly using verified background strengths.
- Reorganize work experience bullets in each role so the most JD-relevant responsibilities appear first, and de-emphasize or trim distracting irrelevant details.
- Use strong professional action verbs and incorporate supported JD terminology naturally (never stuff keywords mechanically).
- Proactively surface verified specifics when relevant to the JD: e.g., Purchase Order Management, verified SAP MM / ERP usage, vendor coordination & quotation evaluation, Excel tracking/reporting, or invoice verification.
- Strictly separate actual professional work experience from training/certifications—NEVER present training-only knowledge as hands-on work experience.
- Distinguish personal execution from manager-led negotiation if noted in the Master Resume.

STRICT FACTUAL RULES (NON-NEGOTIABLE):
1. Copy personalInfo (fullName, firstName, lastName, email, phone, location, linkedin, portfolio) verbatim.
2. Copy every companyName, jobTitle, location, startDate, endDate, and isCurrent in chronological order verbatim from employmentHistory.
3. Copy educationalQualifications, certifications, and languages verbatim from the Master Resume.
4. NEVER invent percentages, cost savings, spend amounts, supplier counts, SAP transactions, software/ERP tools, or domain experience listed in unsupportedJdRequirements.
5. Customize professionalTitle and professionalSummary truthfully for "${jdAnalysis.jobTitle}".
6. Reorganize coreCompetencies, technicalSkills, and erpAndSoftwareKnowledge by relevance to the JD, using ONLY verified skills/tools from the Master Resume.
7. Use measurable achievements ONLY when explicitly supported by the Master Resume.

MASTER RESUME:
${JSON.stringify(masterResume)}

ANALYZED JD:
${JSON.stringify(jdAnalysis)}

MATCHING ANALYSIS:
${JSON.stringify(matchResult)}`;

  const response = await withRetry(() =>
    ai.models.generateContent({
      model,
      contents: prompt,
      config: {
        systemInstruction: SYSTEM_EXPERT_PERSONA,
        responseMimeType: 'application/json',
        responseSchema: tailoredResumeSchema,
        thinkingConfig: { thinkingLevel: ThinkingLevel.MEDIUM },
      },
    }),
  );

  const raw = parseJsonResponse<Omit<TailoredResumeContent, 'sectionOrder'>>(
    response.text,
    'resume generation',
  );
  const withOrder: TailoredResumeContent = {
    ...raw,
    sectionOrder: [...DEFAULT_SECTION_ORDER] as ResumeSectionKey[],
  };
  return enforceAndVerifyFactualAccuracy(masterResume, withOrder, { autoRestoreImmutable: true })
    .lockedResume;
}

// ---------------------------------------------------------------------------
// 5. AI FACTUAL AUDIT (Semantic Hallucination Check)
// ---------------------------------------------------------------------------

const aiFactualAuditSchema = {
  type: Type.OBJECT,
  properties: {
    hallucinationsDetected: { type: Type.BOOLEAN },
    violations: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          field: { type: Type.STRING },
          severity: { type: Type.STRING },
          message: { type: Type.STRING },
        },
        required: ['field', 'severity', 'message'],
      },
    },
  },
  required: ['hallucinationsDetected', 'violations'],
};

export async function runFactualVerificationPipeline(
  masterResume: MasterResumeData,
  tailoredResume: TailoredResumeContent,
): Promise<{ lockedResume: TailoredResumeContent; verification: FactualVerificationResult }> {
  const deterministic = enforceAndVerifyFactualAccuracy(masterResume, tailoredResume, {
    autoRestoreImmutable: true,
  });

  const ai = createGeminiClient();
  const model = getConfiguredModel();

  const response = await withRetry(() =>
    ai.models.generateContent({
      model,
      contents: `Audit the TAILORED RESUME against the MASTER RESUME for any invented or unsupported claims.
Check specifically for:
- Invented savings percentages, spend figures, or supplier counts not in the Master Resume.
- Claimed ERP/software expertise not present in the Master Resume.
- Training/coursework misrepresented as actual employment experience.
- Direct domain claims (e.g., claiming direct "raw material manufacturing procurement") when the Master Resume only shows indirect/IT/hospitality purchasing.
Set severity to "error" for clear fabrications or "warning" for borderline phrasing.

MASTER RESUME:
${JSON.stringify(masterResume)}

TAILORED RESUME:
${JSON.stringify(deterministic.lockedResume)}`,
      config: {
        systemInstruction: SYSTEM_EXPERT_PERSONA,
        responseMimeType: 'application/json',
        responseSchema: aiFactualAuditSchema,
        thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
      },
    }),
  );

  const aiAudit = parseJsonResponse<{
    hallucinationsDetected: boolean;
    violations: Array<{ field: string; severity: string; message: string }>;
  }>(response.text, 'factual verification audit');

  const combinedViolations = [...deterministic.verification.violations];
  for (const v of aiAudit.violations || []) {
    combinedViolations.push({
      field: v.field || 'content',
      severity: v.severity === 'error' ? 'error' : 'warning',
      message: v.message,
    });
  }

  return {
    lockedResume: deterministic.lockedResume,
    verification: {
      ...deterministic.verification,
      passed: !combinedViolations.some((v) => v.severity === 'error'),
      violations: combinedViolations,
    },
  };
}

// ---------------------------------------------------------------------------
// 6. INDEPENDENT SECOND-PASS AI RESUME REVIEWER
// ---------------------------------------------------------------------------

const reviewerOutputSchema = {
  type: Type.OBJECT,
  properties: {
    overallQuality: { type: Type.STRING },
    checks: {
      type: Type.OBJECT,
      properties: {
        matchesJd: { type: Type.BOOLEAN },
        summaryRelevant: { type: Type.BOOLEAN },
        keywordsIncludedNaturally: { type: Type.BOOLEAN },
        experienceAccuratelyRepresented: { type: Type.BOOLEAN },
        noInventedInformation: { type: Type.BOOLEAN },
        datesAndCompaniesUnchanged: { type: Type.BOOLEAN },
        atsFriendly: { type: Type.BOOLEAN },
        grammarAndFormattingProfessional: { type: Type.BOOLEAN },
      },
      required: [
        'matchesJd',
        'summaryRelevant',
        'keywordsIncludedNaturally',
        'experienceAccuratelyRepresented',
        'noInventedInformation',
        'datesAndCompaniesUnchanged',
        'atsFriendly',
        'grammarAndFormattingProfessional',
      ],
    },
    findings: { type: Type.ARRAY, items: { type: Type.STRING } },
    correctionsMade: { type: Type.ARRAY, items: { type: Type.STRING } },
    correctedResume: tailoredResumeSchema,
  },
  required: ['overallQuality', 'checks', 'findings', 'correctionsMade', 'correctedResume'],
};

export async function reviewAndPolishResume(
  masterResume: MasterResumeData,
  jdAnalysis: JobDescriptionAnalysis,
  tailoredResume: TailoredResumeContent,
  factualVerification: FactualVerificationResult,
): Promise<{ finalResume: TailoredResumeContent; reviewReport: ReviewerReport }> {
  const ai = createGeminiClient();
  const model = getConfiguredModel();

  const response = await withRetry(() =>
    ai.models.generateContent({
      model,
      contents: `You are an independent Senior Resume Quality Reviewer performing a separate second-pass inspection.
Review the DRAFT TAILORED RESUME against the MASTER RESUME, ANALYZED JD, and FACTUAL AUDIT FINDINGS.
Verify all 8 criteria:
1. Matches the JD meaningfully using genuine experience.
2. Professional summary is relevant and compelling.
3. Important supported ATS keywords are included naturally without stuffing.
4. Work experience is accurately represented without exaggeration.
5. Zero invented information (remove or rephrase any flagged factual violations immediately!).
6. Employment dates, job titles, and company names remain 100% unchanged from Master Resume.
7. ATS-friendly phrasing, clean bullet structure, strong action verbs.
8. Grammar, spelling, and professional tone are spotless.

Return the review checks, findings, list of correctionsMade, and the polished correctedResume.

MASTER RESUME:
${JSON.stringify(masterResume)}

ANALYZED JD:
${JSON.stringify(jdAnalysis)}

FACTUAL AUDIT VIOLATIONS TO FIX (if any):
${JSON.stringify(factualVerification.violations)}

DRAFT TAILORED RESUME:
${JSON.stringify(tailoredResume)}`,
      config: {
        systemInstruction: SYSTEM_EXPERT_PERSONA,
        responseMimeType: 'application/json',
        responseSchema: reviewerOutputSchema,
        thinkingConfig: { thinkingLevel: ThinkingLevel.MEDIUM },
      },
    }),
  );

  const result = parseJsonResponse<{
    overallQuality: 'excellent' | 'good' | 'needs_attention';
    checks: ReviewerReport['checks'];
    findings: string[];
    correctionsMade: string[];
    correctedResume: Omit<TailoredResumeContent, 'sectionOrder'>;
  }>(response.text, 'independent AI resume review');

  const mergedResume: TailoredResumeContent = {
    ...result.correctedResume,
    sectionOrder: tailoredResume.sectionOrder || [...DEFAULT_SECTION_ORDER],
  };

  // Final deterministic factual lock after reviewer edits
  const finalLocked = enforceAndVerifyFactualAccuracy(masterResume, mergedResume, {
    autoRestoreImmutable: true,
  });

  const quality: ReviewerReport['overallQuality'] =
    result.overallQuality === 'excellent' ||
    result.overallQuality === 'good' ||
    result.overallQuality === 'needs_attention'
      ? result.overallQuality
      : 'good';

  return {
    finalResume: finalLocked.lockedResume,
    reviewReport: {
      reviewedAt: new Date().toISOString(),
      overallQuality: quality,
      checks: result.checks,
      findings: Array.isArray(result.findings) ? result.findings : [],
      correctionsMade: Array.isArray(result.correctionsMade) ? result.correctionsMade : [],
    },
  };
}

// ---------------------------------------------------------------------------
// 7. WEIGHTED ATS SCORING ENGINE (6 CATEGORIES = 100%) + BASELINE & EXPLAINER
// ---------------------------------------------------------------------------

export interface BaselineAtsScore {
  originalAtsScore: number;
  categoryScores: Array<{ category: string; weight: number; score: number; notes: string }>;
  formattingIssues: string[];
}

const baselineAtsSchema = {
  type: Type.OBJECT,
  properties: {
    categoryScores: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          category: { type: Type.STRING },
          weight: { type: Type.INTEGER },
          score: { type: Type.INTEGER },
          notes: { type: Type.STRING },
        },
        required: ['category', 'weight', 'score', 'notes'],
      },
    },
    formattingIssues: { type: Type.ARRAY, items: { type: Type.STRING } },
  },
  required: ['categoryScores', 'formattingIssues'],
};

const ATS_WEIGHTED_CATEGORIES: Array<{ name: string; weight: number }> = [
  { name: 'Required skills and keyword match', weight: 25 },
  { name: 'Relevant work experience', weight: 25 },
  { name: 'Job responsibilities alignment', weight: 20 },
  { name: 'Technical skills and software', weight: 10 },
  { name: 'Education and qualifications', weight: 10 },
  { name: 'ATS formatting and readability', weight: 10 },
];

function computeWeightedScore(
  items: Array<{ weight: number; score: number }>,
): number {
  const totalWeight = items.reduce((acc, item) => acc + item.weight, 0);
  if (totalWeight <= 0) return 0;
  const weighted = items.reduce(
    (acc, item) => acc + (Math.max(0, Math.min(100, item.score)) * item.weight) / totalWeight,
    0,
  );
  return Math.max(0, Math.min(100, Math.round(weighted)));
}

export async function scoreOriginalMasterResume(
  masterResume: MasterResumeData,
  jdAnalysis: JobDescriptionAnalysis,
): Promise<BaselineAtsScore> {
  const ai = createGeminiClient();
  const model = getConfiguredModel();

  const response = await withRetry(() =>
    ai.models.generateContent({
      model,
      contents: `Evaluate the UN-TAILORED ORIGINAL MASTER RESUME against the ANALYZED JD across the exact 6 weighted ATS categories below.
Return a 0-100 score for each category honestly (do not inflate):
1. Required skills and keyword match (weight 25)
2. Relevant work experience (weight 25)
3. Job responsibilities alignment (weight 20)
4. Technical skills and software (weight 10)
5. Education and qualifications (weight 10)
6. ATS formatting and readability (weight 10)

Also identify any baseline formatting or structural issues (e.g., generic summary, unordered skills, weak action verbs, missing target role title).

ORIGINAL MASTER RESUME:
${JSON.stringify(masterResume)}

ANALYZED JD:
${JSON.stringify(jdAnalysis)}`,
      config: {
        systemInstruction: SYSTEM_EXPERT_PERSONA,
        responseMimeType: 'application/json',
        responseSchema: baselineAtsSchema,
        thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
      },
    }),
  );

  const parsed = parseJsonResponse<{
    categoryScores: Array<{ category: string; weight: number; score: number; notes: string }>;
    formattingIssues: string[];
  }>(response.text, 'baseline Master Resume ATS scoring');

  const normalized = ATS_WEIGHTED_CATEGORIES.map((cat, idx) => {
    const match =
      parsed.categoryScores?.find((c) =>
        c.category.toLowerCase().includes(cat.name.toLowerCase().slice(0, 14)),
      ) || parsed.categoryScores?.[idx];
    return {
      category: cat.name,
      weight: cat.weight,
      score: Math.max(0, Math.min(100, Math.round(match?.score ?? 50))),
      notes: (match?.notes || '').trim(),
    };
  });

  return {
    originalAtsScore: computeWeightedScore(normalized),
    categoryScores: normalized,
    formattingIssues: Array.isArray(parsed.formattingIssues) ? parsed.formattingIssues : [],
  };
}

const keywordExplanationItemSchema = {
  type: Type.OBJECT,
  properties: {
    keyword: { type: Type.STRING },
    category: { type: Type.STRING },
    significance: { type: Type.STRING },
    suggestion: { type: Type.STRING },
  },
  required: ['keyword', 'category', 'significance', 'suggestion'],
};

const categoryBreakdownItemSchema = {
  type: Type.OBJECT,
  properties: {
    category: { type: Type.STRING },
    weight: { type: Type.INTEGER },
    originalScore: { type: Type.INTEGER },
    tailoredScore: { type: Type.INTEGER },
    notes: { type: Type.STRING },
  },
  required: ['category', 'weight', 'originalScore', 'tailoredScore', 'notes'],
};

const changeItemSchema = {
  type: Type.OBJECT,
  properties: {
    section: { type: Type.STRING },
    change: { type: Type.STRING },
    reason: { type: Type.STRING },
  },
  required: ['section', 'change', 'reason'],
};

const atsAnalysisSchema = {
  type: Type.OBJECT,
  properties: {
    keywordMatchPercentage: { type: Type.INTEGER },
    skillsMatchPercentage: { type: Type.INTEGER },
    experienceRelevancePercentage: { type: Type.INTEGER },
    matchedKeywords: { type: Type.ARRAY, items: { type: Type.STRING } },
    partiallyMatchedKeywords: { type: Type.ARRAY, items: { type: Type.STRING } },
    missingKeywords: { type: Type.ARRAY, items: { type: Type.STRING } },
    missingMandatorySkills: { type: Type.ARRAY, items: { type: Type.STRING } },
    missingPreferredSkills: { type: Type.ARRAY, items: { type: Type.STRING } },
    formattingIssues: { type: Type.ARRAY, items: { type: Type.STRING } },
    categoryBreakdown: { type: Type.ARRAY, items: categoryBreakdownItemSchema },
    changesSummary: { type: Type.ARRAY, items: changeItemSchema },
    improvementRecommendations: { type: Type.ARRAY, items: { type: Type.STRING } },
    belowTargetExplanation: { type: Type.STRING },
    questionsForCandidate: { type: Type.ARRAY, items: { type: Type.STRING } },
    relevantExperienceHighlights: { type: Type.ARRAY, items: { type: Type.STRING } },
    transferableSkills: { type: Type.ARRAY, items: { type: Type.STRING } },
    skillsRequiringVerification: { type: Type.ARRAY, items: { type: Type.STRING } },
    keywordExplanations: {
      type: Type.ARRAY,
      items: keywordExplanationItemSchema,
    },
  },
  required: [
    'keywordMatchPercentage',
    'skillsMatchPercentage',
    'experienceRelevancePercentage',
    'matchedKeywords',
    'partiallyMatchedKeywords',
    'missingKeywords',
    'missingMandatorySkills',
    'missingPreferredSkills',
    'formattingIssues',
    'categoryBreakdown',
    'changesSummary',
    'improvementRecommendations',
    'belowTargetExplanation',
    'questionsForCandidate',
    'relevantExperienceHighlights',
    'transferableSkills',
    'skillsRequiringVerification',
    'keywordExplanations',
  ],
};

function normalizeKeywordCategory(cat: string): AtsKeywordExplanation['category'] {
  const lower = (cat || '').toLowerCase();
  if (lower === 'matched') return 'matched';
  if (lower === 'partial' || lower === 'partially_matched') return 'partial';
  return 'missing';
}

export async function analyzeAtsAlignment(
  masterResume: MasterResumeData,
  jdAnalysis: JobDescriptionAnalysis,
  finalResume: TailoredResumeContent,
  baseline?: BaselineAtsScore,
): Promise<AtsAnalysisResult> {
  const ai = createGeminiClient();
  const model = getConfiguredModel();

  const resolvedBaseline =
    baseline || (await scoreOriginalMasterResume(masterResume, jdAnalysis));

  const response = await withRetry(() =>
    ai.models.generateContent({
      model,
      contents: `Perform an honest, rigorous ATS compatibility analysis comparing the FINAL TAILORED RESUME against the ANALYZED JD, ORIGINAL MASTER RESUME, and BASELINE SCORES.

Evaluate the FINAL TAILORED RESUME across the EXACT 6 weighted categories (total = 100%):
1. Required skills and keyword match (weight: 25)
2. Relevant work experience (weight: 25)
3. Job responsibilities alignment (weight: 20)
4. Technical skills and software (weight: 10)
5. Education and qualifications (weight: 10)
6. ATS formatting and readability (weight: 10)

Rules:
- Be strictly honest and grounded. Never artificially inflate scores.
- Preserve the baseline originalScore values provided below for each category, and score tailoredScore (0-100) for the FINAL TAILORED RESUME.
- Calculate keywordMatchPercentage, skillsMatchPercentage, experienceRelevancePercentage (each 0-100).
- Separate missingMandatorySkills vs missingPreferredSkills.
- List any remaining formattingIssues (or [] if clean ATS single-column formatting).
- changesSummary: 4-7 concrete items explaining WHAT changed between the Master Resume and Tailored Resume and WHY (e.g., Summary rewritten, PO Management bullets prioritized, Skills reordered).
- improvementRecommendations: proactive recommendations to strengthen alignment further using verified facts.
- If the weighted tailored score is below 75%, set belowTargetExplanation explaining honestly why 75% cannot be crossed without inventing unverified qualifications; otherwise set belowTargetExplanation to "".
- questionsForCandidate: specific missing skills/experiences the candidate should confirm before adding (if they genuinely possess them).
- keywordExplanations: For EVERY keyword across matchedKeywords, partiallyMatchedKeywords, and missingKeywords (up to 18 total key terms), explain significance in this JD and provide strictly truthful incorporation guidance.

BASELINE SCORES:
${JSON.stringify(resolvedBaseline)}

MASTER RESUME:
${JSON.stringify(masterResume)}

ANALYZED JD:
${JSON.stringify(jdAnalysis)}

FINAL TAILORED RESUME:
${JSON.stringify(finalResume)}`,
      config: {
        systemInstruction: SYSTEM_EXPERT_PERSONA,
        responseMimeType: 'application/json',
        responseSchema: atsAnalysisSchema,
        thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
      },
    }),
  );

  const parsed = parseJsonResponse<{
    keywordMatchPercentage: number;
    skillsMatchPercentage: number;
    experienceRelevancePercentage: number;
    matchedKeywords: string[];
    partiallyMatchedKeywords: string[];
    missingKeywords: string[];
    missingMandatorySkills: string[];
    missingPreferredSkills: string[];
    formattingIssues: string[];
    categoryBreakdown: AtsCategoryScore[];
    changesSummary: AtsChangeItem[];
    improvementRecommendations: string[];
    belowTargetExplanation: string;
    questionsForCandidate: string[];
    relevantExperienceHighlights: string[];
    transferableSkills: string[];
    skillsRequiringVerification: string[];
    keywordExplanations: Array<{
      keyword: string;
      category: string;
      significance: string;
      suggestion: string;
    }>;
  }>(response.text, 'ATS optimization analysis');

  const categoryBreakdown: AtsCategoryScore[] = ATS_WEIGHTED_CATEGORIES.map((cat, idx) => {
    const baseItem = resolvedBaseline.categoryScores[idx];
    const aiItem =
      parsed.categoryBreakdown?.find((c) =>
        c.category.toLowerCase().includes(cat.name.toLowerCase().slice(0, 14)),
      ) || parsed.categoryBreakdown?.[idx];
    return {
      category: cat.name,
      weight: cat.weight,
      originalScore: baseItem?.score ?? Math.max(0, Math.min(100, Math.round(aiItem?.originalScore ?? 50))),
      tailoredScore: Math.max(0, Math.min(100, Math.round(aiItem?.tailoredScore ?? 65))),
      notes: (aiItem?.notes || baseItem?.notes || '').trim(),
    };
  });

  const finalScore = computeWeightedScore(
    categoryBreakdown.map((c) => ({ weight: c.weight, score: c.tailoredScore })),
  );

  const normalizedExplanations: AtsKeywordExplanation[] = Array.isArray(parsed.keywordExplanations)
    ? parsed.keywordExplanations
        .map((item) => ({
          keyword: (item.keyword || '').trim(),
          category: normalizeKeywordCategory(item.category),
          significance: (item.significance || '').trim(),
          suggestion: (item.suggestion || '').trim(),
        }))
        .filter((item) => item.keyword.length > 0)
    : [];

  return {
    estimatedAlignmentScore: finalScore,
    originalAtsScore: resolvedBaseline.originalAtsScore,
    keywordMatchPercentage: Math.max(0, Math.min(100, Math.round(parsed.keywordMatchPercentage || 0))),
    skillsMatchPercentage: Math.max(0, Math.min(100, Math.round(parsed.skillsMatchPercentage || 0))),
    experienceRelevancePercentage: Math.max(
      0,
      Math.min(100, Math.round(parsed.experienceRelevancePercentage || 0)),
    ),
    scoreDisclaimer:
      'Estimated ATS compatibility score calculated across 6 weighted categories (target > 75%). This is an estimate of content and structure alignment—not a guaranteed score from an employer ATS.',
    matchedKeywords: parsed.matchedKeywords || [],
    partiallyMatchedKeywords: parsed.partiallyMatchedKeywords || [],
    missingKeywords: parsed.missingKeywords || [],
    missingMandatorySkills: parsed.missingMandatorySkills || [],
    missingPreferredSkills: parsed.missingPreferredSkills || [],
    formattingIssues: parsed.formattingIssues || [],
    categoryBreakdown,
    changesSummary: Array.isArray(parsed.changesSummary) ? parsed.changesSummary : [],
    improvementRecommendations: Array.isArray(parsed.improvementRecommendations)
      ? parsed.improvementRecommendations
      : [],
    belowTargetExplanation: parsed.belowTargetExplanation?.trim() || null,
    questionsForCandidate: Array.isArray(parsed.questionsForCandidate)
      ? parsed.questionsForCandidate.filter((q) => q.trim().length > 0)
      : [],
    relevantExperienceHighlights: parsed.relevantExperienceHighlights || [],
    transferableSkills: parsed.transferableSkills || [],
    skillsRequiringVerification: parsed.skillsRequiringVerification || [],
    keywordExplanations: normalizedExplanations,
  };
}

// ---------------------------------------------------------------------------
// 8. PROACTIVE ATS IMPROVEMENT & TARGETED SECTION OPTIMIZATION
// ---------------------------------------------------------------------------

const proactiveImprovementSchema = {
  type: Type.OBJECT,
  properties: {
    improvementsApplied: { type: Type.ARRAY, items: { type: Type.STRING } },
    improvedResume: tailoredResumeSchema,
  },
  required: ['improvementsApplied', 'improvedResume'],
};

function getOptimizationDirective(action: OptimizationAction): string {
  switch (action) {
    case 'rewrite_summary':
      return `ACTION: Rewrite ONLY the professionalTitle and professionalSummary to maximize clarity, executive tone, and truthful alignment with the JD's essential requirements. Keep professionalExperience, technicalSkills, and erpAndSoftwareKnowledge intact.`;
    case 'optimize_experience':
      return `ACTION: Optimize ONLY the professionalExperience bullets. Reorder bullets inside each role so the most JD-relevant responsibilities come first, replace weak phrasing with strong action verbs, align supported JD terminology naturally, and remove distracting irrelevant filler. Never alter companyName, jobTitle, dates, or invent experience/metrics/SAP transactions.`;
    case 'optimize_skills':
      return `ACTION: Optimize ONLY coreCompetencies, technicalSkills, and erpAndSoftwareKnowledge. Prioritize and group verified skills/tools from the Master Resume that align with the JD's mandatory and technical requirements. Never add any tool or skill not evidenced in the Master Resume.`;
    case 'improve_ats':
    default:
      return `ACTION: Proactive Full ATS Optimization Pass. Examine every category scoring below target, partially matched keywords, and supported JD terminology. Strengthen the professionalTitle, professionalSummary, coreCompetencies, work experience bullet prioritization/wording, and skills ordering using ONLY verified Master Resume facts.`;
  }
}

export async function optimizeResumeSection(
  masterResume: MasterResumeData,
  jdAnalysis: JobDescriptionAnalysis,
  currentResume: TailoredResumeContent,
  atsAnalysis: AtsAnalysisResult,
  action: OptimizationAction,
): Promise<{ improvedResume: TailoredResumeContent; improvementsApplied: string[] }> {
  const ai = createGeminiClient();
  const model = getConfiguredModel();

  const response = await withRetry(() =>
    ai.models.generateContent({
      model,
      contents: `You are acting as a proactive ATS Resume Optimization Specialist.

${getOptimizationDirective(action)}

STRICT ACCURACY & INTEGRITY RULES:
1. NEVER invent employment history, companies, job titles, dates, education, or certifications.
2. NEVER invent SAP transactions, software tools, technical skills, cost savings, percentages, or procurement volumes.
3. NEVER present training-only or theoretical knowledge as professional work experience.
4. Preserve personalInfo, company names, job titles, dates, education, certifications, and languages verbatim from the Master Resume.
5. Only surface verified experience and transferable workflows genuinely present in the Master Resume.

CURRENT ATS SCORE: ${atsAnalysis.estimatedAlignmentScore}%
CATEGORY BREAKDOWN: ${JSON.stringify(atsAnalysis.categoryBreakdown || [])}
PARTIALLY MATCHED KEYWORDS: ${JSON.stringify(atsAnalysis.partiallyMatchedKeywords)}
MISSING KEYWORDS (do NOT invent if absent from Master Resume): ${JSON.stringify(atsAnalysis.missingKeywords)}

MASTER RESUME (SOURCE OF TRUTH):
${JSON.stringify(masterResume)}

ANALYZED JD:
${JSON.stringify(jdAnalysis)}

CURRENT TAILORED RESUME:
${JSON.stringify(currentResume)}`,
      config: {
        systemInstruction: SYSTEM_EXPERT_PERSONA,
        responseMimeType: 'application/json',
        responseSchema: proactiveImprovementSchema,
        thinkingConfig: { thinkingLevel: ThinkingLevel.MEDIUM },
      },
    }),
  );

  const parsed = parseJsonResponse<{
    improvementsApplied: string[];
    improvedResume: Omit<TailoredResumeContent, 'sectionOrder'>;
  }>(response.text, `resume optimization (${action})`);

  const merged: TailoredResumeContent = {
    ...parsed.improvedResume,
    sectionOrder: currentResume.sectionOrder || [...DEFAULT_SECTION_ORDER],
  };

  const locked = enforceAndVerifyFactualAccuracy(masterResume, merged, {
    autoRestoreImmutable: true,
  });

  return {
    improvedResume: locked.lockedResume,
    improvementsApplied: Array.isArray(parsed.improvementsApplied)
      ? parsed.improvementsApplied
      : [],
  };
}

export async function generateAtsKeywordExplanations(
  masterResume: MasterResumeData,
  jdAnalysis: JobDescriptionAnalysis,
  finalResume: TailoredResumeContent,
  atsAnalysis: AtsAnalysisResult,
): Promise<AtsKeywordExplanation[]> {
  const ai = createGeminiClient();
  const model = getConfiguredModel();

  const response = await withRetry(() =>
    ai.models.generateContent({
      model,
      contents: `Generate an ATS Keyword Explainer breakdown for the candidate's tailored resume and job description.
Cover all keywords listed under matchedKeywords, partiallyMatchedKeywords, and missingKeywords.
For each keyword:
- category must be "matched", "partial", or "missing".
- significance: explain clearly why recruiters and ATS parsers look for this term in the context of "${jdAnalysis.jobTitle}" (${jdAnalysis.industry}).
- suggestion: for "matched", confirm how it strengthens alignment; for "partial" or "missing", give actionable, strictly truthful guidance on how to surface genuine transferable or adjacent experience without inventing skills not in the Master Resume.

MATCHED KEYWORDS: ${JSON.stringify(atsAnalysis.matchedKeywords)}
PARTIALLY MATCHED KEYWORDS: ${JSON.stringify(atsAnalysis.partiallyMatchedKeywords)}
MISSING KEYWORDS: ${JSON.stringify(atsAnalysis.missingKeywords)}

MASTER RESUME:
${JSON.stringify(masterResume)}

FINAL TAILORED RESUME:
${JSON.stringify(finalResume)}`,
      config: {
        systemInstruction: SYSTEM_EXPERT_PERSONA,
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.ARRAY,
          items: keywordExplanationItemSchema,
        },
        thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
      },
    }),
  );

  const raw = parseJsonResponse<Array<{
    keyword: string;
    category: string;
    significance: string;
    suggestion: string;
  }>>(response.text, 'ATS keyword explanation');

  return (Array.isArray(raw) ? raw : [])
    .map((item) => ({
      keyword: (item.keyword || '').trim(),
      category: normalizeKeywordCategory(item.category),
      significance: (item.significance || '').trim(),
      suggestion: (item.suggestion || '').trim(),
    }))
    .filter((item) => item.keyword.length > 0);
}
