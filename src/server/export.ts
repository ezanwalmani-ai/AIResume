import PDFDocument from 'pdfkit';
import mammoth from 'mammoth';
import {
  AlignmentType,
  BorderStyle,
  Document,
  HeadingLevel,
  Packer,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from 'docx';
import {
  getEffectiveSectionOrder,
  getTemplateDefinition,
  resolveTemplateCustomization,
} from '../lib/templates.ts';
import type {
  ExportValidationReport,
  ResumeSectionKey,
  ResumeTemplateId,
  TailoredResumeContent,
  TemplateCustomization,
} from '../types/resume.ts';

function sanitizeFilenamePart(value: string, fallback: string): string {
  const cleaned = (value || '')
    .trim()
    .replace(/[^a-zA-Z0-9\s-]/g, '')
    .replace(/\s+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');
  return cleaned || fallback;
}

export function buildResumeDownloadFilename(
  resume: TailoredResumeContent,
  jobTitle: string,
  companyName: string,
  ext: 'pdf' | 'docx',
): string {
  const parts = (resume.personalInfo.fullName || '').trim().split(/\s+/).filter(Boolean);
  const first = sanitizeFilenamePart(resume.personalInfo.firstName || parts[0] || '', 'Candidate');
  const last = sanitizeFilenamePart(
    resume.personalInfo.lastName || parts.slice(1).join('_') || '',
    'Resume',
  );
  const title = sanitizeFilenamePart(jobTitle || resume.professionalTitle, 'Role');
  const company = sanitizeFilenamePart(companyName, 'Company');
  return `${first}_${last}_${title}_${company}.${ext}`;
}

function getContactLine(resume: TailoredResumeContent): string {
  const p = resume.personalInfo;
  return [p.email, p.phone, p.location, p.linkedin, p.portfolio]
    .map((v) => (v || '').trim())
    .filter(Boolean)
    .join('  |  ');
}

function stripHexHash(hex: string): string {
  return (hex || '#0F172A').replace('#', '').toUpperCase();
}

function resolveMetrics(cfg: TemplateCustomization) {
  const marginPt =
    cfg.pageMargin === 'narrow' ? 36 : cfg.pageMargin === 'wide' ? 58 : 46;
  const marginTwip =
    cfg.pageMargin === 'narrow' ? 540 : cfg.pageMargin === 'wide' ? 920 : 720;

  const baseFontPt =
    cfg.fontSize === 'compact' ? 9 : cfg.fontSize === 'large' ? 10.5 : 9.6;
  const baseHalfPt =
    cfg.fontSize === 'compact' ? 18 : cfg.fontSize === 'large' ? 21 : 19;

  const lineGapPt =
    cfg.lineSpacing === 'tight' ? 1.1 : cfg.lineSpacing === 'airy' ? 2.6 : 1.7;
  const sectionSpaceRatio =
    cfg.sectionSpacing === 'compact' ? 0.4 : cfg.sectionSpacing === 'relaxed' ? 0.85 : 0.6;
  const sectionBeforeTwip =
    cfg.sectionSpacing === 'compact' ? 120 : cfg.sectionSpacing === 'relaxed' ? 240 : 170;

  const pdfHeadingFont =
    cfg.fontFamily === 'serif' || cfg.fontFamily === 'georgia_sans'
      ? 'Times-Bold'
      : 'Helvetica-Bold';
  const pdfBodyFont = cfg.fontFamily === 'serif' ? 'Times-Roman' : 'Helvetica';
  const pdfDateFont = cfg.fontFamily === 'mono_accent' ? 'Courier' : pdfBodyFont;

  const docxHeadingFont =
    cfg.fontFamily === 'serif' || cfg.fontFamily === 'georgia_sans' ? 'Georgia' : 'Calibri';
  const docxBodyFont = cfg.fontFamily === 'serif' ? 'Georgia' : 'Calibri';

  return {
    marginPt,
    marginTwip,
    baseFontPt,
    baseHalfPt,
    lineGapPt,
    sectionSpaceRatio,
    sectionBeforeTwip,
    pdfHeadingFont,
    pdfBodyFont,
    pdfDateFont,
    docxHeadingFont,
    docxBodyFont,
  };
}

const SECTION_TITLES: Record<ResumeSectionKey, string> = {
  summary: 'Professional Summary',
  competencies: 'Core Competencies',
  experience: 'Professional Experience',
  technical_skills: 'Technical Skills',
  erp_knowledge: 'ERP & Software Knowledge',
  education: 'Educational Qualifications',
  certifications: 'Certifications',
  languages: 'Languages',
};

const SIDEBAR_SECTIONS = new Set<ResumeSectionKey>([
  'competencies',
  'technical_skills',
  'erp_knowledge',
  'education',
  'certifications',
  'languages',
]);

// ---------------------------------------------------------------------------
// SELECTABLE-TEXT PDF GENERATION (PDFKit — Supports All 20 Templates + Customizer)
// ---------------------------------------------------------------------------

export async function generateResumePdf(
  resume: TailoredResumeContent,
  templateId: ResumeTemplateId = 'classic_professional',
  customization?: Partial<TemplateCustomization> | null,
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    try {
      const cfg = resolveTemplateCustomization(templateId, customization);
      const metrics = resolveMetrics(cfg);

      const doc = new PDFDocument({
        size: 'LETTER',
        margins: {
          top: metrics.marginPt,
          bottom: metrics.marginPt,
          left: metrics.marginPt,
          right: metrics.marginPt,
        },
        compress: false, // keep streams readable for deterministic text validation
        info: {
          Title: `${resume.personalInfo.fullName} - ${resume.professionalTitle}`,
          Author: resume.personalInfo.fullName,
          Creator: 'ResumeAI',
        },
      });

      const chunks: Buffer[] = [];
      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', (err: Error) => reject(err));

      const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
      const startX = doc.page.margins.left;
      const primary = cfg.primaryColor || '#0F172A';
      const secondary = cfg.secondaryColor || '#475569';
      const centered = cfg.headerStyle === 'centered';

      const ensureSpaceInColumn = (neededPoints: number, colX: number) => {
        if (doc.y + neededPoints > doc.page.height - doc.page.margins.bottom) {
          doc.addPage();
          doc.x = colX;
        }
      };

      const renderSectionHeading = (title: string, colX: number, colWidth: number) => {
        ensureSpaceInColumn(34, colX);
        doc.moveDown(metrics.sectionSpaceRatio);
        const y = doc.y;

        if (cfg.headingStyle === 'solid_banner') {
          doc.save();
          doc.rect(colX, y - 2, colWidth, 16).fill(primary);
          doc.restore();
          doc
            .font(metrics.pdfHeadingFont)
            .fontSize(metrics.baseFontPt)
            .fillColor('#FFFFFF')
            .text(title.toUpperCase(), colX + 6, y + 1, {
              width: colWidth - 12,
              characterSpacing: 0.7,
            });
          doc.y = y + 18;
          doc.x = colX;
          return;
        }

        if (cfg.headingStyle === 'left_bar') {
          doc.save();
          doc.rect(colX, y, 3, 12).fill(primary);
          doc.restore();
          doc
            .font(metrics.pdfHeadingFont)
            .fontSize(metrics.baseFontPt + 0.5)
            .fillColor(primary)
            .text(title.toUpperCase(), colX + 8, y, {
              width: colWidth - 8,
              characterSpacing: 0.6,
            });
          doc.moveDown(0.28);
          doc.x = colX;
          return;
        }

        if (cfg.headingStyle === 'accent_tag') {
          doc
            .font(metrics.pdfHeadingFont)
            .fontSize(metrics.baseFontPt + 0.4)
            .fillColor(primary)
            .text(title.toUpperCase(), colX, y, {
              width: colWidth,
              characterSpacing: 0.9,
            });
          const ruleY = doc.y + 2;
          doc
            .moveTo(colX, ruleY)
            .lineTo(colX + Math.min(48, colWidth), ruleY)
            .lineWidth(2)
            .strokeColor(primary)
            .stroke();
          doc.moveDown(0.32);
          doc.x = colX;
          return;
        }

        // uppercase_rule or clean_underline
        doc
          .font(metrics.pdfHeadingFont)
          .fontSize(metrics.baseFontPt + 0.5)
          .fillColor(primary)
          .text(title.toUpperCase(), colX, y, {
            width: colWidth,
            characterSpacing: 0.65,
          });
        const lineY = doc.y + 2;
        doc
          .moveTo(colX, lineY)
          .lineTo(colX + colWidth, lineY)
          .lineWidth(cfg.headingStyle === 'uppercase_rule' ? 1.1 : 0.6)
          .strokeColor(cfg.headingStyle === 'uppercase_rule' ? primary : '#CBD5E1')
          .stroke();
        doc.moveDown(0.32);
        doc.x = colX;
      };

      const renderBullet = (text: string, colX: number, colWidth: number) => {
        ensureSpaceInColumn(22, colX);
        const bulletIndent = 11;
        const currentY = doc.y;
        doc
          .font(metrics.pdfBodyFont)
          .fontSize(metrics.baseFontPt)
          .fillColor(primary)
          .text('•', colX + 2, currentY, { lineBreak: false });
        doc
          .font(metrics.pdfBodyFont)
          .fontSize(metrics.baseFontPt)
          .fillColor('#1E293B')
          .text(text, colX + bulletIndent, currentY, {
            width: colWidth - bulletIndent,
            lineGap: metrics.lineGapPt,
          });
        doc.moveDown(0.12);
        doc.x = colX;
      };

      // --- HEADER RENDERING (Strictly inside document body, never PDF page header) ---
      const headerTopY = doc.y;
      if (cfg.headerStyle === 'top_accent_bar') {
        doc
          .moveTo(startX, headerTopY - 6)
          .lineTo(startX + pageWidth, headerTopY - 6)
          .lineWidth(3)
          .strokeColor(primary)
          .stroke();
        doc.moveDown(0.2);
      } else if (cfg.headerStyle === 'dark_banner') {
        const bannerHeight = resume.professionalTitle ? 66 : 52;
        doc.save();
        doc.rect(startX, headerTopY - 4, pageWidth, bannerHeight).fill(primary);
        doc.restore();
        doc
          .font(metrics.pdfHeadingFont)
          .fontSize(20)
          .fillColor('#FFFFFF')
          .text(resume.personalInfo.fullName || 'Candidate Name', startX + 14, headerTopY + 6, {
            width: pageWidth - 28,
          });
        if (resume.professionalTitle) {
          doc
            .font(metrics.pdfBodyFont)
            .fontSize(11)
            .fillColor('#E2E8F0')
            .text(resume.professionalTitle, startX + 14, doc.y + 1, {
              width: pageWidth - 28,
            });
        }
        const contact = getContactLine(resume);
        if (contact) {
          doc
            .font(metrics.pdfBodyFont)
            .fontSize(8.4)
            .fillColor('#CBD5E1')
            .text(contact, startX + 14, doc.y + 3, {
              width: pageWidth - 28,
            });
        }
        doc.y = headerTopY + bannerHeight + 6;
        doc.x = startX;
      } else if (cfg.headerStyle === 'tinted_band') {
        const bandHeight = 60;
        doc.save();
        doc.rect(startX, headerTopY - 4, pageWidth, bandHeight).fill('#F8FAFC');
        doc
          .moveTo(startX, headerTopY - 4)
          .lineTo(startX, headerTopY - 4 + bandHeight)
          .lineWidth(3)
          .strokeColor(primary)
          .stroke();
        doc.restore();
        doc
          .font(metrics.pdfHeadingFont)
          .fontSize(19)
          .fillColor('#0F172A')
          .text(resume.personalInfo.fullName || 'Candidate Name', startX + 12, headerTopY + 4, {
            width: pageWidth - 24,
          });
        if (resume.professionalTitle) {
          doc
            .font(metrics.pdfHeadingFont)
            .fontSize(10.8)
            .fillColor(primary)
            .text(resume.professionalTitle, startX + 12, doc.y + 1, {
              width: pageWidth - 24,
            });
        }
        const contact = getContactLine(resume);
        if (contact) {
          doc
            .font(metrics.pdfBodyFont)
            .fontSize(8.5)
            .fillColor(secondary)
            .text(contact, startX + 12, doc.y + 3, {
              width: pageWidth - 24,
            });
        }
        doc.y = headerTopY + bandHeight + 6;
        doc.x = startX;
      }

      if (cfg.headerStyle !== 'dark_banner' && cfg.headerStyle !== 'tinted_band') {
        const initials = (resume.personalInfo.fullName || 'C')
          .split(/\s+/)
          .map((p) => p[0] || '')
          .join('')
          .slice(0, 2)
          .toUpperCase();
        const textWidth = cfg.showPhoto && !centered ? pageWidth - 52 : pageWidth;

        if (cfg.showPhoto && !centered) {
          doc.save();
          doc.roundedRect(startX, doc.y, 40, 40, 4).fill('#F1F5F9');
          doc
            .font(metrics.pdfHeadingFont)
            .fontSize(13)
            .fillColor(primary)
            .text(initials, startX, doc.y + 13, { width: 40, align: 'center' });
          doc.restore();
        }

        const headerTextX = cfg.showPhoto && !centered ? startX + 50 : startX;
        doc
          .font(metrics.pdfHeadingFont)
          .fontSize(20)
          .fillColor('#0F172A')
          .text(resume.personalInfo.fullName || 'Candidate Name', headerTextX, headerTopY, {
            width: textWidth,
            align: centered ? 'center' : 'left',
          });

        if (resume.professionalTitle) {
          doc
            .font(metrics.pdfHeadingFont)
            .fontSize(11)
            .fillColor(primary)
            .text(resume.professionalTitle, headerTextX, doc.y + 1, {
              width: textWidth,
              align: centered ? 'center' : 'left',
            });
        }

        const contactLine = getContactLine(resume);
        if (contactLine) {
          doc
            .font(metrics.pdfBodyFont)
            .fontSize(8.6)
            .fillColor(secondary)
            .text(contactLine, headerTextX, doc.y + 3, {
              width: textWidth,
              align: centered ? 'center' : 'left',
            });
        }

        if (cfg.headerStyle === 'split_box') {
          const ruleY = doc.y + 6;
          doc
            .moveTo(startX, ruleY)
            .lineTo(startX + pageWidth, ruleY)
            .lineWidth(1.6)
            .strokeColor(primary)
            .stroke();
          doc.y = ruleY + 6;
        }
        doc.x = startX;
      }

      const renderSectionContent = (
        section: ResumeSectionKey,
        colX: number,
        colWidth: number,
      ) => {
        switch (section) {
          case 'summary':
            if (!resume.professionalSummary?.trim()) break;
            renderSectionHeading(SECTION_TITLES.summary, colX, colWidth);
            doc
              .font(metrics.pdfBodyFont)
              .fontSize(metrics.baseFontPt)
              .fillColor('#1E293B')
              .text(resume.professionalSummary, colX, doc.y, {
                width: colWidth,
                lineGap: metrics.lineGapPt,
              });
            doc.x = colX;
            break;

          case 'competencies':
            if (!resume.coreCompetencies?.length) break;
            renderSectionHeading(SECTION_TITLES.competencies, colX, colWidth);
            if (cfg.showSkillBars) {
              for (const comp of resume.coreCompetencies.slice(0, 6)) {
                ensureSpaceInColumn(18, colX);
                doc
                  .font(metrics.pdfBodyFont)
                  .fontSize(metrics.baseFontPt - 0.3)
                  .fillColor('#1E293B')
                  .text(comp, colX, doc.y, { width: colWidth });
                const barY = doc.y + 2;
                doc.save();
                doc.rect(colX, barY, colWidth, 3).fill('#E2E8F0');
                doc.rect(colX, barY, colWidth * 0.85, 3).fill(primary);
                doc.restore();
                doc.y = barY + 6;
                doc.x = colX;
              }
            } else {
              doc
                .font(metrics.pdfBodyFont)
                .fontSize(metrics.baseFontPt)
                .fillColor('#1E293B')
                .text(resume.coreCompetencies.join('   •   '), colX, doc.y, {
                  width: colWidth,
                  lineGap: metrics.lineGapPt,
                });
              doc.x = colX;
            }
            break;

          case 'experience':
            if (!resume.professionalExperience?.length) break;
            renderSectionHeading(SECTION_TITLES.experience, colX, colWidth);
            for (const exp of resume.professionalExperience) {
              ensureSpaceInColumn(48, colX);
              const dateRange = `${exp.startDate} – ${exp.isCurrent ? 'Present' : exp.endDate}`;
              const roleLine = `${exp.jobTitle} — ${exp.companyName}${
                exp.location ? `, ${exp.location}` : ''
              }`;

              const rowY = doc.y;
              const dateReserve = colWidth > 320 ? 122 : 95;
              doc
                .font(metrics.pdfHeadingFont)
                .fontSize(metrics.baseFontPt + 0.4)
                .fillColor('#0F172A')
                .text(roleLine, colX, rowY, {
                  width: colWidth - dateReserve - 6,
                });
              const afterRoleY = doc.y;
              doc
                .font(metrics.pdfDateFont)
                .fontSize(metrics.baseFontPt - 0.8)
                .fillColor(secondary)
                .text(dateRange, colX + colWidth - dateReserve, rowY, {
                  width: dateReserve,
                  align: 'right',
                });
              doc.y = Math.max(afterRoleY, doc.y) + 2;
              doc.x = colX;

              for (const bullet of exp.bullets || []) {
                if (bullet.trim()) {
                  renderBullet(bullet.trim(), colX, colWidth);
                }
              }
              doc.moveDown(0.24);
              doc.x = colX;
            }
            break;

          case 'technical_skills':
            if (!resume.technicalSkills?.length) break;
            renderSectionHeading(SECTION_TITLES.technical_skills, colX, colWidth);
            doc
              .font(metrics.pdfBodyFont)
              .fontSize(metrics.baseFontPt)
              .fillColor('#1E293B')
              .text(resume.technicalSkills.join(', '), colX, doc.y, {
                width: colWidth,
                lineGap: metrics.lineGapPt,
              });
            doc.x = colX;
            break;

          case 'erp_knowledge':
            if (!resume.erpAndSoftwareKnowledge?.length) break;
            renderSectionHeading(SECTION_TITLES.erp_knowledge, colX, colWidth);
            doc
              .font(metrics.pdfBodyFont)
              .fontSize(metrics.baseFontPt)
              .fillColor('#1E293B')
              .text(resume.erpAndSoftwareKnowledge.join(', '), colX, doc.y, {
                width: colWidth,
                lineGap: metrics.lineGapPt,
              });
            doc.x = colX;
            break;

          case 'education':
            if (!resume.educationalQualifications?.length) break;
            renderSectionHeading(SECTION_TITLES.education, colX, colWidth);
            for (const edu of resume.educationalQualifications) {
              ensureSpaceInColumn(28, colX);
              const title = [edu.degree, edu.fieldOfStudy].filter(Boolean).join(' in ');
              const meta = [edu.institution, edu.location, edu.graduationDate]
                .filter(Boolean)
                .join('  |  ');
              doc
                .font(metrics.pdfHeadingFont)
                .fontSize(metrics.baseFontPt + 0.1)
                .fillColor('#0F172A')
                .text(title || edu.institution, colX, doc.y, { width: colWidth });
              if (meta) {
                doc
                  .font(metrics.pdfBodyFont)
                  .fontSize(metrics.baseFontPt - 0.6)
                  .fillColor(secondary)
                  .text(meta, colX, doc.y, { width: colWidth });
              }
              if (edu.details) {
                doc
                  .font(metrics.pdfBodyFont)
                  .fontSize(metrics.baseFontPt - 0.6)
                  .fillColor('#334155')
                  .text(edu.details, colX, doc.y, { width: colWidth });
              }
              doc.moveDown(0.2);
              doc.x = colX;
            }
            break;

          case 'certifications':
            if (!resume.certifications?.length) break;
            renderSectionHeading(SECTION_TITLES.certifications, colX, colWidth);
            for (const cert of resume.certifications) {
              const line = [cert.name, cert.issuer, cert.date].filter(Boolean).join(' — ');
              if (line) renderBullet(line, colX, colWidth);
            }
            break;

          case 'languages':
            if (!resume.languages?.length) break;
            renderSectionHeading(SECTION_TITLES.languages, colX, colWidth);
            doc
              .font(metrics.pdfBodyFont)
              .fontSize(metrics.baseFontPt)
              .fillColor('#1E293B')
              .text(
                resume.languages
                  .map((l) => (l.proficiency ? `${l.language} (${l.proficiency})` : l.language))
                  .join('   |   '),
                colX,
                doc.y,
                { width: colWidth },
              );
            doc.x = colX;
            break;
        }
      };

      const sectionOrder = getEffectiveSectionOrder(resume.sectionOrder, templateId);

      if (cfg.layout === 'single_column') {
        for (const section of sectionOrder) {
          renderSectionContent(section, startX, pageWidth);
        }
      } else {
        // Two-column layout: place main sections & sidebar sections cleanly without overlap
        const gap = 18;
        const sidebarWidth = Math.round(pageWidth * 0.32);
        const mainWidth = pageWidth - sidebarWidth - gap;
        const isLeftSidebar = cfg.layout === 'two_column_left';
        const sidebarX = isLeftSidebar ? startX : startX + mainWidth + gap;
        const mainX = isLeftSidebar ? startX + sidebarWidth + gap : startX;

        const columnsTopY = doc.y + 4;
        const sidebarSections = sectionOrder.filter((s) => SIDEBAR_SECTIONS.has(s));
        const mainSections = sectionOrder.filter((s) => !SIDEBAR_SECTIONS.has(s));

        // Render primary column first (may span pages naturally)
        doc.y = columnsTopY;
        doc.x = mainX;
        for (const section of mainSections) {
          renderSectionContent(section, mainX, mainWidth);
        }

        // Return to page 1 top for sidebar column if sidebar fits on page 1, or switch cleanly
        const currentPageIndex = doc.bufferedPageRange().count;
        if (currentPageIndex === 1) {
          doc.y = columnsTopY;
          doc.x = sidebarX;
          for (const section of sidebarSections) {
            renderSectionContent(section, sidebarX, sidebarWidth);
          }
        } else {
          // If main content overflowed onto page 2+, render sidebar on a clean top of current flow
          // to guarantee zero overlapping text across page boundaries.
          doc.x = startX;
          doc.moveDown(0.5);
          for (const section of sidebarSections) {
            renderSectionContent(section, startX, pageWidth);
          }
        }
      }

      doc.end();
    } catch (error) {
      reject(error);
    }
  });
}

