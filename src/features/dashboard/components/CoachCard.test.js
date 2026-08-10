import { describe, it, expect } from 'vitest';
import { formatInlineMarkdown } from './CoachCard';

describe('formatInlineMarkdown', () => {
    it('escapes HTML so injected markup cannot execute', () => {
        const out = formatInlineMarkdown('<img src=x onerror=alert(1)>**hi**');
        expect(out).not.toContain('<img');
        expect(out).toContain('&lt;img src=x onerror=alert(1)&gt;');
        expect(out).toContain('<strong class="text-text">hi</strong>');
    });

    it('escapes quotes and ampersands', () => {
        expect(formatInlineMarkdown('Tom & "Jerry"')).toBe('Tom &amp; &quot;Jerry&quot;');
    });

    it('applies bold and italic after escaping', () => {
        expect(formatInlineMarkdown('**bold** and *ital*')).toBe(
            '<strong class="text-text">bold</strong> and <em>ital</em>'
        );
    });

    it('does not let escaped input form a bold tag from user angle brackets', () => {
        const out = formatInlineMarkdown('**<script>alert(1)</script>**');
        expect(out).toBe(
            '<strong class="text-text">&lt;script&gt;alert(1)&lt;/script&gt;</strong>'
        );
    });
});
