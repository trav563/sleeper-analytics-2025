import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

const csp = () => {
    const config = JSON.parse(readFileSync('vercel.json', 'utf-8'));
    const rule = config.headers.find((h) => h.source === '/(.*)');
    return rule.headers.find((h) => h.key === 'Content-Security-Policy').value;
};

describe('Content-Security-Policy', () => {
    /**
     * The inline theme script in index.html runs before first paint, so it
     * can't move to a module. It's allowed by hash — which means editing the
     * script without updating vercel.json silently breaks light mode in
     * production, where there's no test to catch it. This is that test.
     */
    it('whitelists the current inline theme script by hash', () => {
        const html = readFileSync('index.html', 'utf-8');
        const inline = html.match(/<script>([\s\S]*?)<\/script>/);
        expect(inline).not.toBeNull();

        const hash = createHash('sha256').update(inline[1], 'utf8').digest('base64');
        expect(csp()).toContain(`'sha256-${hash}'`);
    });

    it('blocks framing and plugin content', () => {
        const value = csp();
        expect(value).toContain("frame-ancestors 'none'");
        expect(value).toContain("object-src 'none'");
        expect(value).toContain("base-uri 'self'");
    });

    it('allows exactly the upstreams the client actually calls', () => {
        const connect = csp().match(/connect-src ([^;]+)/)[1].trim().split(/\s+/);
        expect(connect.sort()).toEqual([
            "'self'",
            'https://api.fantasycalc.com',
            'https://api.sleeper.app',
            'https://raw.githubusercontent.com',
            'https://site.api.espn.com',
        ]);
    });

    it('does not fall back to unsafe-inline or unsafe-eval for scripts', () => {
        const scriptSrc = csp().match(/script-src ([^;]+)/)[1];
        expect(scriptSrc).not.toContain('unsafe-inline');
        expect(scriptSrc).not.toContain('unsafe-eval');
    });
});
