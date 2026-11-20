const commonSkills = [
  'React', 'TypeScript', 'JavaScript', 'Python', 'SQL', 'PostgreSQL', 'Git', 'Node.js',
  'Java', 'Go', 'Rust', 'C++', 'C#', 'Kubernetes', 'Docker', 'AWS', 'Azure',
  'Terraform', 'Figma', 'Accessibility', 'Automated testing', 'Data pipelines',
  'Machine learning', 'Project management', 'Product design', 'Data analysis',
];

function contains(text, phrase) {
  const escaped = phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp('(?:^|[^a-z0-9+#])' + escaped + '(?=$|[^a-z0-9+#])', 'i').test(text);
}

export function createJobMatcher(resume, profile) {
  const skills = (profile.skills ?? '').split(/[,;\n•]/)
    .map(skill => skill.trim().replace(/^[-*]\s*/, ''))
    .filter(skill => skill.length >= 2 && skill.length <= 45);
  const catalog = new Map([...commonSkills, ...skills].map(skill => [skill.toLowerCase(), skill]));
  const evidence = [resume.text, profile.skills, profile.experience, profile.projects, profile.summary]
    .filter(Boolean).join('\n');
  const known = new Set([...catalog.keys()].filter(skill => contains(evidence, skill)));

  return job => {
    const description = [job.title, job.description].filter(Boolean).join(' ');
    const requested = [...catalog.keys()].filter(skill => contains(description, skill));
    const matched = requested.filter(skill => known.has(skill));
    return {
      score: requested.length ? Math.round(100 * matched.length / requested.length) : null,
      matched: matched.map(skill => catalog.get(skill)),
      total: requested.length,
    };
  };
}
