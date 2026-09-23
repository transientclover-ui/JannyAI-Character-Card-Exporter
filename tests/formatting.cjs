'use strict';
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),zlib=require('node:zlib');
const showdown=require('showdown');
const source=fs.readFileSync(path.join(__dirname,'../JannyAI-Character-Card-Exporter-v0.5.6-beta.user.js'),'utf8');
const footer='  install(); new MutationObserver(install).observe(document.documentElement, { childList: true, subtree: true });';
const sandbox={TextEncoder,TextDecoder,Uint8Array,btoa,atob,location:{href:'https://jannyai.com/',pathname:''},document:{querySelectorAll:()=>[]}};
vm.runInNewContext(source.replace(footer,'globalThis.api={normalizeFormatting,decodeAstroProps,structuredRecord,cardV2,embedAndVerify,parsePNG,concat,chunk,SIG,put32};'),sandbox);
const a=sandbox.api,n=a.normalizeFormatting;
const options={emoji:true,literalMidWordUnderscores:true,parseImgDimensions:true,tables:true,underline:true,simpleLineBreaks:true,strikethrough:true,disableForced4SpacesIndentedSublists:true};
const renderer=new showdown.Converter(options);
const fixture=JSON.parse(fs.readFileSync(path.join(__dirname,'fixtures/nick-structured.json'),'utf8'));
const props=a.decodeAstroProps(fixture.props),r=a.structuredRecord(props,{props:fixture.props,component:fixture.component});
const before=JSON.stringify(r), original=a.cardV2(r,false),normalized=a.cardV2(r);
assert.equal(original.data.first_mes,props.character.firstMessage);
const oldHTML=renderer.makeHtml(original.data.first_mes),newHTML=renderer.makeHtml(normalized.data.first_mes);
const oldHeadings=[...oldHTML.matchAll(/<h2[^>]*>(.*?)<\/h2>/gs)].map(m=>m[1]);
assert.equal(oldHeadings.length,3);
for(const text of oldHeadings) assert(newHTML.includes('<p>'+text+'</p>'), 'Former heading must be a paragraph: '+text);
assert.match(oldHTML,/<h2[^>]*>You laugh\. He doesn’t\.<\/h2>/);
assert.doesNotMatch(newHTML,/<h[1-6]\b/);
assert.match(newHTML,/<p>You laugh\. He doesn’t\.<\/p>/);
assert.match(newHTML,/<hr\s*\/?\s*>/);
assert.equal(JSON.stringify(r),before);
assert.equal(normalized.data.extensions.jannyai_harvester.source_props.character.firstMessage,original.data.first_mes);
assert.equal(normalized.data.extensions.jannyai_harvester.source_props_serialized,fixture.props);
assert.equal(n(normalized.data.first_mes),normalized.data.first_mes);
// All non-divider lines and their original endings remain in sequence; only blank lines added.
assert.deepEqual(normalized.data.first_mes.split('\n').filter(x=>x!=='' && !/^ *-{3,}[ \t]*$/.test(x)),original.data.first_mes.split('\n').filter(x=>x!=='' && !/^ *-{3,}[ \t]*$/.test(x)));
for(const field of ['description','personality','scenario','first_mes','mes_example']) {
 const record={...r,[field]:'*Dialogue.*\n--------\nNext paragraph.'};
 assert.equal(a.cardV2(record,true).data[field],'*Dialogue.*\n\n---\n\nNext paragraph.');
 assert.equal(a.cardV2(record,false).data[field],record[field]);
}
const unchanged=['ordinary hyphen-word — punctuation!','*emphasis* and **bold**\n\n"Dialogue."','    ----\n\t----','> quoted\n> ----','- list item\n--','```md\ntext\n----\n```','~~~\ntext\n----\n~~~','\n\n---\n\n','Title\n==','text\n- - -'];
for(const text of unchanged)assert.equal(n(text),text);
assert.equal(n('A\r\n--------\r\nB'),'A\r\n\r\n---\r\n\r\nB');
assert.equal(n('A\n---'),'A\n\n---');
assert.equal(n('A\n---\n---\nB'),'A\n\n---\n\n---\n\nB');
const ihdr=new Uint8Array(13);a.put32(ihdr,0,1);a.put32(ihdr,4,1);ihdr[8]=8;ihdr[9]=6;
const base=a.concat(a.SIG,a.chunk('IHDR',ihdr),a.chunk('IDAT',zlib.deflateSync(Buffer.from([0,0,0,0,255]))),a.chunk('IEND',new Uint8Array()));
for(const card of [original,normalized]) {
 const recoveredText=a.parsePNG(a.embedAndVerify(base,card)).card;
 assert.equal(recoveredText,JSON.stringify(card));
 const recovered=JSON.parse(recoveredText);
 assert.equal(recovered.spec,'chara_card_v2'); assert.equal(recovered.spec_version,'2.0');
 for(const field of ['name','description','personality','scenario','first_mes','mes_example','creator_notes','system_prompt','post_history_instructions','creator','character_version'])assert.equal(typeof recovered.data[field],'string');
 for(const field of ['alternate_greetings','tags'])assert(Array.isArray(recovered.data[field]));
 assert.equal(typeof recovered.data.extensions,'object');
}
assert.equal(n('You laugh. He doesn’t.\n--------\n24 Hours Later'),'You laugh. He doesn’t.\n\n---\n\n24 Hours Later');
assert.match(source,/cardV2\(r, normalizeToggle.checked\)/);
assert.match(source,/normalizeToggle.checked = true/);
console.log(JSON.stringify({passed:true,renderer:'Showdown 2.1.0 with SillyTavern core options; no app extensions',nickBefore:oldHTML.match(/<h2[^>]*>You laugh.*?<\/h2>/)[0],nickAfter:newHTML.match(/<p>You laugh.*?<\/p>/)[0],formerHeadings:oldHeadings,checks:['normalization default on','all five exported text fields','original record and source props unchanged','JSON/PNG match for both modes','fences and indented code unchanged','punctuation and emphasis unchanged','line endings and existing paragraph breaks retained','idempotent']},null,2));
