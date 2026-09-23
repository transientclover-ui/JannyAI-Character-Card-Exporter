// ==UserScript==
// @name         JannyAI Character Card Exporter
// @namespace    https://github.com/transientclover-ui
// @version      0.5.6-beta
// @description  Export JannyAI character text as portable CCv2 JSON or a portrait-backed PNG card, with integrity checks.
// @author       transientclover
// @license      MIT
// @match        https://jannyai.com/characters/*
// @match        https://www.jannyai.com/characters/*
// @grant        none
// @run-at       document-idle
// ==/UserScript==

/*
MIT License
Copyright (c) 2026 transientclover
Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:
The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.
THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
*/

(() => {
  'use strict';
  const VERSION = '0.5.6-beta';
  const MAX_BYTES = 12 * 1024 * 1024;
  const MAX_PIXELS = 16_000_000;
  const MAX_DIM = 4096;
  const PREF = 'transientclover.jannyai.includePortrait';
  const SCAN_PREF = 'transientclover.jannyai.scanWithClamAV';
  const NATIVE_SCAN_REQUEST = 'jannyai-clamav-native-scan-v1';
  const NATIVE_SCAN_ACCEPT = 'jannyai-clamav-native-accept-v1';
  const NATIVE_SCAN_RESULT = 'jannyai-clamav-native-result-v1';
  const encoder = new TextEncoder();
  const decoder = new TextDecoder('utf-8', { fatal: true });
  const clean = v => String(v ?? '').replace(/\r\n?/g, '\n').replace(/\u00a0/g, ' ').replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
  const safeName = s => (s || 'character').replace(/[<>:"/\\|?*\x00-\x1f]/g, '_').replace(/\s+/g, ' ').trim().slice(0, 120);
  // Browser APIs may return cross-compartment typed arrays in Firefox.
  // Allocate our own backing buffer; never use slice/subarray on foreign views
  // (their implicit species lookup can access a protected constructor).
  function localBytes(view) {
    const out = new Uint8Array(view.length);
    for (let i = 0; i < view.length; i++) out[i] = view[i];
    return out;
  }
  const utf8 = s => localBytes(encoder.encode(s));
  const get32 = (a, i) => (((a[i] * 0x1000000) + (a[i + 1] << 16) + (a[i + 2] << 8) + a[i + 3]) >>> 0);
  const put32 = (a, i, v) => { a[i] = v >>> 24; a[i + 1] = v >>> 16; a[i + 2] = v >>> 8; a[i + 3] = v; };
  const concat = (...arrays) => { const out = new Uint8Array(arrays.reduce((n, a) => n + a.length, 0)); let i = 0; for (const a of arrays) { out.set(a, i); i += a.length; } return out; };
  const eq = (a, b) => a.length === b.length && a.every((v, i) => v === b[i]);
  function crc32(bytes) { let c = 0xffffffff; for (const b of bytes) { c ^= b; for (let k = 0; k < 8; k++) c = (c >>> 1) ^ ((c & 1) ? 0xedb88320 : 0); } return (c ^ 0xffffffff) >>> 0; }
  function chunk(type, payload) { const t = utf8(type); const out = new Uint8Array(payload.length + 12); put32(out, 0, payload.length); out.set(t, 4); out.set(payload, 8); put32(out, out.length - 4, crc32(concat(t, payload))); return out; }
  function b64(bytes) { let out = ''; for (let i = 0; i < bytes.length; i += 0x8000) out += String.fromCharCode(...bytes.subarray(i, i + 0x8000)); return btoa(out); }
  function unb64(s) { const binary = atob(s); return Uint8Array.from(binary, c => c.charCodeAt(0)); }
  const SIG = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);

  function parsePNG(bytes) {
    if (!eq(bytes.subarray(0, 8), SIG)) throw Error('Invalid PNG signature.');
    let p = 8, ended = false, ihdr = null, card = null, idat = false;
    while (p + 12 <= bytes.length) {
      const len = get32(bytes, p), end = p + 12 + len;
      if (len > MAX_BYTES * 2 || end > bytes.length) throw Error('Invalid PNG chunk length.');
      const type = decoder.decode(bytes.subarray(p + 4, p + 8));
      const payload = bytes.subarray(p + 8, p + 8 + len);
      if (crc32(bytes.subarray(p + 4, p + 8 + len)) !== get32(bytes, p + 8 + len)) throw Error(`PNG CRC failure: ${type}.`);
      if (p === 8 && type !== 'IHDR') throw Error('PNG missing initial IHDR.');
      if (type === 'IHDR') { if (ihdr || len !== 13) throw Error('Invalid IHDR.'); ihdr = { width: get32(payload, 0), height: get32(payload, 4) }; }
      if (type === 'IDAT') idat = true;
      if (type === 'tEXt') {
        const sep = payload.indexOf(0);
        if (sep >= 0 && decoder.decode(payload.subarray(0, sep)) === 'chara') {
          if (card !== null) throw Error('Duplicate chara metadata.');
          card = decoder.decode(unb64(decoder.decode(payload.subarray(sep + 1))));
        }
      }
      p = end;
      if (type === 'IEND') { if (len !== 0) throw Error('Invalid IEND.'); ended = true; break; }
    }
    if (!ended || p !== bytes.length || !ihdr || !idat) throw Error('Incomplete PNG structure.');
    return { ...ihdr, card };
  }

  function label() {
    for (const el of document.querySelectorAll('h1,h2,h3,h4,h5,h6,strong,b,label,dt,div,span,p')) {
      if (clean(el.textContent).replace(/:$/, '').trim() === 'Character Definition') return el;
    }
    return null;
  }
  function payload() {
    const el = label();
    if (!el) throw Error('Character Definition heading not found.');
    let node = el;
    for (let depth = 0; node && depth < 12; depth++, node = node.parentElement) {
      const t = clean(node.textContent);
      if (t.length > 100 && /\bScenario\s*:/i.test(t) && /\bFirst Message\s*:/i.test(t)) return t;
    }
    node = el;
    for (let depth = 0; node && depth < 8; depth++, node = node.parentElement) {
      let combined = '';
      for (let s = node.nextElementSibling; s; s = s.nextElementSibling) {
        const part = clean(s.textContent);
        if (part) combined += (combined ? '\n\n' : '') + part;
        if (/\bFirst Message\s*:/i.test(combined) && /\bScenario\s*:/i.test(combined)) return combined;
        if (combined.length > 300000) break;
      }
    }
    throw Error('Unable to isolate hidden character text.');
  }
  function split(t) {
    t = clean(t).replace(/^\s*Character Definition\s*:?\s*/i, '');
    const scenario = /\bScenario\s*:\s*/i.exec(t);
    if (!scenario) throw Error('Scenario marker missing; cannot safely split card.');
    const firstR = /\bFirst Message\s*:\s*/ig;
    firstR.lastIndex = scenario.index + scenario[0].length;
    const first = firstR.exec(t);
    if (!first) throw Error('First Message marker missing.');
    const exampleR = /\bExample Dialog(?:s|ue)\s*:\s*/ig;
    exampleR.lastIndex = first.index + first[0].length;
    const example = exampleR.exec(t);
    const endFirst = example ? example.index : t.length;
    let examples = example ? t.slice(example.index + example[0].length) : '';
    for (const marker of ['\nDownload', '\nRemove bookmark', '\nAdd to collection', '\nReport Broken Image', '\nSimilar Characters']) {
      const at = examples.indexOf(marker); if (at !== -1) examples = examples.slice(0, at);
    }
    return {
      description: clean(t.slice(0, scenario.index)),
      personality: '',
      scenario: clean(t.slice(scenario.index + scenario[0].length, first.index)),
      first_mes: clean(t.slice(first.index + first[0].length, endFirst)),
      mes_example: clean(examples)
    };
  }
  function harvestHidden() {
    const raw_payload = payload(), fields = split(raw_payload);
    const page = document.body.innerText || '';
    const creator = page.match(/(?:^|\n)\s*Creator\s*:\s*([^\n]+)/i)?.[1] || '';
    const name = clean(document.querySelector('h1')?.textContent || document.title.replace(/\s*[|–—-]\s*JannyAI.*$/i, ''));
    const source_uuid = location.pathname.match(/\/characters\/([0-9a-f-]{36})_/i)?.[1] || '';
    if (!name || !fields.description || !fields.first_mes) throw Error('Required card fields missing.');
    if (/\bScenario\s*:/i.test(fields.description) || /\bFirst Message\s*:/i.test(fields.scenario) || /\bExample Dialog(?:s|ue)\s*:/i.test(fields.first_mes) || /Remove bookmark|Add to collection|Report Broken Image/i.test(fields.mes_example)) throw Error('Character sections appear contaminated.');
    return { name, ...fields, creator: clean(creator), tags: [], source_url: location.href, source_uuid, raw_payload };
  }
  // Astro serializes an object as { key: [type, value] }; nested objects and
  // arrays contain more typed values. Decode JSON-compatible types exactly.
  // Do not guess unsupported types: retain their serialized source and fall back.
  function decodeAstroProps(serialized) {
    function object(value, depth) {
      if (depth > 100 || !value || typeof value !== 'object' || Array.isArray(value)) throw Error('Invalid Astro object.');
      return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, typed(entry, depth + 1)]));
    }
    function typed(entry, depth) {
      if (depth > 100 || !Array.isArray(entry)) throw Error('Invalid Astro typed property.');
      // Astro encodes undefined as [0], including the logged-out userId prop.
      // JSON omits undefined keys; raw_props retains this wrapper verbatim.
      if (entry.length === 1 && entry[0] === 0) return undefined;
      if (entry.length !== 2) throw Error('Invalid Astro typed property.');
      const [type, value] = entry;
      if (type === 0) {
        if (value === null || ['string', 'number', 'boolean'].includes(typeof value)) return value;
        return object(value, depth + 1);
      }
      if (type === 1 && Array.isArray(value)) return value.map(item => typed(item, depth + 1));
      throw Error(`Unsupported Astro property type ${String(type)}; original props retained.`);
    }
    return object(JSON.parse(serialized), 0);
  }
  function sourceIslands() {
    // Restrict extraction to the native Download component, excluding other cards.
    return [...document.querySelectorAll('astro-island[props]')].filter(island => {
      const component = island.getAttribute('component-url') || '';
      const identified = island.getAttribute('component-export') === 'CharacterButtons' || /\/CharacterButtons[.]/.test(component);
      return identified && [...island.querySelectorAll('button')].some(button => clean(button.textContent) === 'Download');
    }).map(island => ({ component: island.getAttribute('component-url'), props: island.getAttribute('props') }));
  }
  function structuredRecord(props, source) {
    const c = props.character;
    if (!c || typeof c !== 'object' || Array.isArray(c)) throw Error('Structured character object missing.');
    const extraction_warnings = [];
    function string(key) {
      if (!Object.hasOwn(c, key)) throw Error(`Structured character.${key} missing.`);
      if (c[key] === null) { extraction_warnings.push(`character.${key} is null; CCv2 uses an empty string and the source null is retained.`); return ''; }
      if (typeof c[key] !== 'string') throw Error(`Structured character.${key} is not text.`);
      return c[key]; // No trim(), whitespace cleanup, HTML decoding, or RP rewriting.
    }
    const name = string('name'), definition = string('personality');
    const description_html = string('description');
    const scenario = string('scenario'), first_mes = string('firstMessage'), mes_example = string('exampleDialogs');
    const id = string('id'), creatorId = string('creatorId');
    const pageId = location.pathname.match(/\/characters\/([0-9a-f-]{36})(?:_|\/|$)/i)?.[1];
    if (!/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(id) || (pageId && id.toLowerCase() !== pageId.toLowerCase())) throw Error('Structured character UUID does not match this page.');
    if (!name.trim()) throw Error('Structured character name is empty.');
    let creator = '';
    if (typeof c.creatorName === 'string') creator = c.creatorName;
    else {
      const link = [...document.querySelectorAll('a[href*="/creators/"]')].find(a => a.getAttribute('href').includes('/creators/' + creatorId + '_'));
      creator = link?.textContent || '';
      extraction_warnings.push('creatorName unavailable; creator display text taken from the matching profile link when present.');
    }
    const tags = [];
    if (Array.isArray(c.tags)) for (const tag of c.tags) {
      if (typeof tag === 'string') tags.push(tag);
      else if (typeof tag?.name === 'string') tags.push(tag.name);
      else extraction_warnings.push('An unmapped tag is retained in source_props.');
    }
    let imageUrl = '';
    if (typeof props.imageUrl === 'string') imageUrl = props.imageUrl;
    else extraction_warnings.push('Structured portrait URL unavailable; use the portrait selector or export JSON.');
    return {
      name, description: definition, personality: '', description_html,
      scenario, first_mes, mes_example, creator, creatorId, tags, imageUrl,
      source_url: location.href, source_uuid: id,
      extraction_method: 'astro-island props', extraction_warnings,
      // JSON-compatible typed values are decoded; the exact props string is also
      // retained so that no source key, wrapper, or original text is discarded.
      structured_props: props, raw_props: source.props, source_islands: [source], raw_payload: ''
    };
  }
  function harvest() {
    const sources = sourceIslands(), failures = [], matches = [];
    for (const source of sources) {
      try { matches.push(structuredRecord(decodeAstroProps(source.props), source)); }
      catch (err) { failures.push(err.message); }
    }
    if (matches.length === 1) {
      const result = matches[0];
      result.source_islands = sources;
      // Retain the former raw backup as comparison evidence when available, but
      // never use it to overwrite valid structured fields (including empties).
      try { result.raw_payload = payload(); }
      catch (_) { result.extraction_warnings.push('Hidden-text backup unavailable; exact structured props retained.'); }
      return result;
    }
    const reason = matches.length > 1 ? 'Multiple matching Download components; selection is ambiguous.' : (failures.join(' ') || 'Native Download astro-island not found.');
    try {
      const fallback = harvestHidden();
      return { ...fallback, extraction_method: 'hidden-text fallback', source_islands: sources,
        extraction_warnings: [`Structured extraction failed: ${reason}`, 'Legacy fallback normalizes whitespace; original component props retained when available.'] };
    } catch (err) {
      throw Error(`Structured extraction failed: ${reason} Hidden-text fallback failed: ${err.message}`);
    }
  }
  // Deterministic scene-divider repair. Keep prose, punctuation,
  // line endings and existing blank lines intact. Isolate standalone scene
  // rules so Markdown cannot treat them as a Setext heading underline.
  function normalizeFormatting(text) {
    const lines = text.split(/(\r\n|\n|\r)/);
    let fence = null;
    const dividers = new Set();
    for (let i = 0; i < lines.length; i += 2) {
      const line = lines[i];
      const marker = /^( {0,3})(`{3,}|~{3,})(.*)$/.exec(line);
      if (fence) {
        if (marker && marker[2][0] === fence.char && marker[2].length >= fence.length && /^[ \t]*$/.test(marker[3])) fence = null;
        continue;
      }
      if (marker && (marker[2][0] !== '`' || !marker[3].includes('`'))) {
        fence = { char: marker[2][0], length: marker[2].length };
        continue;
      }
      // Do not touch indented code, lists, quotes, inline hyphens, or headings
      // underlined with one/two hyphens. Three or more denote a scene rule.
      if (/^ {0,3}-{3,}[ \t]*$/.test(line)) dividers.add(i);
    }
    let out = '';
    for (let i = 0; i < lines.length; i += 2) {
      const eol = lines[i + 1] || lines[i - 1] || '\n';
      if (dividers.has(i) && i > 0 && !/^[ \t]*$/.test(lines[i - 2]) && !dividers.has(i - 2)) out += eol;
      out += (dividers.has(i) ? '---' : lines[i]) + (lines[i + 1] || '');
      if (dividers.has(i) && i + 2 < lines.length && !/^[ \t]*$/.test(lines[i + 2])) out += eol;
    }
    return out;
  }
  function cardV2(r, normalize = true) {
    // Only a shallow export copy changes. Raw backup and source extensions
    // continue referencing the untouched harvested record and props.
    if (normalize) {
      r = { ...r };
      for (const field of ['description', 'personality', 'scenario', 'first_mes', 'mes_example']) {
        r[field] = normalizeFormatting(r[field]);
      }
    }
    return { spec: 'chara_card_v2', spec_version: '2.0', data: {
      name: r.name, description: r.description, personality: r.personality, scenario: r.scenario,
      first_mes: r.first_mes, mes_example: r.mes_example,
      creator_notes: `${r.description_html ? r.description_html + '\n\n' : ''}Exported from JannyAI.\nSource: ${r.source_url}\nJannyAI UUID: ${r.source_uuid}\nHarvester version: ${VERSION}`,
      system_prompt: '', post_history_instructions: '', alternate_greetings: [], tags: r.tags,
      creator: r.creator, character_version: '', extensions: { jannyai_harvester: {
        source_url: r.source_url, source_uuid: r.source_uuid, harvester_version: VERSION,
        exported_at: new Date().toISOString(),
        extraction_method: r.extraction_method,
        extraction_warnings: r.extraction_warnings || [],
        creator_id: r.creatorId || '', image_url: r.imageUrl || '',
        description_html: r.description_html || '',
        // Preserve every source key, including fields CCv2 cannot directly represent.
        source_props: r.structured_props || null,
        source_props_serialized: r.raw_props || '',
        source_islands: r.source_islands || [],
        hidden_raw_payload: r.raw_payload || ''
      } }
    } };
  }
  function warnings(r) {
    const combined = [r.description, r.personality, r.description_html, r.scenario, r.first_mes, r.mes_example].join('\n');
    const result = [];
    if (/https?:\/\//i.test(combined)) result.push('External link(s) in character text.');
    if (/<\s*(script|iframe|object|embed|form)\b|javascript\s*:/i.test(combined)) result.push('Script-like or embedded HTML in character text.');
    if (/ignore (all )?(previous|prior) instructions|reveal (your |the )?(system prompt|api key)|execute (this |the )?(command|shell)/i.test(combined)) result.push('Potential instruction-manipulation language in character text (may be ordinary RP).');
    return result;
  }
  function candidates() {
    return [...document.images].map((el, i) => ({ el, i, src: el.currentSrc || el.src, width: el.naturalWidth, height: el.naturalHeight }))
      .filter(x => x.src && /^https:\/\//i.test(x.src) && x.width >= 150 && x.height >= 150)
      .slice(0, 45);
  }
  async function imageBytes(url) {
    const target = new URL(url, location.href);
    if (target.protocol !== 'https:') throw Error('Portrait must use HTTPS.');
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 20000);
    let reader;
    try {
      // Browser CORS applies. Omit credentials; never retry with opaque no-cors.
      const response = await fetch(target.href, {
        mode: 'cors', credentials: 'omit', signal: controller.signal,
        referrerPolicy: 'no-referrer'
      });
      if (!response.ok) throw Error(`Portrait HTTP ${response.status}.`);
      if (Number(response.headers.get('content-length')) > MAX_BYTES) throw Error('Portrait exceeds 12 MiB limit.');
      if (!response.body) throw Error('Portrait response has no readable body.');
      reader = response.body.getReader();
      const parts = []; let size = 0;
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.length;
        if (size > MAX_BYTES) throw Error('Portrait exceeds 12 MiB limit.');
        parts.push(value);
      }
      if (!size) throw Error('Portrait response is empty.');
      return concat(...parts);
    } catch (err) {
      if (controller.signal.aborted) throw Error('Portrait request timed out after 20 seconds. JSON export remains available.');
      if (err instanceof TypeError) throw Error('Browser could not read the portrait. Possible causes include CORS, site policy, a network failure, or an extension. The browser did not identify which. JSON export remains available.');
      throw err;
    } finally {
      clearTimeout(timer);
      if (reader) { try { await reader.cancel(); } catch (_) { /* Already closed or failed. */ } }
      controller.abort();
    }
  }
  function signature(bytes) {
    if (eq(bytes.subarray(0, 8), SIG)) return 'image/png';
    if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'image/jpeg';
    if (bytes.length >= 12 && String.fromCharCode(...bytes.subarray(0, 4)) === 'RIFF' && String.fromCharCode(...bytes.subarray(8, 12)) === 'WEBP') return 'image/webp';
    throw Error('Unrecognized image signature (PNG/JPEG/WebP only).');
  }
  async function sanitizedPNG(bytes) {
    const mime = signature(bytes);
    if (mime === 'image/png') parsePNG(bytes); // verify source PNG CRCs before decoding
    const bitmap = await createImageBitmap(new Blob([bytes], { type: mime }));
    try {
      if (!bitmap.width || !bitmap.height || bitmap.width > MAX_DIM || bitmap.height > MAX_DIM || bitmap.width * bitmap.height > MAX_PIXELS) throw Error('Image dimensions exceed safety limits.');
      const canvas = document.createElement('canvas');
      canvas.width = bitmap.width; canvas.height = bitmap.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw Error('Canvas unavailable.');
      ctx.drawImage(bitmap, 0, 0);
      const blob = await new Promise((resolve, reject) => canvas.toBlob(b => b ? resolve(b) : reject(Error('PNG encoding failed.')), 'image/png'));
      const out = localBytes(new Uint8Array(await blob.arrayBuffer()));
      const parsed = parsePNG(out);
      if (parsed.card !== null || parsed.width !== bitmap.width || parsed.height !== bitmap.height) throw Error('Sanitized PNG failed verification.');
      return out;
    } catch (err) {
      if (err.name === 'SecurityError') throw Error('Browser security blocked canvas pixel export (the canvas is not origin-clean). JSON export remains available.');
      throw err;
    } finally { bitmap.close(); }
  }
  function embedAndVerify(basePNG, card) {
    const parsed = parsePNG(basePNG);
    if (parsed.card !== null) throw Error('Unexpected metadata in sanitized PNG.');
    const json = JSON.stringify(card);
    const data = concat(utf8('chara'), new Uint8Array([0]), utf8(b64(utf8(json))));
    const meta = chunk('tEXt', data);
    // PNG requires IHDR as the first chunk; insert card metadata immediately after it.
    const ihdrEnd = 8 + 12 + get32(basePNG, 8);
    const out = concat(basePNG.subarray(0, ihdrEnd), meta, basePNG.subarray(ihdrEnd));
    const verified = parsePNG(out);
    if (verified.card !== json || JSON.stringify(JSON.parse(verified.card)) !== json || verified.width !== parsed.width || verified.height !== parsed.height) throw Error('PNG card round-trip failed.');
    return out;
  }
  async function scanLocally(bytes, fileType) {
    if (bytes.length > 16 * 1024 * 1024) throw Error('Export exceeds the local scanner 16 MiB limit.');
    const id = crypto.randomUUID();
    return new Promise((resolve, reject) => {
      let accepted = false;
      const connectTimeout = setTimeout(() => {
        if (!accepted) finish(Error('Firefox ClamAV Companion is unavailable. Install and enable the companion extension, then reload this page.'));
      }, 3000);
      const timeout = setTimeout(() => finish(Error('Local scanner companion timed out.')), 35000);
      function finish(error, result) {
        clearTimeout(connectTimeout);
        clearTimeout(timeout);
        window.removeEventListener('message', receive);
        if (error) reject(error); else resolve(result);
      }
      function receive(event) {
        if (event.source !== window || event.origin !== location.origin) return;
        const result = event.data;
        if (!result || result.id !== id) return;
        if (result.channel === NATIVE_SCAN_ACCEPT) { accepted = true; return; }
        if (result.channel !== NATIVE_SCAN_RESULT) return;
        if (result.status === 'failed') return finish(Error(result.message || 'Local scanner companion failed.'));
        if (result.status === 'clean' || result.status === 'threat') return finish(null, { status: result.status, threat: typeof result.threat === 'string' ? result.threat : '' });
        finish(Error('Local scanner companion returned an unknown result.'));
      }
      window.addEventListener('message', receive);
      window.postMessage({ channel: NATIVE_SCAN_REQUEST, id, fileType, data: b64(bytes) }, location.origin);
    });
  }
  function download(bytes, filename, mime) {
    const url = URL.createObjectURL(new Blob([bytes], { type: mime }));
    const a = document.createElement('a'); a.href = url; a.download = filename;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  }
  const downloadJSON = (obj, filename) => download(utf8(JSON.stringify(obj, null, 2)), filename, 'application/json');
  const css = `
#tv-janny-modal{position:fixed;inset:0;background:#000b;z-index:2147483647;display:flex;align-items:center;justify-content:center;font:14px system-ui,sans-serif;color:#eee}
#tv-janny-modal .tv-panel{width:min(680px,calc(100vw - 24px));max-height:calc(100vh - 24px);overflow:auto;background:#191923;border:1px solid #6b6482;border-radius:13px;padding:19px;box-shadow:0 12px 40px #0009}
#tv-janny-modal h2{font-size:19px;margin:0 0 8px}#tv-janny-modal p{margin:9px 0;line-height:1.45}#tv-janny-modal button,#tv-janny-modal select{padding:8px;border-radius:7px;background:#302b40;color:white;border:1px solid #777;cursor:pointer}#tv-janny-modal button:disabled{opacity:.4;cursor:not-allowed}
#tv-janny-modal .tv-row{display:flex;flex-wrap:wrap;gap:8px;margin-top:12px}#tv-janny-modal .tv-img{display:flex;gap:12px;align-items:center;margin:12px 0}#tv-janny-modal .tv-img img{width:96px;height:96px;object-fit:contain;background:#333;border:1px solid #666}#tv-janny-modal select{max-width:calc(100% - 120px)}#tv-janny-modal .tv-status{white-space:pre-wrap;background:#101017;padding:10px;border-radius:6px;margin-top:12px;max-height:200px;overflow:auto}#tv-janny-modal .tv-small{opacity:.8;font-size:12px}
`;
  function dialog(r) {
    document.getElementById('tv-janny-modal')?.remove();
    const images = candidates();
    if (r.imageUrl && /^https:\/\//i.test(r.imageUrl) && !images.some(x => x.src === r.imageUrl)) {
      images.unshift({ src: r.imageUrl, width: '?', height: '?' });
    }
    const modal = document.createElement('div'); modal.id = 'tv-janny-modal';
    const style = document.createElement('style'); style.textContent = css; modal.append(style);
    const panel = document.createElement('div'); panel.className = 'tv-panel'; modal.append(panel);
    const heading = document.createElement('h2'); heading.textContent = `JannyAI Character Card Exporter · ${VERSION}`; panel.append(heading);
    const title = document.createElement('p'); title.textContent = `${r.name} · ${r.creator || 'Creator not detected'}`; panel.append(title);
    const counts = document.createElement('p'); counts.className = 'tv-small'; counts.textContent = `Definition ${r.description.length} · Scenario ${r.scenario.length} · Greeting ${r.first_mes.length} · Examples ${r.mes_example.length} characters`; panel.append(counts);
    const cautions = warnings(r);
    if (cautions.length) { const note = document.createElement('p'); note.textContent = `Review character text: ${cautions.join(' ')}`; panel.append(note); }
    const toggleLine = document.createElement('label');
    const toggle = document.createElement('input'); toggle.type = 'checkbox'; toggle.checked = localStorage.getItem(PREF) === 'true';
    toggleLine.append(toggle, document.createTextNode(' Include character portrait in PNG card (otherwise JSON only)')); panel.append(toggleLine);
    const normalizeLine = document.createElement('label'); normalizeLine.style.display = 'block';
    const normalizeToggle = document.createElement('input'); normalizeToggle.type = 'checkbox'; normalizeToggle.checked = true;
    normalizeLine.append(normalizeToggle, document.createTextNode(' Normalize formatting for SillyTavern')); panel.append(normalizeLine);
    const normalizeHint = document.createElement('p'); normalizeHint.className = 'tv-small';
    normalizeHint.textContent = 'Converts standalone hyphen scene dividers to Markdown rules with spacing. Raw backups remain unchanged.'; panel.append(normalizeHint);
    const scanLine = document.createElement('label'); scanLine.style.display = 'block';
    const scanToggle = document.createElement('input'); scanToggle.type = 'checkbox'; scanToggle.checked = localStorage.getItem(SCAN_PREF) === 'true';
    scanLine.append(scanToggle, document.createTextNode(' Scan exports locally with ClamAV before downloading (optional)')); panel.append(scanLine);
    const scanHint = document.createElement('p'); scanHint.className = 'tv-small';
    scanHint.textContent = 'Disabled by default. Requires the one-time Firefox ClamAV Companion install; it starts ClamAV automatically and never uploads card data.'; panel.append(scanHint);
    const imgRow = document.createElement('div'); imgRow.className = 'tv-img'; panel.append(imgRow);
    const preview = document.createElement('img'); preview.alt = 'Selected character portrait preview'; imgRow.append(preview);
    const select = document.createElement('select'); imgRow.append(select);
    const empty = document.createElement('option'); empty.value = ''; empty.textContent = 'Choose this character’s portrait (required for PNG)'; select.append(empty);
    images.forEach((x, i) => { const opt = document.createElement('option'); opt.value = String(i); opt.textContent = `Image ${i + 1}: ${x.width}×${x.height} · ${new URL(x.src).hostname}`; select.append(opt); });
    const hint = document.createElement('p'); hint.className = 'tv-small'; hint.textContent = 'Choose the correct portrait by preview. Related characters and ads may also appear here. The original image is decoded and re-encoded; its original metadata is not copied.'; panel.append(hint);
    const status = document.createElement('div'); status.className = 'tv-status'; status.textContent = `Source: ${r.extraction_method}. JSON can be exported without a portrait.${r.extraction_warnings?.length ? '\n' + r.extraction_warnings.join('\n') : ''}`; panel.append(status);
    const actions = document.createElement('div'); actions.className = 'tv-row'; panel.append(actions);
    function button(text, fn) { const b = document.createElement('button'); b.textContent = text; b.addEventListener('click', fn); actions.append(b); return b; }
    const close = button('Close', () => modal.remove());
    async function scanBeforeDownload(bytes, fileType) {
      if (!scanToggle.checked) return { status: 'not-scanned' };
      status.textContent = 'Scanning locally with ClamAV…';
      try { return await scanLocally(bytes, fileType); }
      catch (err) { return { status: 'failed', message: err.message || String(err) }; }
    }
    function scanFailure(result) {
      if (result.status === 'threat') {
        status.textContent = `✗ Threat detected${result.threat ? `: ${result.threat}` : ''}.\nNo file was downloaded.`;
      } else {
        status.textContent = `✗ Scanning failed: ${result.message || 'Local scanner did not provide a usable result.'}\nNo file was downloaded.`;
      }
    }
    const raw = button('Raw backup', async () => {
      const rawData = utf8(JSON.stringify({ harvester_version: VERSION, captured_at: new Date().toISOString(), ...r }, null, 2));
      const scan = await scanBeforeDownload(rawData, 'json');
      if (scan.status === 'threat' || scan.status === 'failed') return scanFailure(scan);
      download(rawData, `${safeName(r.name)}.jannyai-raw.json`, 'application/json');
      status.textContent = `✓ Raw backup downloaded.\nAntivirus scan: ${scan.status === 'clean' ? 'No known threats detected.' : 'Not scanned.'}`;
    });
    const exportBtn = button('Export CCv2 JSON', async () => {
      const buttons = [close, raw, exportBtn, toggle, select, normalizeToggle, scanToggle]; buttons.forEach(b => b.disabled = true);
      let stage = 'Preparing character data';
      try {
        const card = cardV2(r, normalizeToggle.checked), json = JSON.stringify(card);
        if (JSON.stringify(JSON.parse(json)) !== json) throw Error('JSON round-trip mismatch.');
        if (!toggle.checked) {
          const jsonData = utf8(JSON.stringify(card, null, 2)), scan = await scanBeforeDownload(jsonData, 'json');
          if (scan.status === 'threat' || scan.status === 'failed') return scanFailure(scan);
          download(jsonData, `${safeName(r.name)}.card.json`, 'application/json');
          status.textContent = `✓ CCv2 JSON validated and downloaded.\nAntivirus scan: ${scan.status === 'clean' ? 'No known threats detected.' : 'Not scanned.'}`;
          return;
        }
        if (!select.value) throw Error('Select the correct portrait first. No file downloaded.');
        const chosen = images[Number(select.value)];
        if (!chosen || !/^https:\/\//i.test(chosen.src)) throw Error('Invalid portrait URL.');
        stage = 'Downloading selected portrait';
        status.textContent = stage + '…';
        const source = await imageBytes(chosen.src);
        stage = 'Checking image signature and structure; decoding and rebuilding PNG';
        status.textContent = stage + '…';
        const sanitized = await sanitizedPNG(source);
        stage = 'Embedding card and verifying PNG metadata round-trip';
        status.textContent = stage + '…';
        const png = embedAndVerify(sanitized, card);
        stage = 'Scanning PNG locally with ClamAV';
        const scan = await scanBeforeDownload(png, 'png');
        if (scan.status === 'threat' || scan.status === 'failed') return scanFailure(scan);
        stage = 'Starting PNG download';
        download(png, `${safeName(r.name)}.card.png`, 'image/png');
        status.textContent = `✓ Image decoded and sanitized.\n✓ PNG structure and CRCs validated.\n✓ CCv2 metadata read back and matched.\n✓ Downloaded ${png.length.toLocaleString()} bytes.\nAntivirus scan: ${scan.status === 'clean' ? 'No known threats detected.' : 'Not scanned.'}\nImage identity: selected by you, not independently authenticated.`;
      } catch (err) {
        status.textContent = `✗ ${stage}: ${err.message || err}\nNo new export was downloaded for this attempt. You can uncheck the portrait option and export JSON.`;
        console.error('[JannyAI Exporter]', err);
      } finally { buttons.forEach(b => b.disabled = false); }
    });
    function update() {
      localStorage.setItem(PREF, String(toggle.checked));
      localStorage.setItem(SCAN_PREF, String(scanToggle.checked));
      imgRow.style.display = toggle.checked ? 'flex' : 'none';
      exportBtn.textContent = toggle.checked ? 'Export CCv2 PNG card' : 'Export CCv2 JSON';
    }
    toggle.addEventListener('change', update);
    scanToggle.addEventListener('change', update);
    select.addEventListener('change', () => { const x = images[Number(select.value)]; preview.src = select.value && x ? x.src : ''; });
    if (r.imageUrl) { const preferred = images.findIndex(x => x.src === r.imageUrl); if (preferred >= 0) { select.value = String(preferred); preview.src = r.imageUrl; } }
    update();
    modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
    document.body.append(modal);
  }
  function run() { try { dialog(harvest()); } catch (err) { console.error('[JannyAI Exporter]', err); alert(`Card extraction failed: ${err.message || err}\nNo file exported.`); } }
  function install() {
    if (document.getElementById('tv-janny-export')) return;
    const b = document.createElement('button'); b.id = 'tv-janny-export'; b.textContent = '💾 Export Real Card';
    Object.assign(b.style, { position: 'fixed', right: '18px', bottom: '18px', zIndex: '2147483000', padding: '11px 15px', borderRadius: '10px', border: '1px solid #aaa', background: '#302b40', color: '#fff', fontWeight: '700', cursor: 'pointer' });
    b.addEventListener('click', run); document.body.append(b);
  }
  install(); new MutationObserver(install).observe(document.documentElement, { childList: true, subtree: true });
})();
