const DependencyScanner = require('../../scanners/dependency-scanner');
const RuleFormatter = require('../../utils/rule-formatter');

/**
 * Frontend Rule 5: Best Practices
 */
class FrontendRule05BestPractices {
  static async analyze(frontendPath) {
    const packageJson = DependencyScanner.readPackageJson(frontendPath);
    const hasESLint = DependencyScanner.hasESLint(packageJson);
    const hasTypeScript = DependencyScanner.hasTypeScript(packageJson);
    
    const score = (hasESLint ? 50 : 0) + (hasTypeScript ? 50 : 0);
    const durum = RuleFormatter.getDurumByScore(score);
    
    return RuleFormatter.createRule(
      5, 'I', '5. Best Practices',
      durum, score,
      `ESLint: ${hasESLint ? '✓' : '✗'}, TypeScript: ${hasTypeScript ? '✓' : '✗'}`,
      { hasESLint, hasTypeScript },
      score < 100 ? 'ESLint ve TypeScript ekleyin.' : ''
    );
  }
  
  /**
   * GitHub API ile analiz
   */
  static async analyzeGitHub(githubContext) {
    const { packageJson } = githubContext;
    
    const hasESLint = DependencyScanner.hasESLint(packageJson);
    const hasTypeScript = DependencyScanner.hasTypeScript(packageJson);
    
    const score = (hasESLint ? 50 : 0) + (hasTypeScript ? 50 : 0);
    const durum = RuleFormatter.getDurumByScore(score);
    
    return RuleFormatter.createRule(
      5, 'I', '5. Best Practices',
      durum, score,
      `ESLint: ${hasESLint ? '✓' : '✗'}, TypeScript: ${hasTypeScript ? '✓' : '✗'}`,
      { hasESLint, hasTypeScript },
      score < 100 ? 'ESLint ve TypeScript ekleyin.' : ''
    );
  }
}

module.exports = FrontendRule05BestPractices;

