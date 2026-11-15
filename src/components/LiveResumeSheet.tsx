import { User } from 'lucide-react';
import {
  getEffectiveSectionOrder,
  resolveTemplateCustomization,
} from '../lib/templates.ts';
import type {
  ResumeSectionKey,
  ResumeTemplateId,
  TailoredResumeContent,
  TemplateCustomization,
} from '../types/resume.ts';

interface LiveResumeSheetProps {
  content: TailoredResumeContent;
  templateId?: ResumeTemplateId;
  customization?: Partial<TemplateCustomization> | null;
  compact?: boolean;
}

const SECTION_LABELS: Record<ResumeSectionKey, string> = {
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

export function LiveResumeSheet({
  content,
  templateId = 'classic_professional',
  customization,
  compact = false,
}: LiveResumeSheetProps) {
  const cfg = resolveTemplateCustomization(templateId, customization);
  const sectionOrder = getEffectiveSectionOrder(content.sectionOrder, templateId);

  const paddingClass = compact
    ? 'p-5'
    : cfg.pageMargin === 'narrow'
      ? 'p-6 md:p-7'
      : cfg.pageMargin === 'wide'
        ? 'p-9 md:p-12'
        : 'p-7 md:p-9';

  const sectionGapClass =
    cfg.sectionSpacing === 'compact'
      ? 'space-y-3'
      : cfg.sectionSpacing === 'relaxed'
        ? 'space-y-6'
        : 'space-y-4';

  const bodySizeClass =
    cfg.fontSize === 'compact'
      ? 'text-[11px]'
      : cfg.fontSize === 'large'
        ? 'text-[13.5px]'
        : 'text-xs md:text-[12.5px]';

  const lineHeightClass =
    cfg.lineSpacing === 'tight'
      ? 'leading-snug'
      : cfg.lineSpacing === 'airy'
        ? 'leading-loose'
        : 'leading-relaxed';

  const fontClass = cfg.fontFamily === 'serif' ? 'font-serif' : 'font-sans';
  const headingFontClass =
    cfg.fontFamily === 'serif' || cfg.fontFamily === 'georgia_sans'
      ? 'font-serif'
      : 'font-sans';
  const dateFontClass =
    cfg.fontFamily === 'mono_accent' ? 'font-mono text-[11px]' : 'text-[11px]';

  const contactItems = [
    content.personalInfo.email,
    content.personalInfo.phone,
    content.personalInfo.location,
    content.personalInfo.linkedin,
    content.personalInfo.portfolio,
  ]
    .map((v) => (v || '').trim())
    .filter(Boolean);

  const initials = (content.personalInfo.fullName || 'C')
    .split(/\s+/)
    .map((p) => p[0] || '')
    .join('')
    .slice(0, 2)
    .toUpperCase();

  const renderSectionHeading = (label: string) => {
    if (cfg.headingStyle === 'solid_banner') {
      return (
        <div
          className="px-2.5 py-1 mb-2 rounded-sm"
          style={{ backgroundColor: cfg.primaryColor }}
        >
          <h3
            className={`text-[11px] font-bold uppercase tracking-wider text-white ${headingFontClass}`}
          >
            {label}
          </h3>
        </div>
      );
    }

    if (cfg.headingStyle === 'left_bar') {
      return (
        <div
          className="pl-2.5 mb-2 border-l-[3px]"
          style={{ borderColor: cfg.primaryColor }}
        >
          <h3
            className={`text-[11px] font-bold uppercase tracking-wider ${headingFontClass}`}
            style={{ color: cfg.primaryColor }}
          >
            {label}
          </h3>
        </div>
      );
    }

    if (cfg.headingStyle === 'accent_tag') {
      return (
        <div className="mb-2">
          <h3
            className={`text-[11px] font-bold uppercase tracking-widest ${headingFontClass}`}
            style={{ color: cfg.primaryColor }}
          >
            {label}
          </h3>
          <div
            className="mt-1 h-[2px] w-10"
            style={{ backgroundColor: cfg.primaryColor }}
          />
        </div>
      );
    }

    return (
      <div
        className="pb-1 mb-2 border-b"
        style={{
          borderColor:
            cfg.headingStyle === 'uppercase_rule' ? cfg.primaryColor : '#CBD5E1',
          borderBottomWidth: cfg.headingStyle === 'uppercase_rule' ? '1.5px' : '1px',
        }}
      >
        <h3
          className={`text-[11px] font-bold uppercase tracking-wider ${headingFontClass}`}
          style={{ color: cfg.primaryColor }}
        >
          {label}
        </h3>
      </div>
    );
  };

  const renderSectionBody = (sectionKey: ResumeSectionKey) => {
    switch (sectionKey) {
      case 'summary':
        if (!content.professionalSummary?.trim()) return null;
        return (
          <section key={sectionKey}>
            {renderSectionHeading(SECTION_LABELS[sectionKey])}
            <p className={`${bodySizeClass} ${lineHeightClass} text-slate-800 whitespace-pre-line`}>
              {content.professionalSummary}
            </p>
          </section>
        );

      case 'competencies':
        if (!content.coreCompetencies?.length) return null;
        return (
          <section key={sectionKey}>
            {renderSectionHeading(SECTION_LABELS[sectionKey])}
            {cfg.showSkillBars ? (
              <div className="space-y-2">
                {content.coreCompetencies.slice(0, 6).map((comp, idx) => (
                  <div key={idx} className="space-y-1">
                    <div className="text-[11px] font-medium text-slate-800">{comp}</div>
                    <div className="h-1.5 w-full bg-slate-200 rounded-sm overflow-hidden">
                      <div
                        className="h-full"
                        style={{
                          width: `${Math.max(70, 95 - idx * 4)}%`,
                          backgroundColor: cfg.primaryColor,
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className={`${bodySizeClass} ${lineHeightClass} text-slate-800`}>
                {content.coreCompetencies.join('   •   ')}
              </p>
            )}
          </section>
        );

      case 'experience':
        if (!content.professionalExperience?.length) return null;
        return (
          <section key={sectionKey}>
            {renderSectionHeading(SECTION_LABELS[sectionKey])}
            <div className="space-y-3.5">
              {content.professionalExperience.map((exp, expIdx) => (
                <div key={exp.id || expIdx} className="space-y-1">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <div
                      className={`${bodySizeClass} font-semibold text-slate-900 ${headingFontClass}`}
                    >
                      {exp.jobTitle || 'Role Title'}
                      {exp.companyName ? ` — ${exp.companyName}` : ''}
                      {exp.location ? `, ${exp.location}` : ''}
                    </div>
                    <div
                      className={`tabular-nums ${dateFontClass}`}
                      style={{ color: cfg.secondaryColor }}
                    >
                      {exp.startDate || 'Start'} –{' '}
                      {exp.isCurrent ? 'Present' : exp.endDate || 'End'}
                    </div>
                  </div>
                  {exp.bullets.filter((b) => b.trim()).length > 0 && (
                    <ul
                      className={`list-disc pl-4 space-y-1 ${bodySizeClass} ${lineHeightClass} text-slate-800`}
                    >
                      {exp.bullets
                        .filter((b) => b.trim())
                        .map((bullet, bIdx) => (
                          <li key={bIdx}>{bullet}</li>
                        ))}
                    </ul>
                  )}
                </div>
              ))}
            </div>
          </section>
        );

      case 'technical_skills':
        if (!content.technicalSkills?.length) return null;
        return (
          <section key={sectionKey}>
            {renderSectionHeading(SECTION_LABELS[sectionKey])}
            <p className={`${bodySizeClass} ${lineHeightClass} text-slate-800`}>
              {content.technicalSkills.join(', ')}
            </p>
          </section>
        );

      case 'erp_knowledge':
        if (!content.erpAndSoftwareKnowledge?.length) return null;
        return (
          <section key={sectionKey}>
            {renderSectionHeading(SECTION_LABELS[sectionKey])}
            <p className={`${bodySizeClass} ${lineHeightClass} text-slate-800`}>
              {content.erpAndSoftwareKnowledge.join(', ')}
            </p>
          </section>
        );

      case 'education':
        if (!content.educationalQualifications?.length) return null;
        return (
          <section key={sectionKey}>
            {renderSectionHeading(SECTION_LABELS[sectionKey])}
            <div className="space-y-1.5">
              {content.educationalQualifications.map((edu, idx) => (
                <div key={edu.id || idx} className="flex flex-wrap justify-between gap-2">
                  <div>
                    <div className={`${bodySizeClass} font-semibold text-slate-900`}>
                      {[edu.degree, edu.fieldOfStudy].filter(Boolean).join(' in ') ||
                        edu.institution}
                    </div>
                    <div className="text-[11px] text-slate-600">
                      {[edu.institution, edu.location].filter(Boolean).join(', ')}
                    </div>
                  </div>
                  <div
                    className={`tabular-nums ${dateFontClass}`}
                    style={{ color: cfg.secondaryColor }}
                  >
                    {edu.graduationDate}
                  </div>
                </div>
              ))}
            </div>
          </section>
        );

      case 'certifications':
        if (!content.certifications?.length) return null;
        return (
          <section key={sectionKey}>
            {renderSectionHeading(SECTION_LABELS[sectionKey])}
            <ul className={`list-disc pl-4 space-y-0.5 ${bodySizeClass} text-slate-800`}>
              {content.certifications.map((cert, idx) => (
                <li key={cert.id || idx}>
                  {[cert.name, cert.issuer, cert.date].filter(Boolean).join(' — ')}
                </li>
              ))}
            </ul>
          </section>
        );

      case 'languages':
        if (!content.languages?.length) return null;
        return (
          <section key={sectionKey}>
            {renderSectionHeading(SECTION_LABELS[sectionKey])}
            <p className={`${bodySizeClass} text-slate-800`}>
              {content.languages
                .map((l) => (l.proficiency ? `${l.language} (${l.proficiency})` : l.language))
                .join('  |  ')}
            </p>
          </section>
        );
    }
  };

  const renderHeader = () => {
    const isDark = cfg.headerStyle === 'dark_banner';
    const isTinted = cfg.headerStyle === 'tinted_band';
    const isCentered = cfg.headerStyle === 'centered';
    const isTopBar = cfg.headerStyle === 'top_accent_bar';
    const isSplitBox = cfg.headerStyle === 'split_box';

    return (
      <header
        className={`${
          isDark
            ? 'rounded-lg px-5 py-4 text-white'
            : isTinted
              ? 'rounded-lg bg-slate-50 px-5 py-4 border-l-4'
              : isTopBar
                ? 'border-t-4 pt-3 pb-1'
                : isSplitBox
                  ? 'border-b-2 pb-3'
                  : ''
        } ${isCentered ? 'text-center' : 'text-left'}`}
        style={{
          backgroundColor: isDark ? cfg.primaryColor : undefined,
          borderColor:
            isTinted || isTopBar || isSplitBox ? cfg.primaryColor : undefined,
        }}
      >
        <div
          className={`flex items-center gap-4 ${
            isCentered ? 'justify-center' : 'justify-between'
          }`}
        >
          <div className="flex items-center gap-3.5 min-w-0">
            {cfg.showPhoto && !isCentered && (
              <div
                className="w-12 h-12 rounded-lg flex items-center justify-center shrink-0 border"
                style={{
                  backgroundColor: isDark ? 'rgba(255,255,255,0.12)' : '#F8FAFC',
                  borderColor: isDark ? 'rgba(255,255,255,0.25)' : '#E2E8F0',
                  color: isDark ? '#FFFFFF' : cfg.primaryColor,
                }}
                aria-label="Profile photo placeholder"
              >
                {initials ? (
                  <span className={`text-sm font-bold ${headingFontClass}`}>{initials}</span>
                ) : (
                  <User className="w-5 h-5" />
                )}
              </div>
            )}

            <div className="min-w-0">
              <h2
                className={`font-bold tracking-tight ${headingFontClass} ${
                  compact ? 'text-lg' : 'text-xl md:text-2xl'
                } ${isDark ? 'text-white' : 'text-slate-900'}`}
              >
                {content.personalInfo.fullName || 'Candidate Name'}
              </h2>
              {content.professionalTitle && (
                <p
                  className={`mt-0.5 text-sm font-semibold ${
                    isDark ? 'text-slate-200' : ''
                  }`}
                  style={isDark ? undefined : { color: cfg.primaryColor }}
                >
                  {content.professionalTitle}
                </p>
              )}
              {contactItems.length > 0 && !isSplitBox && (
                <p
                  className={`mt-1 text-[11px] break-words ${
                    isDark ? 'text-slate-200' : 'text-slate-600'
                  }`}
                >
                  {contactItems.join('  |  ')}
                </p>
              )}
            </div>
          </div>

          {isSplitBox && contactItems.length > 0 && (
            <div className="text-right text-[11px] text-slate-600 space-y-0.5 shrink-0 max-w-[230px] break-words">
              {contactItems.slice(0, 4).map((c, idx) => (
                <div key={idx}>{c}</div>
              ))}
            </div>
          )}
        </div>
      </header>
    );
  };

  const mainSections = sectionOrder.filter((s) => !SIDEBAR_SECTIONS.has(s));
  const sidebarSections = sectionOrder.filter((s) => SIDEBAR_SECTIONS.has(s));

  return (
    <div
      className={`rounded-xl border border-slate-200 bg-white shadow-sm ${fontClass} ${paddingClass} ${sectionGapClass}`}
    >
      {renderHeader()}

      {cfg.layout === 'single_column' ? (
        <div className={sectionGapClass}>
          {sectionOrder.map((key) => renderSectionBody(key))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
          {cfg.layout === 'two_column_left' ? (
            <>
              <aside className={`md:col-span-4 rounded-lg bg-slate-50/70 p-4 border border-slate-100 ${sectionGapClass}`}>
                {sidebarSections.map((key) => renderSectionBody(key))}
              </aside>
              <div className={`md:col-span-8 ${sectionGapClass}`}>
                {mainSections.map((key) => renderSectionBody(key))}
              </div>
            </>
          ) : (
            <>
              <div className={`md:col-span-8 ${sectionGapClass}`}>
                {mainSections.map((key) => renderSectionBody(key))}
              </div>
              <aside className={`md:col-span-4 rounded-lg bg-slate-50/70 p-4 border border-slate-100 ${sectionGapClass}`}>
                {sidebarSections.map((key) => renderSectionBody(key))}
              </aside>
            </>
          )}
        </div>
      )}
    </div>
  );
}
