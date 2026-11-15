import type {
  FactualVerificationResult,
  FactualViolation,
  MasterResumeData,
  TailoredResumeContent,
} from '../types/resume.ts';
import { DEFAULT_SECTION_ORDER } from '../types/resume.ts';

function normalizeStr(val: string | undefined | null): string {
  return (val || '').trim().toLowerCase().replace(/\s+/g, ' ');
}

function extractNumericTokens(text: string): string[] {
  const matches = text.match(/(?:[$€£₹]\s*\d[\d,.]*(?:\s*[kmbKMB])?|\d+(?:\.\d+)?%)/g);
  return matches ? matches.map((m) => m.replace(/\s+/g, '').toLowerCase()) : [];
}

/**
 * Enforces deterministic locking of immutable Master Resume facts (name, contacts,
 * companies, job titles, employment dates, education, certifications) and audits
 * for any unverified metrics or dates.
 */
export function enforceAndVerifyFactualAccuracy(
  master: MasterResumeData,
  tailored: TailoredResumeContent,
  options: { autoRestoreImmutable?: boolean } = { autoRestoreImmutable: true },
): { lockedResume: TailoredResumeContent; verification: FactualVerificationResult } {
  const autoRestore = options.autoRestoreImmutable !== false;
  const violations: FactualViolation[] = [];
  const correctionsApplied: string[] = [];

  const locked: TailoredResumeContent = {
    ...tailored,
    personalInfo: { ...tailored.personalInfo },
    professionalExperience: tailored.professionalExperience.map((e) => ({
      ...e,
      bullets: [...e.bullets],
    })),
    educationalQualifications: [...tailored.educationalQualifications],
    certifications: [...tailored.certifications],
    languages: [...tailored.languages],
    sectionOrder:
      Array.isArray(tailored.sectionOrder) && tailored.sectionOrder.length > 0
        ? tailored.sectionOrder
        : [...DEFAULT_SECTION_ORDER],
  };

  // 1. Personal Info check
  const fullNameMatch =
    normalizeStr(locked.personalInfo.fullName) === normalizeStr(master.personalInfo.fullName);
  if (!fullNameMatch) {
    if (autoRestore) {
      locked.personalInfo.fullName = master.personalInfo.fullName;
      locked.personalInfo.firstName = master.personalInfo.firstName;
      locked.personalInfo.lastName = master.personalInfo.lastName;
      correctionsApplied.push('Restored full name to match Master Resume.');
    } else {
      violations.push({
        field: 'personalInfo.fullName',
        severity: 'error',
        message: `Full name "${locked.personalInfo.fullName}" differs from Master Resume "${master.personalInfo.fullName}".`,
      });
    }
  }

  const contactDetailsMatch =
    normalizeStr(locked.personalInfo.email) === normalizeStr(master.personalInfo.email) &&
    normalizeStr(locked.personalInfo.phone) === normalizeStr(master.personalInfo.phone);
  if (!contactDetailsMatch) {
    if (autoRestore) {
      locked.personalInfo.email = master.personalInfo.email;
      locked.personalInfo.phone = master.personalInfo.phone;
      locked.personalInfo.location = master.personalInfo.location;
      locked.personalInfo.linkedin = master.personalInfo.linkedin;
      locked.personalInfo.portfolio = master.personalInfo.portfolio;
      correctionsApplied.push('Restored contact details to match Master Resume.');
    } else {
      violations.push({
        field: 'personalInfo.contact',
        severity: 'error',
        message: 'Email or phone contact details differ from the Master Resume.',
      });
    }
  }

  // Always keep first/last name synchronized with master when autoRestore is enabled
  if (autoRestore) {
    locked.personalInfo.firstName = master.personalInfo.firstName;
    locked.personalInfo.lastName = master.personalInfo.lastName;
    locked.personalInfo.location = master.personalInfo.location;
    locked.personalInfo.linkedin = master.personalInfo.linkedin;
    locked.personalInfo.portfolio = master.personalInfo.portfolio;
  }

  // 2. Employment History: companies, titles, and dates must match Master Resume
  let companyNamesMatch = true;
  let employmentDatesMatch = true;
  let jobTitlesMatch = true;

  if (autoRestore) {
    const matchedByCompany = new Map<string, string[]>();
    for (const exp of locked.professionalExperience) {
      const key = `${normalizeStr(exp.companyName)}|${normalizeStr(exp.jobTitle)}`;
      matchedByCompany.set(key, exp.bullets);
    }

    const reconciledExperience = master.employmentHistory.map((mExp, index) => {
      const exactKey = `${normalizeStr(mExp.companyName)}|${normalizeStr(mExp.jobTitle)}`;
      let bullets = matchedByCompany.get(exactKey);

      if (!bullets) {
        // Fallback match by company name or index
        const byCompany = locked.professionalExperience.find(
          (e) => normalizeStr(e.companyName) === normalizeStr(mExp.companyName),
        );
        bullets = byCompany?.bullets ?? locked.professionalExperience[index]?.bullets;
      }

      if (!bullets || bullets.length === 0) {
        bullets = [...mExp.responsibilities, ...mExp.achievements].slice(0, 6);
      }

      // Check if AI drifted on dates/company/title before lock
      const aiCandidate = locked.professionalExperience.find(
        (e) =>
          normalizeStr(e.companyName) === normalizeStr(mExp.companyName) ||
          normalizeStr(e.jobTitle) === normalizeStr(mExp.jobTitle),
      );
      if (aiCandidate) {
        if (normalizeStr(aiCandidate.companyName) !== normalizeStr(mExp.companyName)) {
          correctionsApplied.push(`Locked company name "${mExp.companyName}".`);
        }
        if (normalizeStr(aiCandidate.jobTitle) !== normalizeStr(mExp.jobTitle)) {
          correctionsApplied.push(`Locked job title "${mExp.jobTitle}".`);
        }
        if (
          normalizeStr(aiCandidate.startDate) !== normalizeStr(mExp.startDate) ||
          normalizeStr(aiCandidate.endDate) !== normalizeStr(mExp.endDate)
        ) {
          correctionsApplied.push(
            `Locked employment dates (${mExp.startDate} – ${mExp.isCurrent ? 'Present' : mExp.endDate}) for ${mExp.companyName}.`,
          );
        }
      }

      return {
        id: mExp.id,
        companyName: mExp.companyName,
        jobTitle: mExp.jobTitle,
        location: mExp.location,
        startDate: mExp.startDate,
        endDate: mExp.isCurrent ? 'Present' : mExp.endDate,
        isCurrent: mExp.isCurrent,
        bullets,
      };
    });

    locked.professionalExperience = reconciledExperience;
  } else {
    // Strict audit mode (used after user manual edits)
    if (locked.professionalExperience.length !== master.employmentHistory.length) {
      companyNamesMatch = false;
      violations.push({
        field: 'professionalExperience',
        severity: 'error',
        message: 'Number of employment records does not match the Master Resume.',
      });
    }
    for (const mExp of master.employmentHistory) {
      const match = locked.professionalExperience.find(
        (e) =>
          normalizeStr(e.companyName) === normalizeStr(mExp.companyName) &&
          normalizeStr(e.jobTitle) === normalizeStr(mExp.jobTitle),
      );
      if (!match) {
        companyNamesMatch = false;
        jobTitlesMatch = false;
        violations.push({
          field: `professionalExperience.${mExp.companyName}`,
          severity: 'error',
          message: `Missing or altered role "${mExp.jobTitle}" at "${mExp.companyName}".`,
        });
      } else {
        const expectedEnd = mExp.isCurrent ? 'Present' : mExp.endDate;
        if (
          normalizeStr(match.startDate) !== normalizeStr(mExp.startDate) ||
          (normalizeStr(match.endDate) !== normalizeStr(expectedEnd) &&
            normalizeStr(match.endDate) !== normalizeStr(mExp.endDate))
        ) {
          employmentDatesMatch = false;
          violations.push({
            field: `professionalExperience.${mExp.companyName}.dates`,
            severity: 'error',
            message: `Employment dates for "${mExp.companyName}" must remain "${mExp.startDate} – ${expectedEnd}".`,
          });
        }
      }
    }
  }

  // 3. Education & Certifications
  let educationMatch = true;
  let certificationsMatch = true;

  if (autoRestore) {
    locked.educationalQualifications = master.education.map((ed) => ({ ...ed }));
    locked.certifications = master.certifications.map((c) => ({ ...c }));
    locked.languages = master.languages.map((l) => ({ ...l }));
  } else {
    if (locked.educationalQualifications.length !== master.education.length) {
      educationMatch = false;
      violations.push({
        field: 'educationalQualifications',
        severity: 'error',
        message: 'Education entries differ from the Master Resume.',
      });
    } else {
      for (const mEd of master.education) {
        const found = locked.educationalQualifications.some(
          (ed) =>
            normalizeStr(ed.institution) === normalizeStr(mEd.institution) &&
            normalizeStr(ed.degree) === normalizeStr(mEd.degree),
        );
        if (!found) {
          educationMatch = false;
          violations.push({
            field: 'educationalQualifications',
            severity: 'error',
            message: `Education "${mEd.degree}" at "${mEd.institution}" was altered or removed.`,
          });
        }
      }
    }

    if (locked.certifications.length !== master.certifications.length) {
      certificationsMatch = false;
      violations.push({
        field: 'certifications',
        severity: 'error',
        message: 'Certifications differ from the Master Resume.',
      });
    }
  }

  // 4. Audit for newly invented percentage or currency metrics not in Master Resume
  const masterFullText = JSON.stringify(master);
  const masterNumericTokens = new Set(extractNumericTokens(masterFullText));
  const tailoredBulletsAndSummary = [
    locked.professionalSummary,
    ...locked.professionalExperience.flatMap((e) => e.bullets),
  ].join(' ');
  const tailoredNumericTokens = extractNumericTokens(tailoredBulletsAndSummary);

  for (const token of tailoredNumericTokens) {
    if (!masterNumericTokens.has(token)) {
      violations.push({
        field: 'metrics',
        severity: 'warning',
        message: `Numeric metric "${token}" appears in the tailored text but was not found in your Master Resume. Please verify it is factual.`,
      });
    }
  }

  const hasErrors = violations.some((v) => v.severity === 'error');

  return {
    lockedResume: locked,
    verification: {
      passed: !hasErrors,
      checkedAt: new Date().toISOString(),
      immutableFieldsVerified: {
        fullNameMatch: autoRestore ? true : fullNameMatch,
        contactDetailsMatch: autoRestore ? true : contactDetailsMatch,
        companyNamesMatch: autoRestore ? true : companyNamesMatch,
        employmentDatesMatch: autoRestore ? true : employmentDatesMatch,
        jobTitlesMatch: autoRestore ? true : jobTitlesMatch,
        educationMatch: autoRestore ? true : educationMatch,
        certificationsMatch: autoRestore ? true : certificationsMatch,
      },
      violations,
      correctionsApplied,
    },
  };
}
