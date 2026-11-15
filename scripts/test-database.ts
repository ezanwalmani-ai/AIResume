import 'dotenv/config';
import assert from 'node:assert/strict';
import {
  deleteUserAccountData,
  getOrCreateUser,
  updateUserPreferences,
} from '../src/db/users.ts';
import {
  createGeneratedResume,
  createJobDescriptionRecord,
  getGeneratedResumeById,
  listJobDescriptionsByUserId,
  listResumeTemplatesFromDb,
  syncResumeTemplatesCatalog,
  updateGeneratedResumeById,
  upsertMasterResume,
} from '../src/db/resumes.ts';
import {
  createApplicationRecord,
  createCandidateDocument,
  createRecruiterRecord,
  deleteApplicationById,
  deleteCandidateDocumentById,
  deleteRecruiterById,
  executeUserAutomationRun,
  getAdminDatabaseOverview,
  getCandidateDocumentById,
  getCandidateProfileByUserId,
  listApplicationsByUserId,
  listAuditLogsByUserId,
  listAutomationRunsByUserId,
  listEmailMessagesByUserId,
  listJobListings,
  listRecruitersByUserId,
  recordConfirmedEmailMessage,
  syncCandidateProfileFromMasterData,
  updateApplicationById,
  upsertJobListing,
  upsertJobPreferences,
} from '../src/db/workspace.ts';
import {
  createSignedStorageToken,
  deletePrivateFile,
  readPrivateFile,
  savePrivateFile,
  verifySignedStorageToken,
} from '../src/server/storage.ts';
import { pool } from '../src/db/index.ts';
import { APPLICATION_STATUSES } from '../src/types/database.ts';
import type { MasterResumeData, TailoredResumeContent } from '../src/types/resume.ts';