// ---------------------------------------------------------------------------
// ATS-FRIENDLY DOCX GENERATION (docx — Supports All 20 Templates + Customizer)
// ---------------------------------------------------------------------------

export async function generateResumeDocx(
  resume: TailoredResumeContent,
  templateId: ResumeTemplateId = 'classic_professional',
  customization?: Partial<TemplateCustomization> | null,
): Promise<Buffer> {
  const cfg = resolveTemplateCustomization(templateId, customization);
  const metrics = resolveMetrics(cfg);

  const primaryHex = stripHexHash(cfg.primaryColor);
  const secondaryHex = stripHexHash(cfg.secondaryColor);
  const alignHeader =
    cfg.headerStyle === 'centered' ? AlignmentType.CENTER : AlignmentType.LEFT;

  const buildSectionParagraphs = (section: ResumeSectionKey): Paragraph[] => {
    const out: Paragraph[] = [];

    const pushHeading = (title: string) => {
      out.push(
        new Paragraph({
          heading: HeadingLevel.HEADING_2,
          spacing: { before: metrics.sectionBeforeTwip, after: 80 },
          shading:
            cfg.headingStyle === 'solid_banner'
              ? { type: ShadingType.CLEAR, color: 'auto', fill: primaryHex }
              : undefined,
          border:
            cfg.headingStyle === 'left_bar'
              ? { left: { style: BorderStyle.SINGLE, size: 18, color: primaryHex } }
              : cfg.headingStyle === 'solid_banner'
                ? undefined
                : {
                    bottom: {
                      style: BorderStyle.SINGLE,
                      size: cfg.headingStyle === 'uppercase_rule' ? 10 : 6,
                      color: cfg.headingStyle === 'uppercase_rule' ? primaryHex : 'CBD5E1',
                    },
                  },
          children: [
            new TextRun({
              text: title.toUpperCase(),
              bold: true,
              size: metrics.baseHalfPt + 2,
              color: cfg.headingStyle === 'solid_banner' ? 'FFFFFF' : primaryHex,
              font: metrics.docxHeadingFont,
            }),
          ],
        }),
      );
    };

    switch (section) {
      case 'summary':
        if (!resume.professionalSummary?.trim()) break;
        pushHeading(SECTION_TITLES.summary);
        out.push(
          new Paragraph({
            spacing: { after: 100 },
            children: [
              new TextRun({
                text: resume.professionalSummary,
                size: metrics.baseHalfPt,
                color: '1E293B',
                font: metrics.docxBodyFont,
              }),
            ],
          }),
        );
        break;

      case 'competencies':
        if (!resume.coreCompetencies?.length) break;
        pushHeading(SECTION_TITLES.competencies);
        out.push(
          new Paragraph({
            spacing: { after: 100 },
            children: [
              new TextRun({
                text: resume.coreCompetencies.join('  •  '),
                size: metrics.baseHalfPt,
                color: '1E293B',
                font: metrics.docxBodyFont,
              }),
            ],
          }),
        );
        break;

      case 'experience':
        if (!resume.professionalExperience?.length) break;
        pushHeading(SECTION_TITLES.experience);
        for (const exp of resume.professionalExperience) {
          const dateRange = `${exp.startDate} – ${exp.isCurrent ? 'Present' : exp.endDate}`;
          out.push(
            new Paragraph({
              spacing: { before: 100, after: 40 },
              children: [
                new TextRun({
                  text: `${exp.jobTitle} — ${exp.companyName}${
                    exp.location ? `, ${exp.location}` : ''
                  }`,
                  bold: true,
                  size: metrics.baseHalfPt + 1,
                  color: '0F172A',
                  font: metrics.docxHeadingFont,
                }),
                new TextRun({
                  text: `   (${dateRange})`,
                  size: metrics.baseHalfPt - 1,
                  color: secondaryHex,
                  font: metrics.docxBodyFont,
                }),
              ],
            }),
          );
          for (const bullet of exp.bullets || []) {
            if (!bullet.trim()) continue;
            out.push(
              new Paragraph({
                bullet: { level: 0 },
                spacing: { after: 40 },
                children: [
                  new TextRun({
                    text: bullet.trim(),
                    size: metrics.baseHalfPt,
                    color: '1E293B',
                    font: metrics.docxBodyFont,
                  }),
                ],
              }),
            );
          }
        }
        break;

      case 'technical_skills':
        if (!resume.technicalSkills?.length) break;
        pushHeading(SECTION_TITLES.technical_skills);
        out.push(
          new Paragraph({
            spacing: { after: 100 },
            children: [
              new TextRun({
                text: resume.technicalSkills.join(', '),
                size: metrics.baseHalfPt,
                color: '1E293B',
                font: metrics.docxBodyFont,
              }),
            ],
          }),
        );
        break;

      case 'erp_knowledge':
        if (!resume.erpAndSoftwareKnowledge?.length) break;
        pushHeading(SECTION_TITLES.erp_knowledge);
        out.push(
          new Paragraph({
            spacing: { after: 100 },
            children: [
              new TextRun({
                text: resume.erpAndSoftwareKnowledge.join(', '),
                size: metrics.baseHalfPt,
                color: '1E293B',
                font: metrics.docxBodyFont,
              }),
            ],
          }),
        );
        break;

      case 'education':
        if (!resume.educationalQualifications?.length) break;
        pushHeading(SECTION_TITLES.education);
        for (const edu of resume.educationalQualifications) {
          const title = [edu.degree, edu.fieldOfStudy].filter(Boolean).join(' in ');
          const meta = [edu.institution, edu.location, edu.graduationDate]
            .filter(Boolean)
            .join(' | ');
          out.push(
            new Paragraph({
              spacing: { before: 60, after: 20 },
              children: [
                new TextRun({
                  text: title || edu.institution,
                  bold: true,
                  size: metrics.baseHalfPt,
                  color: '0F172A',
                  font: metrics.docxHeadingFont,
                }),
              ],
            }),
          );
          if (meta) {
            out.push(
              new Paragraph({
                spacing: { after: 60 },
                children: [
                  new TextRun({
                    text: meta,
                    size: metrics.baseHalfPt - 1,
                    color: secondaryHex,
                    font: metrics.docxBodyFont,
                  }),
                ],
              }),
            );
          }
        }
        break;

      case 'certifications':
        if (!resume.certifications?.length) break;
        pushHeading(SECTION_TITLES.certifications);
        for (const cert of resume.certifications) {
          const line = [cert.name, cert.issuer, cert.date].filter(Boolean).join(' — ');
          if (!line) continue;
          out.push(
            new Paragraph({
              bullet: { level: 0 },
              spacing: { after: 40 },
              children: [
                new TextRun({
                  text: line,
                  size: metrics.baseHalfPt,
                  color: '1E293B',
                  font: metrics.docxBodyFont,
                }),
              ],
            }),
          );
        }
        break;

      case 'languages':
        if (!resume.languages?.length) break;
        pushHeading(SECTION_TITLES.languages);
        out.push(
          new Paragraph({
            spacing: { after: 100 },
            children: [
              new TextRun({
                text: resume.languages
                  .map((l) => (l.proficiency ? `${l.language} (${l.proficiency})` : l.language))
                  .join('  |  '),
                size: metrics.baseHalfPt,
                color: '1E293B',
                font: metrics.docxBodyFont,
              }),
            ],
          }),
        );
        break;
    }

    return out;
  };

  const children: Array<Paragraph | Table> = [];
  const isDarkBanner = cfg.headerStyle === 'dark_banner';

  children.push(
    new Paragraph({
      alignment: alignHeader,
      spacing: { after: 60 },
      shading: isDarkBanner
        ? { type: ShadingType.CLEAR, color: 'auto', fill: primaryHex }
        : undefined,
      children: [
        new TextRun({
          text: resume.personalInfo.fullName || 'Candidate Name',
          bold: true,
          size: 38,
          color: isDarkBanner ? 'FFFFFF' : '0F172A',
          font: metrics.docxHeadingFont,
        }),
      ],
    }),
  );

  if (resume.professionalTitle) {
    children.push(
      new Paragraph({
        alignment: alignHeader,
        spacing: { after: 70 },
        shading: isDarkBanner
          ? { type: ShadingType.CLEAR, color: 'auto', fill: primaryHex }
          : undefined,
        children: [
          new TextRun({
            text: resume.professionalTitle,
            bold: true,
            size: 22,
            color: isDarkBanner ? 'E2E8F0' : primaryHex,
            font: metrics.docxHeadingFont,
          }),
        ],
      }),
    );
  }

  const contactLine = getContactLine(resume);
  if (contactLine) {
    children.push(
      new Paragraph({
        alignment: alignHeader,
        spacing: { after: 160 },
        shading: isDarkBanner
          ? { type: ShadingType.CLEAR, color: 'auto', fill: primaryHex }
          : undefined,
        border: {
          bottom: { style: BorderStyle.SINGLE, size: 8, color: primaryHex },
        },
        children: [
          new TextRun({
            text: contactLine,
            size: 18,
            color: isDarkBanner ? 'CBD5E1' : secondaryHex,
            font: metrics.docxBodyFont,
          }),
        ],
      }),
    );
  }

  const sectionOrder = getEffectiveSectionOrder(resume.sectionOrder, templateId);

  if (cfg.layout === 'single_column') {
    for (const section of sectionOrder) {
      children.push(...buildSectionParagraphs(section));
    }
  } else {
    const sidebarParagraphs = sectionOrder
      .filter((s) => SIDEBAR_SECTIONS.has(s))
      .flatMap((s) => buildSectionParagraphs(s));
    const mainParagraphs = sectionOrder
      .filter((s) => !SIDEBAR_SECTIONS.has(s))
      .flatMap((s) => buildSectionParagraphs(s));

    const leftIsSidebar = cfg.layout === 'two_column_left';
    const noBorders = {
      top: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
      bottom: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
      left: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
      right: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
    };

    children.push(
      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        borders: {
          top: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
          bottom: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
          left: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
          right: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
          insideHorizontal: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
          insideVertical: { style: BorderStyle.SINGLE, size: 4, color: 'E2E8F0' },
        },
        rows: [
          new TableRow({
            children: [
              new TableCell({
                width: { size: leftIsSidebar ? 34 : 66, type: WidthType.PERCENTAGE },
                borders: noBorders,
                margins: { right: 200 },
                children:
                  (leftIsSidebar ? sidebarParagraphs : mainParagraphs).length > 0
                    ? leftIsSidebar
                      ? sidebarParagraphs
                      : mainParagraphs
                    : [new Paragraph('')],
              }),
              new TableCell({
                width: { size: leftIsSidebar ? 66 : 34, type: WidthType.PERCENTAGE },
                borders: noBorders,
                margins: { left: 200 },
                children:
                  (leftIsSidebar ? mainParagraphs : sidebarParagraphs).length > 0
                    ? leftIsSidebar
                      ? mainParagraphs
                      : sidebarParagraphs
                    : [new Paragraph('')],
              }),
            ],
          }),
        ],
      }),
    );
  }

  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            margin: {
              top: metrics.marginTwip,
              right: metrics.marginTwip,
              bottom: metrics.marginTwip,
              left: metrics.marginTwip,
            },
          },
        },
        children,
      },
    ],
  });

  return Packer.toBuffer(doc);
}

