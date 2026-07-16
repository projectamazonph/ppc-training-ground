import { describe, it, expect } from 'vitest';
import { renderLesson } from '@/lib/mdx';

describe('mdx.ts — renderLesson', () => {
  it('renders plain text as a paragraph', () => {
    expect(renderLesson('Hello world').trim()).toBe('<p>Hello world</p>');
  });

  it('renders multiple paragraphs separated by blank lines', () => {
    const result = renderLesson('First paragraph.\n\nSecond paragraph.');
    expect(result).toContain('<p>First paragraph.</p>');
    expect(result).toContain('<p>Second paragraph.</p>');
  });

  it('renders headings h1 through h4', () => {
    expect(renderLesson('# Title').trim()).toBe('<h1>Title</h1>');
    expect(renderLesson('## Section').trim()).toBe('<h2>Section</h2>');
    expect(renderLesson('### Subsection').trim()).toBe('<h3>Subsection</h3>');
    expect(renderLesson('#### Detail').trim()).toBe('<h4>Detail</h4>');
  });

  it('renders bold text', () => {
    expect(renderLesson('This is **bold** text')).toContain('This is <strong>bold</strong> text');
  });

  it('renders italic text', () => {
    expect(renderLesson('This is *italic* text')).toContain('This is <em>italic</em> text');
  });

  it('renders inline code', () => {
    expect(renderLesson('Use the `renderLesson` function')).toContain(
      'Use the <code>renderLesson</code> function'
    );
  });

  it('renders code blocks', () => {
    const input = '```\nconst x = 1;\nconst y = 2;\n```';
    const result = renderLesson(input);
    expect(result).toContain('<pre><code>');
    expect(result).toContain('const x = 1;');
    expect(result).toContain('const y = 2;');
    expect(result).toContain('</code></pre>');
  });

  it('renders bullet lists', () => {
    const input = '- Item one\n- Item two\n- Item three';
    const result = renderLesson(input);
    expect(result).toContain('<ul>');
    expect(result).toContain('<li>Item one</li>');
    expect(result).toContain('<li>Item two</li>');
    expect(result).toContain('<li>Item three</li>');
    expect(result).toContain('</ul>');
  });

  it('renders ordered lists', () => {
    const input = '1. First\n2. Second\n3. Third';
    const result = renderLesson(input);
    expect(result).toContain('<ol>');
    expect(result).toContain('<li>First</li>');
    expect(result).toContain('<li>Second</li>');
    expect(result).toContain('<li>Third</li>');
    expect(result).toContain('</ol>');
  });

  it('renders nested lists (ordered list with nested unordered sub-items)', () => {
    // Matches the decision-flowchart pattern used in the search-term-triage lessons.
    const input =
      '1. **Is it relevant?**\n   - No -> Add Negative\n   - Yes -> Continue\n' +
      '     - Nested -> Deep item';
    const result = renderLesson(input);
    expect(result).toContain('<ol>');
    expect(result).toContain('<strong>Is it relevant?</strong>');
    expect(result).toContain('No -&gt; Add Negative');
    // Two levels of nested <ul> for the sub-item and sub-sub-item.
    expect(result.match(/<ul>/g)?.length).toBe(2);
  });

  it('renders tables', () => {
    const input = '| Metric | Target |\n|---|---|\n| ACoS | 25% |\n| ROAS | 4.0 |';
    const result = renderLesson(input);
    expect(result).toContain('<table>');
    expect(result).toContain('<th>Metric</th>');
    expect(result).toContain('<th>Target</th>');
    expect(result).toContain('<td>ACoS</td>');
    expect(result).toContain('<td>25%</td>');
    expect(result).toContain('</table>');
  });

  it('renders links with safe schemes', () => {
    const result = renderLesson('[Amazon Ads help](https://advertising.amazon.com/help/foo)');
    expect(result).toContain('<a href="https://advertising.amazon.com/help/foo"');
    expect(result).toContain('rel="noopener noreferrer"');
    expect(result).toContain('>Amazon Ads help</a>');
  });

  it('renders relative and anchor links', () => {
    expect(renderLesson('[next lesson](/courses/foo/lessons/bar)')).toContain(
      'href="/courses/foo/lessons/bar"'
    );
    expect(renderLesson('[jump](#section)')).toContain('href="#section"');
  });

  it('strips unsafe link schemes down to plain text', () => {
    const result = renderLesson('[click me](javascript:alert(1))');
    expect(result).not.toContain('<a ');
    expect(result).not.toContain('javascript:');
    expect(result).toContain('click me');
  });

  it('renders images with safe schemes', () => {
    const result = renderLesson('![Campaign structure diagram](https://example.com/diagram.png)');
    expect(result).toContain('<img src="https://example.com/diagram.png"');
    expect(result).toContain('alt="Campaign structure diagram"');
  });

  it('drops images with unsafe schemes down to alt text', () => {
    const result = renderLesson('![bad](javascript:alert(1))');
    expect(result).not.toContain('<img');
    expect(result).toContain('bad');
  });

  it('renders single-line blockquotes', () => {
    expect(renderLesson('> A wise quote')).toContain('<blockquote>');
    expect(renderLesson('> A wise quote')).toContain('A wise quote');
  });

  it('renders multi-line blockquote callouts with a nested list as one block', () => {
    // Matches the "🎯 Analogy" / "📌 Key Takeaway" callout pattern used throughout lessons.
    const input =
      '> 🎯 **Analogy**: Three ways to pay for a taxi:\n' +
      '> - **Fixed Bids** = flat-rate ride share\n' +
      '> - **Dynamic** = surge pricing';
    const result = renderLesson(input);
    expect(result.match(/<blockquote>/g)?.length).toBe(1);
    expect(result).toContain('<strong>Analogy</strong>');
    expect(result).toContain('<li><strong>Fixed Bids</strong> = flat-rate ride share</li>');
  });

  it('renders horizontal rules', () => {
    expect(renderLesson('---')).toContain('<hr>');
    expect(renderLesson('***')).toContain('<hr>');
  });

  it('escapes raw HTML blocks instead of passing them through', () => {
    const result = renderLesson('<script>alert("xss")</script>');
    expect(result).not.toContain('<script>');
    expect(result).toContain('&lt;script&gt;');
  });

  it('escapes raw inline HTML tags instead of passing them through', () => {
    const result = renderLesson('Some text with <b>raw html</b> inline.');
    expect(result).not.toContain('<b>raw html</b>');
    expect(result).toContain('&lt;b&gt;');
  });

  it('HTML-escapes dangerous characters in plain text', () => {
    const result = renderLesson('Compare A < B and C > D');
    expect(result).toContain('&lt;');
    expect(result).toContain('&gt;');
  });

  it('handles combined formatting', () => {
    const result = renderLesson('# Welcome\n\nThis is **bold** and *italic* with `code`.');
    expect(result).toContain('<h1>Welcome</h1>');
    expect(result).toContain('This is <strong>bold</strong> and <em>italic</em> with <code>code</code>.');
  });

  it('handles unclosed code block by closing at end', () => {
    const input = '```\nconst x = 1;\n\nconst y = 2;';
    const result = renderLesson(input);
    expect(result).toContain('<pre><code>');
    expect(result).toContain('const x = 1');
    expect(result).toContain('const y = 2');
    expect(result).toContain('</code></pre>');
  });

  it('returns empty string for empty input', () => {
    expect(renderLesson('').trim()).toBe('');
  });

  it('handles mixed list items with asterisk', () => {
    const input = '* Item A\n* Item B';
    const result = renderLesson(input);
    expect(result).toContain('<li>Item A</li>');
    expect(result).toContain('<li>Item B</li>');
  });
});