async function runTests() {
  const runId = Date.now();
  const userAUid = `test_user_a_${runId}`;
  const userBUid = `test_user_b_${runId}`;
  const tempFiles: string[] = [];
  let userAId: number | null = null;
  let userBId: number | null = null;

  try {
    console.log('1. Testing user creation & preferences...');
    const userA = await getOrCreateUser(userAUid, `testa_${runId}@example.com`, 'Test Candidate A');
    const userB = await getOrCreateUser(userBUid, `testb_${runId}@example.com`, 'Test Candidate B');
    userAId = userA.id;
    userBId = userB.id;
    assert.equal(userA.role, 'user');
    assert.equal(userB.role, 'user');

    const updatedUserA = await updateUserPreferences(userA.id, {
      fullName: 'Ezan Test Candidate',
      phone: '+971-50-000-0000',
      defaultTemplate: 'modern_ats',
    });
    assert.equal(updatedUserA.fullName, 'Ezan Test Candidate');
    assert.equal(updatedUserA.phone, '+971-50-000-0000');

    console.log('2. Testing Master Resume & Candidate Profile sync...');
    const sampleMaster: MasterResumeData = {
      personalInfo: {
        fullName: 'Ezan Test Candidate',
        firstName: 'Ezan',
        lastName: 'Candidate',
        email: `testa_${runId}@example.com`,
        phone: '+971-50-000-0000',
        location: 'Dubai, UAE',
        linkedin: 'https://linkedin.com/in/ezan-test',
        portfolio: '',
      },
      headline: 'Senior Procurement Specialist',
      professionalSummary: 'Procurement specialist experienced in SAP MM, RFQ, and vendor management.',
      employmentHistory: [
        {
          id: 'exp-1',
          companyName: 'Emirates Supply Corp',
          jobTitle: 'Procurement Specialist',
          location: 'Dubai',
          startDate: '2021-01',
          endDate: 'Present',
          isCurrent: true,
          responsibilities: ['Managed supplier RFQ cycles and SAP MM purchase orders.'],
          achievements: ['Reduced vendor spend by 11% across direct categories.'],
          procurementCategories: ['Direct Materials', 'Indirect Services'],
          toolsAndErp: ['SAP MM', 'Excel'],
        },
      ],
      procurementExperience: ['Direct Procurement', 'P2P'],
      technicalSkills: ['Vendor Negotiation', 'Contract Management', 'Cost Reduction'],
      erpKnowledge: ['SAP MM', 'SAP Ariba'],
      education: [
        {
          id: 'edu-1',
          institution: 'University of Dubai',
          degree: 'BBA',
          fieldOfStudy: 'Supply Chain Management',
          graduationDate: '2020',
          location: 'Dubai',
          details: '',
        },
      ],
      certifications: [{ id: 'cert-1', name: 'CIPS Level 4', issuer: 'CIPS', date: '2022' }],
      languages: [{ language: 'English', proficiency: 'Fluent' }],
      additionalQualifications: [],
    };

    const savedMaster = await upsertMasterResume({
      userId: userA.id,
      originalFileName: 'master_cv.pdf',
      originalMimeType: 'application/pdf',
      fileSizeBytes: 2048,
      structuredData: sampleMaster,
      isApproved: true,
    });
    assert.equal(savedMaster.version, 1);

    await syncCandidateProfileFromMasterData(userA.id, sampleMaster);
    const profileA = await getCandidateProfileByUserId(userA.id);
    assert.ok(profileA);
    assert.equal(profileA.currentLocation, 'Dubai, UAE');
    assert.ok(profileA.softwareSkills.includes('SAP MM'));

    console.log('3. Testing private storage, signed tokens & cross-user document isolation...');
    const samplePdfBytes = Buffer.from('%PDF-1.4\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF');
    const savedFile = await savePrivateFile(
      `users/${userA.id}/uploads`,
      `test_cv_${runId}.pdf`,
      samplePdfBytes,
    );
    tempFiles.push(savedFile.storagePath);

    const readBack = await readPrivateFile(savedFile.storagePath);
    assert.ok(readBack && readBack.equals(samplePdfBytes));

    const signedToken = createSignedStorageToken({
      userId: userA.id,
      storagePath: savedFile.storagePath,
      fileName: `test_cv_${runId}.pdf`,
      mimeType: 'application/pdf',
    });
    const verifiedToken = verifySignedStorageToken(signedToken);
    assert.ok(verifiedToken && verifiedToken.storagePath === savedFile.storagePath);

    const docA = await createCandidateDocument({
      userId: userA.id,
      documentName: `test_cv_${runId}.pdf`,
      documentType: 'master_resume',
      storagePath: savedFile.storagePath,
      fileFormat: 'pdf',
      fileSize: savedFile.sizeBytes,
      isMasterResume: true,
      extractedText: 'Procurement Specialist SAP MM',
    });
    assert.ok(docA.id);

    // Cross-user isolation check: User B must NOT be able to read or delete User A's document
    const forbiddenDoc = await getCandidateDocumentById(docA.id, userB.id);
    assert.equal(forbiddenDoc, null);
    const forbiddenDocDelete = await deleteCandidateDocumentById(docA.id, userB.id);
    assert.equal(forbiddenDocDelete, null);

    console.log('4. Testing template catalog sync, job descriptions, generated resumes & ATS analysis...');
    await syncResumeTemplatesCatalog();
    const templates = await listResumeTemplatesFromDb();
    assert.ok(templates.length >= 20, `Expected >= 20 templates, got ${templates.length}`);

    const jdRecord = await createJobDescriptionRecord({
      userId: userA.id,
      companyName: 'Gulf Logistics Group',
      jobTitle: 'Senior Buyer',
      jobDescription: 'Seeking a Senior Buyer with SAP MM, RFQ management, and vendor negotiation.',
      requiredSkills: ['RFQ', 'Vendor Negotiation'],
      requiredKeywords: ['SAP MM', 'P2P'],
    });
    const userJds = await listJobDescriptionsByUserId(userA.id);
    assert.ok(userJds.some((j) => j.id === jdRecord.id));

    const tailoredContent: TailoredResumeContent = {
      personalInfo: sampleMaster.personalInfo,
      professionalTitle: 'Senior Buyer',
      professionalSummary: 'Results-driven Senior Buyer with deep SAP MM and RFQ experience.',
      coreCompetencies: ['Strategic Sourcing', 'SAP MM', 'RFQ Management'],
      professionalExperience: [
        {
          id: 'exp-1',
          companyName: 'Emirates Supply Corp',
          jobTitle: 'Procurement Specialist',
          location: 'Dubai',
          startDate: '2021-01',
          endDate: 'Present',
          isCurrent: true,
          bullets: ['Managed supplier RFQ cycles and SAP MM purchase orders.'],
        },
      ],
      technicalSkills: sampleMaster.technicalSkills,
      erpAndSoftwareKnowledge: sampleMaster.erpKnowledge,
      educationalQualifications: sampleMaster.education,
      certifications: sampleMaster.certifications,
      languages: sampleMaster.languages,
      sectionOrder: [
        'summary',
        'competencies',
        'experience',
        'technical_skills',
        'erp_knowledge',
        'education',
        'certifications',
        'languages',
      ],
    };

    const genResume = await createGeneratedResume({
      userId: userA.id,
      masterResumeId: savedMaster.id,
      jobDescriptionId: jdRecord.id,
      originalDocumentId: docA.id,
      jobTitle: 'Senior Buyer',
      companyName: 'Gulf Logistics Group',
      originalJd: jdRecord.jobDescription,
      jdAnalysis: {
        jobTitle: 'Senior Buyer',
        companyName: 'Gulf Logistics Group',
        industry: 'Logistics',
        requiredExperience: '5+ years',
        requiredQualifications: ['Bachelor degree'],
        technicalSkills: ['RFQ', 'Vendor Negotiation'],
        softwareAndErp: ['SAP MM'],
        jobResponsibilities: ['Execute RFQ and PO cycles'],
        procurementCategories: ['Logistics'],
        purchasingProcesses: ['P2P'],
        importantAtsKeywords: ['SAP MM', 'RFQ', 'P2P'],
        preferredSkills: ['CIPS'],
        mandatoryRequirements: ['SAP MM'],
      },
      generationMode: 'balanced',
      templateId: 'procurement_executive',
      tailoredResume: tailoredContent,
      pdfStoragePath: savedFile.storagePath,
      atsAnalysis: {
        estimatedAlignmentScore: 88,
        originalAtsScore: 66,
        keywordMatchPercentage: 90,
        skillsMatchPercentage: 85,
        experienceRelevancePercentage: 88,
        scoreDisclaimer: 'Estimated alignment',
        matchedKeywords: ['SAP MM', 'RFQ'],
        partiallyMatchedKeywords: ['P2P'],
        missingKeywords: [],
        relevantExperienceHighlights: ['Managed supplier RFQ cycles'],
        transferableSkills: ['Vendor Negotiation'],
        skillsRequiringVerification: [],
      },
      factualVerification: {
        passed: true,
        checkedAt: new Date().toISOString(),
        immutableFieldsVerified: {
          fullNameMatch: true,
          contactDetailsMatch: true,
          companyNamesMatch: true,
          employmentDatesMatch: true,
          jobTitlesMatch: true,
          educationMatch: true,
          certificationsMatch: true,
        },
        violations: [],
        correctionsApplied: [],
      },
      reviewReport: {
        reviewedAt: new Date().toISOString(),
        overallQuality: 'excellent',
        checks: {
          matchesJd: true,
          summaryRelevant: true,
          keywordsIncludedNaturally: true,
          experienceAccuratelyRepresented: true,
          noInventedInformation: true,
          datesAndCompaniesUnchanged: true,
          atsFriendly: true,
          grammarAndFormattingProfessional: true,
        },
        findings: [],
        correctionsMade: [],
      },
      aiModel: 'gemini-2.5-flash',
    });
    assert.equal(genResume.finalAtsScore, 88);

    // Switching template must NOT overwrite tailored content
    const switchedTemplate = await updateGeneratedResumeById({
      id: genResume.id,
      userId: userA.id,
      templateId: 'modern_ats',
    });
    assert.ok(switchedTemplate);
    assert.equal(switchedTemplate.templateId, 'modern_ats');
    assert.equal(switchedTemplate.tailoredResume.professionalSummary, tailoredContent.professionalSummary);

    // Cross-user isolation check on generated resumes
    const forbiddenResume = await getGeneratedResumeById(genResume.id, userB.id);
    assert.equal(forbiddenResume, null);

    console.log('5. Testing deduplicated jobs, recruiters, applications, emails & automation...');
    const jobUrl = `https://careers.example.com/jobs/${runId}`;
    const job1 = await upsertJobListing({
      companyName: 'Gulf Logistics Group',
      jobTitle: 'Senior Buyer',
      location: 'Dubai',
      jobDescription: jdRecord.jobDescription,
      jobUrl,
      source: 'test_suite',
    });
    const job2 = await upsertJobListing({
      companyName: 'Gulf Logistics Group',
      jobTitle: 'Senior Buyer',
      location: 'Abu Dhabi',
      jobDescription: jdRecord.jobDescription,
      jobUrl,
      source: 'test_suite',
    });
    assert.equal(job1.id, job2.id, 'Duplicate job URL must upsert cleanly via dedupe_key');

    const allJobs = await listJobListings();
    assert.ok(allJobs.some((j) => j.id === job1.id));

    const recruiter = await createRecruiterRecord({
      userId: userA.id,
      companyName: 'Gulf Logistics Group',
      recruiterName: 'Sara Al Mansoor',
      designation: 'TA Manager',
      professionalEmail: 'sara@gulflogistics.example',
      contactSource: 'user_provided',
      verificationStatus: 'verified',
    });
    assert.equal((await listRecruitersByUserId(userA.id)).length, 1);

    const appRecord = await createApplicationRecord({
      userId: userA.id,
      jobId: job1.id,
      recruiterId: recruiter.id,
      generatedResumeId: genResume.id,
      companyName: 'Gulf Logistics Group',
      jobTitle: 'Senior Buyer',
      applicationStatus: APPLICATION_STATUSES[3], // 'Resume Generated'
      applicationMethod: 'email',
    });
    assert.equal(appRecord.applicationStatus, 'Resume Generated');

    // Cross-user isolation on applications & recruiters
    const forbiddenAppUpdate = await updateApplicationById(appRecord.id, userB.id, {
      applicationStatus: 'Withdrawn',
    });
    assert.equal(forbiddenAppUpdate, null);
    assert.equal(await deleteApplicationById(appRecord.id, userB.id), false);
    assert.equal(await deleteRecruiterById(recruiter.id, userB.id), false);

    // Confirmed outbound email logging updates application to Email Sent
    const loggedEmail = await recordConfirmedEmailMessage({
      userId: userA.id,
      applicationId: appRecord.id,
      senderEmail: userA.email,
      recipientEmail: 'sara@gulflogistics.example',
      subject: 'Application for Senior Buyer',
      markApplicationSent: true,
    });
    assert.ok(loggedEmail);
    const updatedApps = await listApplicationsByUserId(userA.id);
    assert.equal(updatedApps[0]?.applicationStatus, 'Email Sent');
    assert.equal((await listEmailMessagesByUserId(userA.id)).length, 1);

    await upsertJobPreferences(userA.id, {
      targetRoles: ['Senior Buyer', 'Procurement Specialist'],
      minimumAtsScore: 75,
      dailySearchEnabled: true,
    });
    const runResult = await executeUserAutomationRun(userA.id);
    assert.equal(runResult.executionStatus, 'completed');
    assert.ok(runResult.jobsMatched >= 1);
    assert.ok((await listAutomationRunsByUserId(userA.id)).length >= 1);
    assert.ok((await listAuditLogsByUserId(userA.id)).length >= 3);

    console.log('6. Testing Admin Overview aggregation...');
    const adminOverview = await getAdminDatabaseOverview();
    assert.ok(adminOverview.totalUsers >= 2);
    assert.ok(adminOverview.totalTemplates >= 20);
    assert.ok(adminOverview.databaseSizeBytes > 0);

    console.log('ALL DATABASE INTEGRATION TESTS PASSED!');
  } finally {
    // Cleanup test user records & temporary files
    if (userAId !== null) {
      await deleteUserAccountData(userAId).catch(() => undefined);
    }
    if (userBId !== null) {
      await deleteUserAccountData(userBId).catch(() => undefined);
    }
    for (const filePath of tempFiles) {
      await deletePrivateFile(filePath).catch(() => undefined);
    }
    // Remove test job record if created
    await pool
      .query(`DELETE FROM jobs WHERE source = 'test_suite' AND job_url LIKE '%${runId}%'`)
      .catch(() => undefined);
    await pool.end();
  }
}

runTests().catch((err) => {
  console.error('Database integration test failed:', err);
  process.exit(1);
});