// ---------------------------------------------------------------------------
// PDF & DOCX EXTRACTION & READING-ORDER VALIDATION
// ---------------------------------------------------------------------------

export async function validateResumeExport(
  buffer: Buffer,
  format: 'pdf' | 'docx',
  resume: TailoredResumeContent,
  templateId: ResumeTemplateId,
  customization?: Partial<TemplateCustomization> | null,
): Promise<ExportValidationReport> {
  const def = getTemplateDefinition(templateId);
  const cfg = resolveTemplateCustomization(templateId, customization);
  const warnings: string[] = [];

  if (cfg.layout !== 'single_column' && def.atsClassification === 'ats_friendly') {
    warnings.push(
      'Custom two-column layout overrides the template default single-column structure and may parse with caution in legacy ATS systems.',
    );
  }

  let selectableTextVerified = false;
  let readingOrderVerified = false;

  const fullName = (resume.personalInfo.fullName || '').trim();

  if (format === 'pdf') {
    const raw = buffer.toString('latin1');
    const isPdfHeader = raw.startsWith('%PDF-');
    const hasFontObjects = raw.includes('/Type /Font');
    const containsName =
      !fullName ||
      raw.includes(fullName.split(/\s+/)[0] || fullName) ||
      raw.includes(fullName);
    const summaryIdx = raw.indexOf('PROFESSIONAL SUMMARY');
    const expIdx = raw.indexOf('PROFESSIONAL EXPERIENCE');

    selectableTextVerified = isPdfHeader && hasFontObjects && containsName;
    readingOrderVerified =
      selectableTextVerified &&
      (summaryIdx === -1 || expIdx === -1 || cfg.layout !== 'single_column' || summaryIdx < expIdx);

    if (!selectableTextVerified) {
      warnings.push('PDF selectable font stream verification raised a warning.');
    }
  } else {
    const extracted = await mammoth.extractRawText({ buffer });
    const text = (extracted.value || '').trim();
    const firstName = fullName.split(/\s+/)[0] || '';
    selectableTextVerified =
      text.length > 40 && (!firstName || text.toLowerCase().includes(firstName.toLowerCase()));

    const upper = text.toUpperCase();
    const sumPos = upper.indexOf('PROFESSIONAL SUMMARY');
    const expPos = upper.indexOf('PROFESSIONAL EXPERIENCE');
    readingOrderVerified =
      selectableTextVerified && (sumPos === -1 || expPos === -1 || cfg.layout !== 'single_column' || sumPos < expPos);

    if (!selectableTextVerified) {
      warnings.push('DOCX text extraction returned insufficient text.');
    }
  }

  return {
    valid: selectableTextVerified && readingOrderVerified,
    format,
    selectableTextVerified,
    readingOrderVerified,
    atsClassification:
      cfg.layout !== 'single_column' && def.atsClassification === 'ats_friendly'
        ? 'ats_caution'
        : def.atsClassification,
    warnings,
  };
}
